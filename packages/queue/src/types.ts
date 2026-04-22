/**
 * Durable ingestion queue — public interface.
 *
 * Two roles: `QueueProducer` (edge API writes batches here) and
 * `QueueConsumer` (worker groups subscribe here). All four adapters
 * implement both interfaces.
 *
 * Tenant scoping contract (program guardrail):
 *   - Every produced message MUST carry `org_id` in `headers.org_id`.
 *   - Consumer handlers MUST re-assert `headers.org_id` before any DB write.
 *   - The adapter does not enforce tenancy on its own; that is a handler
 *     responsibility. But the interface makes `org_id` mandatory on produce.
 *
 * Partitioning contract (RFC-008):
 *   - `key` is the partition key; the adapter MUST route same-keyed messages
 *     to the same partition/consumer instance so per-trace ordering holds.
 *   - Recommended key: `trace_id`. The API `ingest-producer` enforces this.
 */

/** A single message on the queue. */
export interface QueueMessage {
  readonly topic: string;
  /** Logical partition assigned by the adapter. Meaning is adapter-specific. */
  readonly partition: number;
  /** Opaque offset string; passed to `commit()` to ACK the message. */
  readonly offset: string;
  /** Partition key (`trace_id` by convention). */
  readonly key: Uint8Array;
  /** Message body (Protobuf-encoded `TraceBatch` or `Span`). */
  readonly value: Uint8Array;
  /** String headers; by contract, `org_id` is mandatory. */
  readonly headers: Readonly<Record<string, string>>;
  /** Milliseconds since epoch at producer send time. */
  readonly timestamp: number;
}

export interface ProduceRecord {
  readonly topic: string;
  /** Partition key; same key → same partition. */
  readonly key: string;
  /** Message body. */
  readonly value: Uint8Array;
  /** Required headers; `org_id` is enforced by the producer wrapper. */
  readonly headers: Readonly<Record<string, string>>;
}

export interface QueueProducer {
  /**
   * Enqueue a single record. Must be safe to call from many concurrent
   * request handlers; adapter provides its own internal batching if any.
   */
  produce(record: ProduceRecord): Promise<void>;
  /** Flush any in-flight batches; resolves when all sent or timeout fires. */
  flush(timeoutMs: number): Promise<void>;
  /** Close underlying connection(s). Safe to call more than once. */
  close(): Promise<void>;
  /** Name of the adapter for logs and metrics. */
  readonly adapterName: string;
}

/**
 * Handler contract: return value semantics.
 *   - resolve normally → `ack` the message.
 *   - throw or reject   → message redelivered per adapter config.
 *   - return `"ack"`   → explicit ack (same as resolve).
 *   - return `"nack"`   → explicit nack without throwing (adapter requeues).
 */
export type ConsumerHandlerResult = "ack" | "nack" | void;
export type ConsumerHandler = (msg: QueueMessage) => Promise<ConsumerHandlerResult>;

export interface SubscribeOpts {
  readonly topic: string;
  readonly groupId: string;
  readonly handler: ConsumerHandler;
  /**
   * Maximum in-flight messages per handler. Adapter-dependent default.
   * Default 1 preserves strict per-partition order; bump for throughput.
   */
  readonly concurrency?: number;
  /**
   * Start from earliest/latest when the consumer group has no committed
   * offset. Default `"earliest"` so a new consumer catches replay traffic.
   */
  readonly fromBeginning?: boolean;
}

export interface QueueConsumer {
  /** Attach a handler. Adapter-specific work runs in the background. */
  subscribe(opts: SubscribeOpts): Promise<void>;
  /** Stop consuming and close connections. */
  close(): Promise<void>;
  /**
   * Return the current consumer-group lag in seconds, or -1 if unavailable.
   * Used by the WP02 metrics gauge.
   */
  lagSeconds(opts: { topic: string; groupId: string }): Promise<number>;
  readonly adapterName: string;
}

/** Adapter identifier used by `createProducer` / `createConsumer`. */
export type AdapterName = "in-memory" | "nats" | "redpanda" | "redis-streams";

/** Tenant-scoped header names (contract). */
export const HEADER_ORG_ID = "org_id";
export const HEADER_SCHEMA_VERSION = "schema_version";
export const HEADER_WIRE_FORMAT = "wire_format";
export const HEADER_IDEMPOTENCY_KEY = "idempotency_key";

/** Canonical topic names for the scale-readiness data plane. */
export const TOPIC_SPANS_V1 = "foxhound.spans.v1";
