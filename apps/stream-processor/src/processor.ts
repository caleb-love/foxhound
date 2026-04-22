/**
 * Stream processor (WP14).
 *
 * Subscribes to `foxhound.spans.v1` under its own consumer group
 * (`stream-processor`), decodes each `TraceBatch`, re-asserts tenant
 * scoping, fans each span out to the registered handlers, and — by
 * accumulating spans per (orgId, traceId) under a wall-clock trace-close
 * policy — emits `onTraceClose` to each handler when a trace is deemed
 * closed.
 *
 * Trace-close policy mirrors the WP11 rollup consumer (proven in
 * session 6): idle / periodic / horizon triggers measured against
 * accumulator clocks the processor owns, never span timestamps. See
 * `docs/reference/typescript-patterns.md#pattern-9`.
 *
 * Alert latency budget (WP14 gate):
 *   - Budget breach: < 5 s  — fires inside `onSpan`, so latency is
 *     bounded by consumer + handler + notifier round-trips.
 *   - Regression: < 60 s    — fires inside `onTraceClose`.
 *   - SLA breach:   < 60 s  — fires inside `onTraceClose`.
 *   - Alert delivery p99:  < 2 s after emit — delegated to
 *     `@foxhound/notifications.dispatchAlert` (in-process HTTP).
 *
 * State bound: at most `maxOpenTraces` accumulators in memory; pressure
 * relief is force-close-oldest. Per-handler state is handler-owned.
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
import type {
  Span,
  SpanEvent,
  SpanKind,
  SpanStatus,
  Trace,
} from "@foxhound/types";
import type {
  SpanHandler,
  SpanObservation,
  TraceCloseObservation,
} from "./handlers/types.js";

export interface Logger {
  info: (obj: Record<string, unknown> | string, msg?: string) => void;
  warn: (obj: Record<string, unknown> | string, msg?: string) => void;
  error: (obj: Record<string, unknown> | string, msg?: string) => void;
}

export interface StreamProcessorOptions {
  readonly log: Logger;
  readonly handlers: readonly SpanHandler[];
  readonly groupId?: string;
  readonly idleMs?: number;
  readonly periodicMs?: number;
  readonly horizonMs?: number;
  readonly tickMs?: number;
  readonly maxOpenTraces?: number;
  /** Test hook: inject a consumer instead of creating from env. */
  readonly _consumer?: QueueConsumer;
  /** Test hook: inject a clock. */
  readonly _now?: () => number;
}

interface TraceAccumulator {
  readonly orgId: string;
  readonly traceId: string;
  agentId: string;
  trace: Trace;
  createdMs: number;
  lastSeenMs: number;
}

const DEFAULTS = {
  idleMs: 10_000, // real-time bias: close faster than WP11's 30 s
  periodicMs: 30_000,
  horizonMs: 5 * 60_000,
  tickMs: 1_000, // 1 s ticks keep budget-breach latency < 5 s
  maxOpenTraces: 50_000,
};

const CONSUMER_GROUP = "stream-processor";

export class StreamProcessor {
  private consumer: QueueConsumer | undefined;
  private readonly accs = new Map<string, TraceAccumulator>();
  private tickTimer: ReturnType<typeof setInterval> | undefined;
  private closed = false;
  private readonly opts: Required<
    Omit<StreamProcessorOptions, "_consumer" | "_now" | "log" | "handlers" | "groupId">
  > & {
    readonly log: Logger;
    readonly handlers: readonly SpanHandler[];
    readonly groupId: string;
    readonly _consumer?: QueueConsumer;
    readonly _now?: () => number;
  };

  constructor(opts: StreamProcessorOptions) {
    this.opts = {
      log: opts.log,
      handlers: opts.handlers,
      groupId: opts.groupId ?? CONSUMER_GROUP,
      idleMs: opts.idleMs ?? DEFAULTS.idleMs,
      periodicMs: opts.periodicMs ?? DEFAULTS.periodicMs,
      horizonMs: opts.horizonMs ?? DEFAULTS.horizonMs,
      tickMs: opts.tickMs ?? DEFAULTS.tickMs,
      maxOpenTraces: opts.maxOpenTraces ?? DEFAULTS.maxOpenTraces,
      ...(opts._consumer !== undefined ? { _consumer: opts._consumer } : {}),
      ...(opts._now !== undefined ? { _now: opts._now } : {}),
    };
  }

  private now(): number {
    return this.opts._now ? this.opts._now() : Date.now();
  }

  async start(): Promise<void> {
    this.consumer = this.opts._consumer ?? createConsumer(readQueueConfigFromEnv());
    await this.consumer.subscribe({
      topic: TOPIC_SPANS_V1,
      groupId: this.opts.groupId,
      concurrency: 8,
      handler: async (msg) => this.handleMessage(msg),
    });
    this.tickTimer = setInterval(() => void this.tick().catch(() => {}), this.opts.tickMs);
    this.tickTimer.unref?.();
    this.opts.log.info(
      {
        group: this.opts.groupId,
        handlers: this.opts.handlers.map((h) => h.name),
        idleMs: this.opts.idleMs,
        tickMs: this.opts.tickMs,
      },
      "stream-processor started",
    );
  }

  async stop(): Promise<void> {
    this.closed = true;
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = undefined;
    await this.tick({ force: true });
    await this.consumer?.close().catch(() => {});
    this.consumer = undefined;
  }

  /** Test/metrics hook: number of open accumulators. */
  openCount(): number {
    return this.accs.size;
  }

