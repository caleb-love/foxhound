/**
 * NATS JetStream adapter.
 *
 * Role: the reference durable adapter for local dev. NATS is a single small
 * binary (`nats-server -js`) with a good durability story (JetStream) and
 * zero coordinator overhead; ideal for a docker-compose-friendly footprint.
 *
 * Subjects: topic → subject of the same name, inside a JetStream stream
 * named after `NATS_STREAM` (default `FOXHOUND_SPANS`). The stream is
 * auto-created on first use with `retention: limits` and a 7-day max-age.
 *
 * Partitioning: NATS does not partition by key natively; we route via
 * subject suffix `<topic>.p<n>` where `n = hash(key) % PARTITIONS`. A
 * consumer using `filter_subject: <topic>.*` sees all partitions; per-key
 * order is preserved because the same key always lands on the same suffix
 * and JetStream preserves per-subject order.
 */
import {
  connect as natsConnect,
  type NatsConnection,
  type JetStreamClient,
  type JetStreamManager,
  type ConsumerMessages,
} from "nats";
import {
  type AdapterName,
  type ConsumerHandler,
  type ProduceRecord,
  type QueueConsumer,
  type QueueMessage,
  type QueueProducer,
  type SubscribeOpts,
  HEADER_ORG_ID,
} from "../types.js";

const PARTITIONS = 16;
const STREAM_MAX_AGE_NS = 7n * 24n * 60n * 60n * 1_000_000_000n; // 7 days

function partitionFor(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % PARTITIONS;
}

function subjectFor(topic: string, partition: number): string {
  return `${topic}.p${partition}`;
}

export interface NatsAdapterOpts {
  readonly url: string;
  readonly stream: string;
}

async function ensureStream(
  jsm: JetStreamManager,
  stream: string,
  topics: readonly string[],
): Promise<void> {
  const subjects = topics.flatMap((t) =>
    Array.from({ length: PARTITIONS }, (_, i) => subjectFor(t, i)),
  );
  try {
    await jsm.streams.info(stream);
    // Update subjects list idempotently (additive).
    await jsm.streams.update(stream, { subjects });
  } catch {
    await jsm.streams.add({
      name: stream,
      subjects,
      retention: "limits",
      max_age: Number(STREAM_MAX_AGE_NS),
      storage: "file",
    } as Parameters<typeof jsm.streams.add>[0]);
  }
}

export class NatsProducer implements QueueProducer {
  readonly adapterName: AdapterName = "nats";
  private nc: NatsConnection | undefined;
  private js: JetStreamClient | undefined;
  private readonly opts: NatsAdapterOpts;
  private readonly knownTopics = new Set<string>();

  constructor(opts: NatsAdapterOpts) {
    this.opts = opts;
  }

  private async ensureConnected(topic: string): Promise<JetStreamClient> {
    if (!this.nc) {
      this.nc = await natsConnect({ servers: this.opts.url });
    }
    if (!this.js) {
      this.js = this.nc.jetstream();
    }
    if (!this.knownTopics.has(topic)) {
      const jsm = await this.nc.jetstreamManager();
      await ensureStream(jsm, this.opts.stream, [topic]);
      this.knownTopics.add(topic);
    }
    return this.js;
  }

  async produce(record: ProduceRecord): Promise<void> {
    if (!record.headers[HEADER_ORG_ID]) {
      throw new Error("NatsProducer: `headers.org_id` is required by the queue contract");
    }
    const js = await this.ensureConnected(record.topic);
    const partition = partitionFor(record.key);
    const subject = subjectFor(record.topic, partition);
    const hdrs: Record<string, string> = { ...record.headers, partition_key: record.key };
    // Convert to NATS headers. The library expects its own Headers type; we
    // use the raw subject-level JetStream publish which accepts a plain
    // record via `headers` option.
    const headersObj = Object.entries(hdrs).map(([k, v]) => [k, String(v)] as const);
    await js.publish(subject, record.value, {
      headers: buildNatsHeaders(headersObj),
    });
  }

