/**
 * In-memory durable-queue adapter.
 *
 * Role: the default adapter for dev and unit tests. Not durable across
 * process restarts; durability comes from NATS/Redpanda/Redis in real
 * deployments. The in-memory adapter is a faithful reference of the
 * interface contract, used to validate handler logic without external
 * infrastructure.
 *
 * Ordering guarantees:
 *   - Same partition key → same logical partition → strict per-key order.
 *   - Across keys, order is defined by produce timestamp.
 *
 * Delivery guarantees:
 *   - At-least-once. A handler throwing re-queues the message on the same
 *     partition at the head (simulating redelivery).
 *
 * Backpressure:
 *   - None. The in-memory buffer grows unboundedly; production adapters
 *     bound memory via broker-side retention (NATS stream limits, Kafka
 *     log retention, Redis maxlen).
 */
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

interface Subscription {
  readonly topic: string;
  readonly groupId: string;
  readonly handler: ConsumerHandler;
  readonly concurrency: number;
  /** Last committed offset per partition for this group. */
  readonly committed: Map<number, number>;
  /** In-flight promise per partition to serialise within-key ordering. */
  readonly inflight: Map<number, Promise<void>>;
  closed: boolean;
}

interface StoredMessage extends QueueMessage {
  readonly _seq: number;
}

class InMemoryBus {
  /** topic → partition → ordered array of messages. */
  private readonly log = new Map<string, Map<number, StoredMessage[]>>();
  /** topic → subscriptions. */
  private readonly subs = new Map<string, Set<Subscription>>();
  private nextSeq = 0;
  private readonly partitionsPerTopic = 16;

  partitionFor(topic: string, key: string): number {
    // Simple FNV-1a on the UTF-8 of `key`, modulo 16. Deterministic.
    let hash = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    const n = this.partitionsPerTopic;
    return (hash >>> 0) % n;
  }

  async append(topic: string, rec: ProduceRecord): Promise<void> {
    const partition = this.partitionFor(topic, rec.key);
    const seq = this.nextSeq++;
    const msg: StoredMessage = {
      topic,
      partition,
      offset: String(seq),
      key: new TextEncoder().encode(rec.key),
      value: rec.value,
      headers: rec.headers,
      timestamp: Date.now(),
      _seq: seq,
    };
    let topicPartitions = this.log.get(topic);
    if (!topicPartitions) {
      topicPartitions = new Map();
      this.log.set(topic, topicPartitions);
    }
    let bucket = topicPartitions.get(partition);
    if (!bucket) {
      bucket = [];
      topicPartitions.set(partition, bucket);
    }
    bucket.push(msg);
    // Best-effort dispatch; don't block the produce call on handler work.
    void this.dispatch(topic, partition).catch(() => {});
  }

  subscribe(opts: SubscribeOpts): Subscription {
    const sub: Subscription = {
      topic: opts.topic,
      groupId: opts.groupId,
      handler: opts.handler,
      concurrency: opts.concurrency ?? 1,
      committed: new Map(),
      inflight: new Map(),
      closed: false,
    };
    let set = this.subs.get(opts.topic);
    if (!set) {
      set = new Set();
      this.subs.set(opts.topic, set);
    }
    set.add(sub);
    // Replay any existing messages for this sub (fromBeginning = default).
    const partitions = this.log.get(opts.topic);
    if (partitions) {
      for (const partition of partitions.keys()) {
        void this.dispatchOne(sub, partition).catch(() => {});
      }
    }
    return sub;
  }

  unsubscribe(sub: Subscription): void {
    sub.closed = true;
    const set = this.subs.get(sub.topic);
    set?.delete(sub);
  }

  /** Dispatch pending messages on a partition to every subscription group. */
  private async dispatch(topic: string, partition: number): Promise<void> {
    const subs = this.subs.get(topic);
    if (!subs) return;
    for (const sub of subs) {
      await this.dispatchOne(sub, partition);
    }
  }

