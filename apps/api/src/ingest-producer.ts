/**
 * Edge-side durable-queue producer (WP08).
 *
 * Enabled via `FOXHOUND_USE_QUEUE` env flag:
 *   unset / "false" / "0" → legacy path (synchronous persist via trace-buffer)
 *   "true" or any adapter name → queue produce + 202 return; persistence runs
 *                                in a worker consumer group (apps/worker)
 *
 * Topic: `foxhound.spans.v1` (see `@foxhound/queue`).
 * Partition key: `trace_id` — preserves per-trace ordering across consumers.
 * Body: Protobuf-encoded `TraceBatch` (one trace per message in this cycle).
 * Headers: `org_id` (mandatory), `schema_version=v1`, `wire_format=protobuf`,
 *          `idempotency_key=<trace_id>:<batch_id>` (WP12 will expand).
 *
 * This module is the ONLY place in the API that knows about the queue; the
 * route handler depends on `enqueueTrace()` and does not import `@foxhound/queue`
 * directly. Swapping adapters or removing the feature entirely is localised.
 */
import { v1 } from "@foxhound/proto";
import type { Span as FxSpan, SpanKind as FxSpanKind, SpanStatus, Trace } from "@foxhound/types";
import {
  createProducer,
  readQueueConfigFromEnv,
  HEADER_ORG_ID,
  HEADER_SCHEMA_VERSION,
  HEADER_WIRE_FORMAT,
  HEADER_IDEMPOTENCY_KEY,
  TOPIC_SPANS_V1,
  type QueueProducer,
} from "@foxhound/queue";

// ---------------------------------------------------------------------------
// Local Trace → v1.Span mapping. Kept inline here because the edge API
// must not depend on `@foxhound-ai/sdk` (dependency direction is SDK → API).
// The canonical SDK-side equivalent lives in packages/sdk/src/transport/map.ts;
// a parity test in apps/api/src/ingest-producer.test.ts pins them together.
// ---------------------------------------------------------------------------

const SPAN_KIND_MAP: Readonly<Record<FxSpanKind, v1.SpanKind>> = {
  tool_call: v1.SpanKind.CLIENT,
  llm_call: v1.SpanKind.CLIENT,
  agent_step: v1.SpanKind.INTERNAL,
  workflow: v1.SpanKind.SERVER,
  custom: v1.SpanKind.INTERNAL,
};

const STATUS_MAP: Readonly<Record<SpanStatus, v1.StatusCode>> = {
  ok: v1.StatusCode.OK,
  error: v1.StatusCode.ERROR,
  unset: v1.StatusCode.UNSET,
};

function msToNanos(ms: number): string {
  return (BigInt(Math.floor(ms)) * 1_000_000n).toString();
}

function attrToProto(value: string | number | boolean | null): v1.AttributeValue | null {
  if (value === null) return null;
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { boolValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { intValue: value } : { doubleValue: value };
  }
  return null;
}

function attrsToProto(
  attrs: Record<string, string | number | boolean | null>,
): Record<string, v1.AttributeValue> {
  const out: Record<string, v1.AttributeValue> = {};
  for (const [k, v] of Object.entries(attrs)) {
    const enc = attrToProto(v);
    if (enc !== null) out[k] = enc;
  }
  return out;
}

function spanToProto(span: FxSpan, orgId: string): v1.Span {
  const endMs = span.endTimeMs ?? span.startTimeMs;
  return {
    orgId,
    traceId: span.traceId,
    spanId: span.spanId,
    ...(span.parentSpanId !== undefined ? { parentSpanId: span.parentSpanId } : {}),
    name: span.name,
    kind: SPAN_KIND_MAP[span.kind],
    startTimeUnixNano: msToNanos(span.startTimeMs),
    endTimeUnixNano: msToNanos(endMs),
    status: { code: STATUS_MAP[span.status], message: "" },
    attributes: attrsToProto(span.attributes),
    events: span.events.map((e) => ({
      timeUnixNano: msToNanos(e.timeMs),
      name: e.name,
      attributes: attrsToProto(e.attributes),
    })),
  };
}

/** Producer singleton; lazily constructed on first enqueue. */
let producer: QueueProducer | undefined;

export function isQueueIngestEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env["FOXHOUND_USE_QUEUE"]?.trim().toLowerCase();
  if (!raw) return false;
  if (raw === "false" || raw === "0" || raw === "off") return false;
  return true;
}

export function getIngestProducer(): QueueProducer {
  if (!producer) {
    const cfg = readQueueConfigFromEnv();
    producer = createProducer(cfg);
  }
  return producer;
}

export async function closeIngestProducer(): Promise<void> {
  if (producer) {
    await producer.close().catch(() => {});
    producer = undefined;
  }
}

/**
 * Build the `foxhound.v1.TraceBatch` wire body from an internal Trace.
 * Kept separate from the enqueue call so tests can snapshot the payload
 * shape without needing a running producer.
 */
export function buildIngestPayload(trace: Trace, orgId: string): {
  readonly key: string;
  readonly value: Uint8Array;
  readonly headers: Record<string, string>;
} {
  // Build a single-trace batch. WP07 (trace-joining middleware) may batch
  // multiple traces per message; today a 1:1 mapping is correct.
  const batch: v1.TraceBatch = {
    schemaVersion: "v1",
    batchId: Date.now(),
    orgId,
    sdkLanguage: "edge",
    sdkVersion: "ingest-enqueue",
    spans: trace.spans.map((s) => spanToProto(s, orgId)),
  };
  // Note: in the current pipeline the API is the boundary where `orgId`
  // is authoritative (set by the auth middleware); we never trust the
  // client-declared orgId.
  const value = v1.TraceBatchCodec.encode(batch);
  return {
    key: trace.id,
    value,
    headers: {
      [HEADER_ORG_ID]: orgId,
      [HEADER_SCHEMA_VERSION]: "v1",
      [HEADER_WIRE_FORMAT]: "protobuf",
      [HEADER_IDEMPOTENCY_KEY]: `${trace.id}:${batch.batchId}`,
    },
  };
}

/**
 * Enqueue an internal Trace onto the durable queue. Returns once the
 * producer has accepted the record (the adapter decides what "accepted"
 * means — for Redpanda with `idempotent: true` it is broker-ACK'd).
 */
export async function enqueueTrace(trace: Trace, orgId: string): Promise<void> {
  const { key, value, headers } = buildIngestPayload(trace, orgId);
  await getIngestProducer().produce({
    topic: TOPIC_SPANS_V1,
    key,
    value,
    headers,
  });
}

// Test hook: exported for ingest-producer.test.ts.
export { spanToProto as _spanToProtoForTests };
