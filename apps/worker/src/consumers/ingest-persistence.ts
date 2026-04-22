/**
 * Durable-queue persistence consumer (WP08).
 *
 * Consumes `foxhound.spans.v1` produced by the edge API's `ingest-producer`,
 * decodes the Protobuf `TraceBatch`, and persists via `@foxhound/db`. This
 * replaces the API's synchronous Postgres write once `FOXHOUND_USE_QUEUE`
 * is enabled on the edge.
 *
 * Tenancy: re-asserts `msg.headers.org_id === batch.orgId === span.orgId`
 * before any DB write. Mismatch is a protocol violation from a compromised
 * producer and the message is nacked (dropped onto the dead-letter path
 * when the adapter supports one; today, redelivered until it succeeds or
 * the retention window expires).
 *
 * Metrics (WP02): publishes consumer-group lag via the shared metrics
 * gauge. The worker process exposes its own `/metrics` endpoint (not in
 * this file) that scrapes this consumer.
 */
import { v1 } from "@foxhound/proto";

/**
 * Minimal structured-logger interface compatible with both Fastify's pino
 * logger and test doubles. Kept local so the worker does not take a runtime
 * dep on `fastify`.
 */
export interface Logger {
  info: (obj: Record<string, unknown> | string, msg?: string) => void;
  warn: (obj: Record<string, unknown> | string, msg?: string) => void;
  error: (obj: Record<string, unknown> | string, msg?: string) => void;
}
import {
  createConsumer,
  readQueueConfigFromEnv,
  HEADER_ORG_ID,
  TOPIC_SPANS_V1,
  type QueueConsumer,
  type QueueMessage,
} from "@foxhound/queue";
import type { Span, SpanEvent, SpanKind, SpanStatus, Trace } from "@foxhound/types";

const CONSUMER_GROUP = "persistence";
const LAG_POLL_INTERVAL_MS = 10_000;

type PersistFn = (log: Logger, trace: Trace, orgId: string) => Promise<void>;
type MetricsHook = (opts: { consumer: string; lagSeconds: number }) => void;

export interface IngestPersistenceConsumerOpts {
  readonly log: Logger;
  readonly persist: PersistFn;
  readonly metrics?: MetricsHook;
}

export class IngestPersistenceConsumer {
  private consumer: QueueConsumer | undefined;
  private lagTimer: ReturnType<typeof setInterval> | undefined;
  private readonly opts: IngestPersistenceConsumerOpts;

  constructor(opts: IngestPersistenceConsumerOpts) {
    this.opts = opts;
  }

  async start(): Promise<void> {
    const cfg = readQueueConfigFromEnv();
    this.consumer = createConsumer(cfg);
    await this.consumer.subscribe({
      topic: TOPIC_SPANS_V1,
      groupId: CONSUMER_GROUP,
      concurrency: 4,
      handler: async (msg) => this.handleMessage(msg),
    });

    if (this.opts.metrics) {
      // Periodically publish lag to the WP02 metrics gauge.
      this.lagTimer = setInterval(() => {
        void this.publishLag();
      }, LAG_POLL_INTERVAL_MS);
      this.lagTimer.unref?.();
    }
    this.opts.log.info(
      { adapter: this.consumer.adapterName, topic: TOPIC_SPANS_V1, group: CONSUMER_GROUP },
      "ingest-persistence consumer started",
    );
  }

  async stop(): Promise<void> {
    if (this.lagTimer) clearInterval(this.lagTimer);
    this.lagTimer = undefined;
    await this.consumer?.close().catch(() => {});
    this.consumer = undefined;
  }

  private async publishLag(): Promise<void> {
    if (!this.consumer || !this.opts.metrics) return;
    const lag = await this.consumer.lagSeconds({
      topic: TOPIC_SPANS_V1,
      groupId: CONSUMER_GROUP,
    });
    if (lag >= 0) this.opts.metrics({ consumer: CONSUMER_GROUP, lagSeconds: lag });
  }

  async handleMessage(msg: QueueMessage): Promise<"ack" | "nack"> {
    const headerOrg = msg.headers[HEADER_ORG_ID];
    if (!headerOrg) {
      this.opts.log.warn({ offset: msg.offset }, "dropping message without org_id header");
      return "nack";
    }

    let batch: v1.TraceBatch;
    try {
      batch = v1.TraceBatchCodec.decode(msg.value);
    } catch (err) {
      this.opts.log.warn({ err, offset: msg.offset }, "malformed TraceBatch; nacking");
      return "nack";
    }

    // Tenant re-check: batch and every span must match the header org.
    if (batch.orgId && batch.orgId !== headerOrg) {
      this.opts.log.warn(
        { headerOrg, batchOrg: batch.orgId, offset: msg.offset },
        "cross-tenant batch detected; nacking",
      );
      return "nack";
    }
    for (const s of batch.spans) {
      if (s.orgId && s.orgId !== headerOrg) {
        this.opts.log.warn(
          { headerOrg, spanOrg: s.orgId, spanId: s.spanId },
          "cross-tenant span detected inside batch; nacking whole batch",
        );
        return "nack";
      }
    }

    // Group spans by traceId and build internal Trace values.
    const traces = groupBatchIntoTraces(batch);
    for (const trace of traces) {
      try {
        await this.opts.persist(this.opts.log, trace, headerOrg);
      } catch (err) {
        this.opts.log.error(
          { err, traceId: trace.id, orgId: headerOrg, offset: msg.offset },
          "persist failed; will redeliver",
        );
        throw err; // triggers adapter redelivery
      }
    }
    return "ack";
  }
}

