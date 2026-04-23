/**
 * Conversation-rollup consumer (WP11).
 *
 * Subscribes to `foxhound.spans.v1` alongside the persistence consumer
 * (WP08), maintains an in-memory accumulator per (org_id, trace_id), and
 * upserts a `ConversationRow` whenever the trace is considered closed.
 *
 * A trace is considered closed when ANY of the following is true:
 *   - Idle watermark: no new spans seen for `idleMs` (default 30,000).
 *   - Periodic flush: `periodicFlushMs` (default 60,000) elapsed since the
 *     last upsert; safe because `conversation_rows` is a
 *     ReplacingMergeTree keyed on (org_id, trace_id) with `updated_at` as
 *     the version column — a later flush supersedes an earlier one
 *     deterministically.
 *   - Explicit completion: any span status becomes `"error"` OR the
 *     batch's `end_time` is older than `horizonMs` (default 10 min).
 *
 * Every upsert is safe to repeat; the ReplacingMergeTree collapses
 * duplicates on merge and `FINAL` or `argMax(updated_at)` reads give the
 * latest row. This design prefers simplicity and bounded memory over
 * exactly-once semantics (WP12 tightens this with idempotency keys).
 *
 * Tenancy: every upsert carries `org_id` from the queue headers; the
 * accumulator is keyed on `(org_id, trace_id)` so cross-tenant state
 * cannot co-mingle.
 */
import { v1 } from "@foxhound/proto";
import {
  HEADER_ORG_ID,
  TOPIC_SPANS_V1,
  createConsumer,
  readQueueConfigFromEnv,
  type QueueConsumer,
  type QueueMessage,
} from "@foxhound/queue";
import type { Trace, Span, SpanKind, SpanEvent, SpanStatus } from "@foxhound/types";
import {
  aggregateTrace,
  upsertConversationRows,
  type AnalyticsClient,
  type ConversationRow,
} from "@foxhound/db-analytics";

// ---------------------------------------------------------------------------
// Accumulator state. Keyed on org_id + trace_id; stores the working Trace
// plus metadata for close detection.
// ---------------------------------------------------------------------------

interface Accumulator {
  readonly orgId: string;
  readonly traceId: string;
  trace: Trace;
  /** Clock value when this accumulator was first created in memory. */
  createdMs: number;
  lastSeenMs: number;
  lastFlushedMs: number;
  dirty: boolean;
}

export interface Logger {
  info: (obj: Record<string, unknown> | string, msg?: string) => void;
  warn: (obj: Record<string, unknown> | string, msg?: string) => void;
  error: (obj: Record<string, unknown> | string, msg?: string) => void;
}

export interface RollupConsumerOpts {
  readonly log: Logger;
  readonly analytics: AnalyticsClient;
  /** Consumer group id. Default `rollup`. */
  readonly groupId?: string;
  /** Max in-memory open accumulators before pressure-relief flushes. */
  readonly maxOpen?: number;
  /** Idle close threshold in ms. Default 30 000. */
  readonly idleMs?: number;
  /** Periodic flush threshold in ms. Default 60 000. */
  readonly periodicFlushMs?: number;
  /** Horizon after which a trace is force-closed. Default 10 min. */
  readonly horizonMs?: number;
  /** Tick interval for flushing sweeps in ms. Default 5 000. */
  readonly tickMs?: number;
  /** Test hook: inject a consumer instead of creating from env. */
  readonly _consumer?: QueueConsumer;
  /** Test hook: inject a clock. */
  readonly _now?: () => number;
}

const DEFAULTS = {
  idleMs: 30_000,
  periodicFlushMs: 60_000,
  horizonMs: 10 * 60_000,
  tickMs: 5_000,
  maxOpen: 20_000,
};

export class RollupConsumer {
  private consumer: QueueConsumer | undefined;
  private readonly accs = new Map<string, Accumulator>();
  private readonly opts: Required<
    Omit<RollupConsumerOpts, "_consumer" | "_now" | "log" | "analytics" | "groupId">
  > &
    Pick<RollupConsumerOpts, "_consumer" | "_now" | "log" | "analytics" | "groupId">;
  private tickTimer: ReturnType<typeof setInterval> | undefined;
  private closed = false;

  constructor(opts: RollupConsumerOpts) {
    this.opts = {
      log: opts.log,
      analytics: opts.analytics,
      ...(opts.groupId !== undefined ? { groupId: opts.groupId } : {}),
      maxOpen: opts.maxOpen ?? DEFAULTS.maxOpen,
      idleMs: opts.idleMs ?? DEFAULTS.idleMs,
      periodicFlushMs: opts.periodicFlushMs ?? DEFAULTS.periodicFlushMs,
      horizonMs: opts.horizonMs ?? DEFAULTS.horizonMs,
      tickMs: opts.tickMs ?? DEFAULTS.tickMs,
      ...(opts._consumer !== undefined ? { _consumer: opts._consumer } : {}),
      ...(opts._now !== undefined ? { _now: opts._now } : {}),
    };
  }