  async handleMessage(msg: QueueMessage): Promise<"ack" | "nack"> {
    const orgId = msg.headers[HEADER_ORG_ID];
    if (!orgId) {
      this.opts.log.warn({ offset: msg.offset }, "stream: missing org_id; nacking");
      return "nack";
    }

    let batch: v1.TraceBatch;
    try {
      batch = v1.TraceBatchCodec.decode(msg.value);
    } catch (err) {
      this.opts.log.warn({ err, offset: msg.offset }, "stream: malformed batch; nacking");
      return "nack";
    }

    // Tenant re-check: batch.orgId and every span.orgId must match the header.
    if (batch.orgId && batch.orgId !== orgId) {
      this.opts.log.warn({ headerOrg: orgId, batchOrg: batch.orgId }, "stream: cross-tenant batch");
      return "nack";
    }
    for (const s of batch.spans) {
      if (s.orgId && s.orgId !== orgId) {
        this.opts.log.warn(
          { headerOrg: orgId, spanOrg: s.orgId, spanId: s.spanId },
          "stream: cross-tenant span; nacking batch",
        );
        return "nack";
      }
    }

    const observedMs = this.now();
    for (const pbSpan of batch.spans) {
      const span = spanFromProto(pbSpan);
      const agentId = extractAgentId(pbSpan, batch);
      const obs: SpanObservation = {
        orgId,
        agentId,
        traceId: span.traceId,
        span,
        observedMs,
      };

      // Fan out to handlers first; handlers own their own state and
      // may fire alerts inline (e.g. budget breach).
      await Promise.allSettled(this.opts.handlers.map((h) => h.onSpan(obs)));

      // Merge into per-trace accumulator for the trace-close fanout.
      const key = accKey(orgId, span.traceId);
      let acc = this.accs.get(key);
      if (!acc) {
        acc = {
          orgId,
          traceId: span.traceId,
          agentId,
          trace: {
            id: span.traceId,
            agentId,
            spans: [],
            startTimeMs: span.startTimeMs,
            endTimeMs: span.endTimeMs ?? span.startTimeMs,
            metadata: {},
          },
          createdMs: observedMs,
          lastSeenMs: observedMs,
        };
        this.accs.set(key, acc);
      }
      // Dedup by span_id within the accumulator (retry safety).
      if (!acc.trace.spans.some((s) => s.spanId === span.spanId)) {
        acc.trace.spans.push(span);
      }
      if (span.startTimeMs < acc.trace.startTimeMs) acc.trace.startTimeMs = span.startTimeMs;
      const end = span.endTimeMs ?? span.startTimeMs;
      if ((acc.trace.endTimeMs ?? 0) < end) acc.trace.endTimeMs = end;
      if (!acc.agentId && agentId) {
        acc.agentId = agentId;
        acc.trace = { ...acc.trace, agentId };
      }
      acc.lastSeenMs = observedMs;
    }

    // Pressure relief.
    if (this.accs.size > this.opts.maxOpenTraces) {
      await this.flushOldest(this.accs.size - this.opts.maxOpenTraces);
    }
    return "ack";
  }

  /**
   * Periodic sweep. Closes traces meeting any trigger and calls
   * onTraceClose on every registered handler. Also calls `onTick` on
   * every handler so handlers can prune their own state.
   */
  async tick(opts: { force?: boolean } = {}): Promise<void> {
    if (this.closed && !opts.force) return;
    const now = this.now();
    const toClose: { acc: TraceAccumulator; reason: TraceCloseObservation["reason"] }[] = [];

    for (const acc of this.accs.values()) {
      if (opts.force) {
        toClose.push({ acc, reason: "force" });
        continue;
      }
      const idle = now - acc.lastSeenMs >= this.opts.idleMs;
      const periodic = now - acc.createdMs >= this.opts.periodicMs;
      const horizon = now - acc.createdMs >= this.opts.horizonMs;
      if (horizon) toClose.push({ acc, reason: "horizon" });
      else if (idle) toClose.push({ acc, reason: "idle" });
      else if (periodic) toClose.push({ acc, reason: "periodic" });
    }

    for (const { acc, reason } of toClose) {
      const obs: TraceCloseObservation = {
        orgId: acc.orgId,
        agentId: acc.agentId,
        traceId: acc.traceId,
        trace: acc.trace,
        observedMs: now,
        reason,
      };
      await Promise.allSettled(this.opts.handlers.map((h) => h.onTraceClose(obs)));
      if (reason !== "periodic") this.accs.delete(accKey(acc.orgId, acc.traceId));
    }

    // Let handlers prune their own state.
    await Promise.allSettled(this.opts.handlers.map((h) => h.onTick?.(now)));
  }

  private async flushOldest(n: number): Promise<void> {
    const sorted = Array.from(this.accs.values()).sort((a, b) => a.lastSeenMs - b.lastSeenMs);
    const victims = sorted.slice(0, n);
    const now = this.now();
    for (const acc of victims) {
      const obs: TraceCloseObservation = {
        orgId: acc.orgId,
        agentId: acc.agentId,
        traceId: acc.traceId,
        trace: acc.trace,
        observedMs: now,
        reason: "force",
      };
      await Promise.allSettled(this.opts.handlers.map((h) => h.onTraceClose(obs)));
      this.accs.delete(accKey(acc.orgId, acc.traceId));
    }
  }
}

// ---------------------------------------------------------------------------
// Proto → internal Span mapping. Inlined from the worker's rollup consumer
// so this app doesn't import from another app's bundle.
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
  };
}

function extractAgentId(span: v1.Span, batch: v1.TraceBatch): string {
  const a = span.attributes["agent.id"];
  if (a && "stringValue" in a && a.stringValue) return a.stringValue;
  // Fallback: SDK-level agent id is not on batch today; leave blank.
  void batch;
  return "";
}