// ---------------------------------------------------------------------------
// Proto → internal Trace mapping. A copy of apps/api/src/routes/traces-proto.ts
// kept local so the worker does not import from the API bundle.
// ---------------------------------------------------------------------------

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

function nanosToMs(nanos: number | string): number {
  if (typeof nanos === "number") return Math.floor(nanos / 1_000_000);
  try {
    return Number(BigInt(nanos) / 1_000_000n);
  } catch {
    return 0;
  }
}

function attrFromProto(v: v1.AttributeValue): string | number | boolean | null {
  if ("stringValue" in v) return v.stringValue;
  if ("intValue" in v) {
    const iv = v.intValue;
    return typeof iv === "string" ? Number(iv) : iv;
  }
  if ("doubleValue" in v) return v.doubleValue;
  if ("boolValue" in v) return v.boolValue;
  return null;
}

function attrsFromProto(
  rec: Record<string, v1.AttributeValue>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(rec)) out[k] = attrFromProto(v);
  return out;
}

function spanFromProto(p: v1.Span): Span {
  const events: SpanEvent[] = p.events.map((e) => ({
    timeMs: nanosToMs(e.timeUnixNano),
    name: e.name,
    attributes: attrsFromProto(e.attributes),
  }));
  const endMs = nanosToMs(p.endTimeUnixNano);
  const startMs = nanosToMs(p.startTimeUnixNano);
  return {
    traceId: p.traceId,
    spanId: p.spanId,
    ...(p.parentSpanId !== undefined && p.parentSpanId.length > 0
      ? { parentSpanId: p.parentSpanId }
      : {}),
    name: p.name,
    kind: KIND_FROM_PROTO[p.kind] ?? "custom",
    startTimeMs: startMs,
    endTimeMs: endMs > 0 ? endMs : startMs,
    status: STATUS_FROM_PROTO[p.status.code] ?? "unset",
    attributes: attrsFromProto(p.attributes),
    events,
    // WP15: per-span agent scope, preserved from the wire for the
    // persistence layer to filter/aggregate by agent.
    ...(p.agentId !== undefined && p.agentId !== "" ? { agentId: p.agentId } : {}),
  };
}

export function groupBatchIntoTraces(batch: v1.TraceBatch): Trace[] {
  // WP15: recover the trace-level agentId by taking the root span's
  // agentId when available, otherwise the first non-empty agentId in
  // document order. Spans with no agentId inherit the trace-level value
  // at query time (ClickHouse column already allows NULL). A single
  // trace may legitimately have multiple subagents; the trace-level id
  // is the "primary agent" in that case and per-span `agentId` still
  // wins at the span granularity.
  type Acc = {
    spans: Span[];
    minStart: number;
    maxEnd: number;
    agentId: string;
    rootAgentSeen: boolean;
  };
  const byTrace = new Map<string, Acc>();
  for (const pb of batch.spans) {
    const span = spanFromProto(pb);
    const existing = byTrace.get(span.traceId);
    const spanIsRoot = span.parentSpanId === undefined;
    const spanAgent = span.agentId ?? "";
    if (existing) {
      existing.spans.push(span);
      if (span.startTimeMs < existing.minStart) existing.minStart = span.startTimeMs;
      if (span.endTimeMs !== undefined && span.endTimeMs > existing.maxEnd) {
        existing.maxEnd = span.endTimeMs;
      }
      // Upgrade the trace-level agentId only if (a) the root span names
      // one and the root hasn't been seen yet, or (b) we haven't
      // recovered any non-empty id at all. This preserves
      // root-wins-over-arrival-order without changing the id once a root
      // has set it.
      if (spanIsRoot && !existing.rootAgentSeen && spanAgent !== "") {
        existing.agentId = spanAgent;
        existing.rootAgentSeen = true;
      } else if (!existing.rootAgentSeen && existing.agentId === "" && spanAgent !== "") {
        existing.agentId = spanAgent;
      }
    } else {
      byTrace.set(span.traceId, {
        spans: [span],
        minStart: span.startTimeMs,
        maxEnd: span.endTimeMs ?? span.startTimeMs,
        agentId: spanAgent,
        rootAgentSeen: spanIsRoot && spanAgent !== "",
      });
    }
  }
  const traces: Trace[] = [];
  for (const [traceId, acc] of byTrace) {
    traces.push({
      id: traceId,
      agentId: acc.agentId,
      spans: acc.spans,
      startTimeMs: acc.minStart,
      endTimeMs: acc.maxEnd,
      metadata: {
        "foxhound.schema_version": "v1",
        "foxhound.wire_format": "protobuf",
        ...(batch.sdkLanguage ? { "sdk.language": batch.sdkLanguage } : {}),
        ...(batch.sdkVersion ? { "sdk.version": batch.sdkVersion } : {}),
      },
    });
  }
  return traces;
}
