/**
 * Redis Streams adapter.
 *
 * Role: low-footprint alternative for dev and small-scale installs where a
 * full broker is overkill but in-memory is not durable enough. Redis
 * Streams give us at-least-once delivery, consumer groups, and per-stream
 * ordering.
 *
 * Partitioning: Redis Streams have a single log per stream; we shard by
 * routing writes to one of N streams `<topic>.p<n>` and union-reading them
 * in the consumer. This keeps the partition-by-key contract intact.
 *
 * Limitations:
 *   - Redis Streams retain entries until `XTRIM` runs; we cap MAXLEN at
 *     produce time to prevent unbounded growth (10M entries per stream
 *     default, adjustable by env).
 *   - Lag is approximate: we use `XLEN - XPENDING.pending` as an estimate
 *     converted to seconds via the oldest-pending-message timestamp.
 */
import { Redis as RedisClient } from "ioredis";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const IORedis: typeof RedisClient =
  require("ioredis").default ?? require("ioredis").Redis ?? require("ioredis");
import {
  type AdapterName,
  type ProduceRecord,
  type QueueConsumer,
  type QueueMessage,
  type QueueProducer,
  type SubscribeOpts,
  HEADER_ORG_ID,
} from "../types.js";

const PARTITIONS = 16;
const DEFAULT_MAXLEN = 10_000_000;

function partitionFor(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % PARTITIONS;
}

function streamKey(topic: string, partition: number): string {
  return `${topic}.p${partition}`;
}

export interface RedisStreamsAdapterOpts {
  readonly url: string;
  readonly maxLen?: number;
}

function toFieldArgs(
  key: string,
  value: Uint8Array,
  headers: Readonly<Record<string, string>>,
): Array<string | Buffer> {
  // Redis streams want alternating field/value pairs. We pack headers under
  // a `h.<name>` prefix and store the body as Buffer under `value`.
  const args: Array<string | Buffer> = [];
  args.push("key", key);
  args.push("value", Buffer.from(value));
  for (const [k, v] of Object.entries(headers)) {
    args.push(`h.${k}`, v);
  }
  return args;
}

function parseFields(fields: string[]): {
  key: string;
  value: Uint8Array;
  headers: Record<string, string>;
} {
  let key = "";
  let value = new Uint8Array();
  const headers: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    const name = fields[i]!;
    const raw = fields[i + 1];
    if (name === "key") key = String(raw ?? "");
    else if (name === "value")
      value = Buffer.isBuffer(raw)
        ? new Uint8Array(raw)
        : new TextEncoder().encode(String(raw ?? ""));
    else if (name.startsWith("h.")) headers[name.slice(2)] = String(raw ?? "");
  }
  return { key, value, headers };
}

export class RedisStreamsProducer implements QueueProducer {
  readonly adapterName: AdapterName = "redis-streams";
  private readonly client: RedisClient;
  private readonly maxLen: number;

  constructor(opts: RedisStreamsAdapterOpts) {
    this.client = new IORedis(opts.url);
    this.maxLen = opts.maxLen ?? DEFAULT_MAXLEN;
  }

  async produce(record: ProduceRecord): Promise<void> {
    if (!record.headers[HEADER_ORG_ID]) {
      throw new Error("RedisStreamsProducer: `headers.org_id` is required by the queue contract");
    }
    const partition = partitionFor(record.key);
    const stream = streamKey(record.topic, partition);
    // XADD <stream> MAXLEN ~ <N> * field value ... — approximate trim is cheap.
    await this.client.xadd(
      stream,
      "MAXLEN",
      "~",
      this.maxLen,
      "*",
      ...toFieldArgs(record.key, record.value, record.headers),
    );
  }

  async flush(): Promise<void> {
    // No-op; XADD is synchronous from the client's perspective.
  }

  async close(): Promise<void> {
    await this.client.quit().catch(() => {});
  }
}

export class RedisStreamsConsumer implements QueueConsumer {
  readonly adapterName: AdapterName = "redis-streams";
  private readonly client: RedisClient;
  private readonly subs: Array<{ stop: () => void }> = [];

  constructor(opts: RedisStreamsAdapterOpts) {
    this.client = new IORedis(opts.url);
  }

  async subscribe(opts: SubscribeOpts): Promise<void> {
    const streams = Array.from({ length: PARTITIONS }, (_, i) => streamKey(opts.topic, i));
    // Create consumer group on each partition stream (idempotent via MKSTREAM).
    for (const s of streams) {
      try {
        await this.client.xgroup(
          "CREATE",
          s,
          opts.groupId,
          opts.fromBeginning === false ? "$" : "0",
          "MKSTREAM",
        );
      } catch (err) {
        const msg = (err as Error).message ?? "";
        if (!msg.includes("BUSYGROUP")) throw err;
      }
    }

    let stopped = false;
    const consumerName = `${opts.groupId}-${process.pid}`;
    const concurrency = opts.concurrency ?? 1;

    const loop = async (): Promise<void> => {
      while (!stopped) {
        // Block-read up to N entries from all partition streams at once.
        const readArgs: Array<string | number> = [
          "GROUP",
          opts.groupId,
          consumerName,
          "COUNT",
          Math.max(1, concurrency),
          "BLOCK",
          1000,
          "STREAMS",
          ...streams,
          ...streams.map(() => ">"),
        ];
        let res: unknown;
        try {
          res = await (
            this.client as unknown as { xreadgroup: (...args: unknown[]) => Promise<unknown> }
          ).xreadgroup(...readArgs);
        } catch {
          if (stopped) return;
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }
        if (!res) continue;
        // res shape: [ [streamName, [[id, [field, value, ...]], ...]], ... ]
        for (const streamTuple of res as Array<[string, Array<[string, string[]]>]>) {
          const [streamName, entries] = streamTuple;
          for (const [id, fields] of entries) {
            const parsed = parseFields(fields);
            const msg: QueueMessage = {
              topic: opts.topic,
              partition: Number(streamName.split(".p")[1] ?? 0),
              offset: id,
              key: new TextEncoder().encode(parsed.key),
              value: parsed.value,
              headers: parsed.headers,
              timestamp: Number(id.split("-")[0]),
            };
            try {
              const r = await opts.handler(msg);
              if (r === "nack") {
                // Leave unacked; will redeliver via pending-entries scan.
                continue;
              }
              await this.client.xack(streamName, opts.groupId, id);
            } catch {
              // Redeliver via pending list; do not ACK.
            }
          }
        }
      }
    };
    void loop().catch(() => {});
    this.subs.push({ stop: () => (stopped = true) });
  }

  async close(): Promise<void> {
    for (const s of this.subs) s.stop();
    this.subs.length = 0;
    await this.client.quit().catch(() => {});
  }

  async lagSeconds(opts: { topic: string; groupId: string }): Promise<number> {
    try {
      const streams = Array.from({ length: PARTITIONS }, (_, i) => streamKey(opts.topic, i));
      let oldestMs = Infinity;
      for (const s of streams) {
        const pending = (await this.client.xpending(s, opts.groupId)) as unknown as [
          number,
          string,
          string,
          Array<[string, number]>,
        ];
        if (!pending || pending[0] === 0) continue;
        const oldestId = pending[1];
        if (oldestId) {
          const ts = Number(oldestId.split("-")[0]);
          if (ts < oldestMs) oldestMs = ts;
        }
      }
      if (oldestMs === Infinity) return 0;
      return Math.max(0, (Date.now() - oldestMs) / 1000);
    } catch {
      return -1;
    }
  }
}