  private async dispatchOne(sub: Subscription, partition: number): Promise<void> {
    if (sub.closed) return;
    // Serialise per-partition to keep within-key order.
    const existing = sub.inflight.get(partition);
    const run = (existing ?? Promise.resolve()).then(async () => {
      while (!sub.closed) {
        const bucket = this.log.get(sub.topic)?.get(partition);
        if (!bucket) return;
        const committedOffset = sub.committed.get(partition) ?? -1;
        // Seek the first uncommitted message.
        const idx = bucket.findIndex((m) => m._seq > committedOffset);
        if (idx < 0) return;
        const msg = bucket[idx]!;
        try {
          const result = await sub.handler(msg);
          if (result === "nack") {
            // Explicit nack: schedule a retry on the next tick.
            setTimeout(() => void this.dispatchOne(sub, partition).catch(() => {}), 10);
            return;
          }
          sub.committed.set(partition, msg._seq);
        } catch {
          // At-least-once redelivery: halt this partition's progress and
          // schedule a retry of the same message after a short back-off.
          setTimeout(() => void this.dispatchOne(sub, partition).catch(() => {}), 10);
          return;
        }
      }
    });
    sub.inflight.set(partition, run);
    await run;
  }

  /** Return the oldest-unacked-message age (seconds) for a group on a topic. */
  lagSeconds(topic: string, groupId: string): number {
    const subs = this.subs.get(topic);
    if (!subs) return -1;
    let match: Subscription | undefined;
    for (const s of subs) if (s.groupId === groupId) match = s;
    if (!match) return -1;
    const partitions = this.log.get(topic);
    if (!partitions) return 0;
    let oldestUnackedMs = Infinity;
    for (const [p, bucket] of partitions) {
      const committed = match.committed.get(p) ?? -1;
      for (const m of bucket) {
        if (m._seq > committed) {
          if (m.timestamp < oldestUnackedMs) oldestUnackedMs = m.timestamp;
          break;
        }
      }
    }
    if (oldestUnackedMs === Infinity) return 0;
    return Math.max(0, (Date.now() - oldestUnackedMs) / 1000);
  }

  /** Test hook: total message count on a topic. */
  count(topic: string): number {
    const partitions = this.log.get(topic);
    if (!partitions) return 0;
    let n = 0;
    for (const b of partitions.values()) n += b.length;
    return n;
  }

  /** Test hook: full reset. */
  reset(): void {
    this.log.clear();
    this.subs.clear();
    this.nextSeq = 0;
  }
}

/** Process-wide singleton. Enables a producer and a consumer in the same
 *  process (i.e. unit-test setup) to share the bus. */
let sharedBus: InMemoryBus | undefined;
export function getInMemoryBus(): InMemoryBus {
  if (!sharedBus) sharedBus = new InMemoryBus();
  return sharedBus;
}
export function resetInMemoryBus(): void {
  sharedBus?.reset();
  sharedBus = new InMemoryBus();
}

// ---------------------------------------------------------------------------
// Public adapter classes
// ---------------------------------------------------------------------------

export class InMemoryProducer implements QueueProducer {
  readonly adapterName: AdapterName = "in-memory";
  private closed = false;
  private readonly bus = getInMemoryBus();

  async produce(record: ProduceRecord): Promise<void> {
    if (this.closed) throw new Error("InMemoryProducer closed");
    if (!record.headers[HEADER_ORG_ID]) {
      throw new Error("InMemoryProducer: `headers.org_id` is required by the queue contract");
    }
    await this.bus.append(record.topic, record);
  }
  async flush(): Promise<void> {
    // In-memory has no async path to flush; produce is already synchronous.
  }
  async close(): Promise<void> {
    this.closed = true;
  }
}

export class InMemoryConsumer implements QueueConsumer {
  readonly adapterName: AdapterName = "in-memory";
  private readonly subs = new Set<Subscription>();
  private readonly bus = getInMemoryBus();

  async subscribe(opts: SubscribeOpts): Promise<void> {
    const sub = this.bus.subscribe(opts);
    this.subs.add(sub);
  }
  async close(): Promise<void> {
    for (const s of this.subs) this.bus.unsubscribe(s);
    this.subs.clear();
  }
  async lagSeconds(opts: { topic: string; groupId: string }): Promise<number> {
    return this.bus.lagSeconds(opts.topic, opts.groupId);
  }
}