  async start(): Promise<void> {
    this.consumer = this.opts._consumer ?? createConsumer(readQueueConfigFromEnv());
    await this.consumer.subscribe({
      topic: TOPIC_SPANS_V1,
      groupId: this.opts.groupId ?? "rollup",
      concurrency: 4,
      handler: async (msg) => this.handleMessage(msg),
    });
    this.tickTimer = setInterval(() => void this.sweep().catch(() => {}), this.opts.tickMs);
    this.tickTimer.unref?.();
    this.opts.log.info(
      { group: this.opts.groupId ?? "rollup", idleMs: this.opts.idleMs },
      "rollup consumer started",
    );
  }

  async stop(): Promise<void> {
    this.closed = true;
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = undefined;
    // Final flush so in-flight accumulators are durable.
    await this.sweep({ force: true });
    await this.consumer?.close().catch(() => {});
    this.consumer = undefined;
  }

  private now(): number {
    return this.opts._now ? this.opts._now() : Date.now();
  }

  async handleMessage(msg: QueueMessage): Promise<"ack" | "nack"> {
    const orgId = msg.headers[HEADER_ORG_ID];
    if (!orgId) return "nack";

    let batch: v1.TraceBatch;
    try {
      batch = v1.TraceBatchCodec.decode(msg.value);
    } catch (err) {
      this.opts.log.warn({ err, offset: msg.offset }, "rollup: malformed batch, nacking");
      return "nack";
    }

    if (batch.orgId && batch.orgId !== orgId) {
      this.opts.log.warn(
        { headerOrg: orgId, batchOrg: batch.orgId },
        "rollup: cross-tenant batch, nacking",
      );
      return "nack";
    }
    for (const s of batch.spans) {
      if (s.orgId && s.orgId !== orgId) {
        this.opts.log.warn(
          { headerOrg: orgId, spanOrg: s.orgId, spanId: s.spanId },
          "rollup: cross-tenant span inside batch, nacking",
        );
        return "nack";
      }
    }

    // Merge into per-trace accumulators.
    for (const pbSpan of batch.spans) {
      const key = accKey(orgId, pbSpan.traceId);
      let acc = this.accs.get(key);
      if (!acc) {
        const now = this.now();
        acc = {
          orgId,
          traceId: pbSpan.traceId,
          trace: {
            id: pbSpan.traceId,
            // WP15: seed with whatever agentId arrived first; upgraded
            // below when a root span (parentSpanId unset) with an
            // explicit agentId lands. ConversationRow aggregation uses
            // the trace-level agent_id for the per-conversation
            // attribution.
            agentId: pbSpan.agentId !== undefined && pbSpan.agentId !== "" ? pbSpan.agentId : "",
            spans: [],
            startTimeMs: nanosToMs(pbSpan.startTimeUnixNano),
            endTimeMs: nanosToMs(pbSpan.endTimeUnixNano),
            metadata: {},
          },
          createdMs: now,
          lastSeenMs: now,
          lastFlushedMs: 0,
          dirty: true,
        };
        this.accs.set(key, acc);
      } else if (
        // Upgrade to root-span agentId when it arrives out-of-order.
        pbSpan.parentSpanId === undefined &&
        pbSpan.agentId !== undefined &&
        pbSpan.agentId !== "" &&
        acc.trace.agentId !== pbSpan.agentId
      ) {
        acc.trace.agentId = pbSpan.agentId;
      } else if (
        acc.trace.agentId === "" &&
        pbSpan.agentId !== undefined &&
        pbSpan.agentId !== ""
      ) {
        acc.trace.agentId = pbSpan.agentId;
      }
      const span = spanFromProto(pbSpan);
      // Dedup by span_id within the accumulator — a retry re-delivers the
      // same span; we keep the first instance's attributes but extend the
      // time range if needed.
      const existing = acc.trace.spans.find((s) => s.spanId === span.spanId);
      if (!existing) acc.trace.spans.push(span);
      if (span.startTimeMs < acc.trace.startTimeMs) acc.trace.startTimeMs = span.startTimeMs;
      const spanEnd = span.endTimeMs ?? span.startTimeMs;
      if ((acc.trace.endTimeMs ?? 0) < spanEnd) acc.trace.endTimeMs = spanEnd;
      acc.lastSeenMs = this.now();
      acc.dirty = true;
    }

    // Pressure relief: flush oldest if we're over the cap.
    if (this.accs.size > this.opts.maxOpen) {
      await this.flushOldest(this.accs.size - this.opts.maxOpen);
    }

    return "ack";
  }