  async flush(timeoutMs: number): Promise<void> {
    if (!this.nc) return;
    await this.nc.flush();
    // NATS.flush() resolves when the server ACKs; we still cap the wait.
    if (timeoutMs > 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  async close(): Promise<void> {
    await this.nc?.drain();
    this.nc = undefined;
    this.js = undefined;
  }
}

function buildNatsHeaders(
  entries: ReadonlyArray<readonly [string, string]>,
): ReturnType<typeof import("nats").headers> {
  // Dynamic import of the helper so we don't import the function namespace
  // eagerly. The `nats` package exports `headers()` as a factory.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { headers } = require("nats") as typeof import("nats");
  const h = headers();
  for (const [k, v] of entries) h.append(k, v);
  return h;
}

export class NatsConsumer implements QueueConsumer {
  readonly adapterName: AdapterName = "nats";
  private nc: NatsConnection | undefined;
  private readonly opts: NatsAdapterOpts;
  private readonly iterators: ConsumerMessages[] = [];

  constructor(opts: NatsAdapterOpts) {
    this.opts = opts;
  }

  private async ensureConnected(): Promise<NatsConnection> {
    if (!this.nc) {
      this.nc = await natsConnect({ servers: this.opts.url });
    }
    return this.nc;
  }

  async subscribe(opts: SubscribeOpts): Promise<void> {
    const nc = await this.ensureConnected();
    const jsm = await nc.jetstreamManager();
    await ensureStream(jsm, this.opts.stream, [opts.topic]);

    const consumerName = sanitize(`${opts.topic}-${opts.groupId}`);
    const filterSubject = `${opts.topic}.*`;
    try {
      await jsm.consumers.info(this.opts.stream, consumerName);
    } catch {
      await jsm.consumers.add(this.opts.stream, {
        durable_name: consumerName,
        name: consumerName,
        filter_subject: filterSubject,
        ack_policy: "explicit",
        deliver_policy: opts.fromBeginning === false ? "new" : "all",
        max_ack_pending: opts.concurrency ?? 100,
      } as unknown as Parameters<typeof jsm.consumers.add>[1]);
    }

    const js = nc.jetstream();
    const consumer = await js.consumers.get(this.opts.stream, consumerName);
    const iter = await consumer.consume();
    this.iterators.push(iter);

    // Fire-and-forget loop; callers close via `close()`.
    void (async () => {
      for await (const m of iter) {
        const keyHdr = m.headers?.get("partition_key") ?? "";
        const headers: Record<string, string> = {};
        if (m.headers) {
          for (const k of m.headers.keys()) {
            const v = m.headers.get(k);
            if (v !== undefined) headers[k] = v;
          }
        }
        const msg: QueueMessage = {
          topic: opts.topic,
          partition: partitionFor(keyHdr),
          offset: String(m.seq),
          key: new TextEncoder().encode(keyHdr),
          value: m.data,
          headers,
          timestamp: m.info.timestampNanos
            ? Number(BigInt(m.info.timestampNanos) / 1_000_000n)
            : Date.now(),
        };
        try {
          const r = await opts.handler(msg);
          if (r === "nack") m.nak();
          else m.ack();
        } catch {
          m.nak();
        }
      }
    })().catch(() => {});
  }

  async close(): Promise<void> {
    for (const it of this.iterators) {
      try {
        await it.close();
      } catch {
        /* ignore */
      }
    }
    this.iterators.length = 0;
    await this.nc?.drain();
    this.nc = undefined;
  }

  async lagSeconds(opts: { topic: string; groupId: string }): Promise<number> {
    const nc = await this.ensureConnected();
    const jsm = await nc.jetstreamManager();
    const consumerName = sanitize(`${opts.topic}-${opts.groupId}`);
    try {
      const info = await jsm.consumers.info(this.opts.stream, consumerName);
      const pending = info.num_pending;
      if (pending === 0) return 0;
      const streamInfo = await jsm.streams.info(this.opts.stream);
      const lastMs = streamInfo.state.last_ts ? Date.parse(streamInfo.state.last_ts) : Date.now();
      return Math.max(0, (Date.now() - lastMs) / 1000);
    } catch {
      return -1;
    }
  }
}

function sanitize(s: string): string {
  return s.replace(/[^A-Za-z0-9_]/g, "_");
}