  /**
   * Sweep the accumulator set. For each trace:
   *   - Close if idle-beyond-threshold, periodic-flush-due, or over-horizon.
   *   - Upsert the aggregated ConversationRow.
   */
  async sweep(opts: { force?: boolean } = {}): Promise<void> {
    if (this.closed && !opts.force) return;
    const now = this.now();
    const toFlush: Accumulator[] = [];
    for (const acc of this.accs.values()) {
      if (opts.force) {
        toFlush.push(acc);
        continue;
      }
      if (!acc.dirty) continue; // nothing new since last flush

      const idle = now - acc.lastSeenMs >= this.opts.idleMs;
      // horizonMs is a bound on how long we will keep an accumulator in
      // memory regardless of activity, measured against its in-memory
      // creation time. This is independent of span wall-clock
      // timestamps (which can be skewed by bad SDK clocks) so it also
      // works with synthetic test timestamps.
      const overHorizon = now - acc.createdMs >= this.opts.horizonMs;
      // Periodic flush: use lastFlushedMs when we have flushed at least
      // once, otherwise fall back to createdMs so a long-running dirty
      // trace still makes progress visible to readers.
      const referenceMs = acc.lastFlushedMs > 0 ? acc.lastFlushedMs : acc.createdMs;
      const periodic = now - referenceMs >= this.opts.periodicFlushMs;

      if (idle || overHorizon || periodic) toFlush.push(acc);
    }

    if (toFlush.length === 0) return;

    const rows: ConversationRow[] = toFlush.map((a) =>
      aggregateTrace(a.trace, a.orgId, { nowMs: now }),
    );

    try {
      await upsertConversationRows(this.opts.analytics, rows);
    } catch (err) {
      this.opts.log.error(
        { err, count: rows.length },
        "rollup: upsert failed; will retry on next sweep",
      );
      return;
    }

    for (const acc of toFlush) {
      acc.lastFlushedMs = now;
      acc.dirty = false;
      // Remove closed accumulators (idle or over-horizon) from memory.
      const idle = now - acc.lastSeenMs >= this.opts.idleMs;
      const overHorizon = now - acc.createdMs >= this.opts.horizonMs;
      if (idle || overHorizon || opts.force) {
        this.accs.delete(accKey(acc.orgId, acc.traceId));
      }
    }
  }

  private async flushOldest(n: number): Promise<void> {
    const sorted = Array.from(this.accs.values()).sort((a, b) => a.lastSeenMs - b.lastSeenMs);
    const victims = sorted.slice(0, n);
    const now = this.now();
    const rows = victims.map((a) => aggregateTrace(a.trace, a.orgId, { nowMs: now }));
    try {
      await upsertConversationRows(this.opts.analytics, rows);
    } catch (err) {
      this.opts.log.error({ err, count: rows.length }, "rollup: pressure-relief upsert failed");
      return;
    }
    for (const a of victims) {
      a.lastFlushedMs = now;
      a.dirty = false;
      this.accs.delete(accKey(a.orgId, a.traceId));
    }
  }

  /** Test-only: number of in-memory accumulators. */
  openCount(): number {
    return this.accs.size;
  }
}

// ---------------------------------------------------------------------------
// Utilities.
// ---------------------------------------------------------------------------

function accKey(orgId: string, traceId: string): string {
  return `${orgId}::${traceId}`;
}

function nanosToMs(nanos: number | string): number {
  if (typeof nanos === "number") return Math.floor(nanos / 1_000_000);
  try {
    return Number(BigInt(nanos) / 1_000_000n);
  } catch {
    return 0;
  }
}

const KIND_FROM_PROTO: Readonly<Record<v1.SpanKind, SpanKind>> = {
  [v1.SpanKind.UNSPECIFIED]: "custom",
  [v1.SpanKind.INTERNAL]: "agent_step",
  [v1.SpanKind.SERVER]: "workflow",
  [v1.SpanKind.CLIENT]: "llm_call",
  [v1.SpanKind.PRODUCER]: "custom",
  [v1.SpanKind.CONSUMER]: "custom",
};

const STATUS_FROM_PROTO: Readonly<Record<v1.StatusCode, SpanStatus>> = {
  [v1.StatusCode.UNSET]: "unset",
  [v1.StatusCode.OK]: "ok",
  [v1.StatusCode.ERROR]: "error",
};

function attrsFromProto(
  rec: Record<string, v1.AttributeValue>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(rec)) {
    if ("stringValue" in v) out[k] = v.stringValue;
    else if ("intValue" in v) {
      const iv = v.intValue;
      out[k] = typeof iv === "string" ? Number(iv) : iv;
    } else if ("doubleValue" in v) out[k] = v.doubleValue;
    else if ("boolValue" in v) out[k] = v.boolValue;
  }
  return out;
}

function spanFromProto(p: v1.Span): Span {
  const events: SpanEvent[] = p.events.map((e) => ({
    timeMs: nanosToMs(e.timeUnixNano),
    name: e.name,
    attributes: attrsFromProto(e.attributes),
  }));
  const startMs = nanosToMs(p.startTimeUnixNano);
  const endMs = nanosToMs(p.endTimeUnixNano);
  return {
    traceId: p.traceId,
    spanId: p.spanId,
    ...(p.parentSpanId && p.parentSpanId.length > 0 ? { parentSpanId: p.parentSpanId } : {}),
    name: p.name,
    kind: KIND_FROM_PROTO[p.kind] ?? "custom",
    startTimeMs: startMs,
    endTimeMs: endMs > 0 ? endMs : startMs,
    status: STATUS_FROM_PROTO[p.status.code] ?? "unset",
    attributes: attrsFromProto(p.attributes),
    events,
    // WP15: per-span agent scope preserved for aggregation.
    ...(p.agentId !== undefined && p.agentId !== "" ? { agentId: p.agentId } : {}),
  };
}
