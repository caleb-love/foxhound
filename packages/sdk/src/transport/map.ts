/**
 * Mapping layer between the SDK's internal `Trace` type (from
 * `@foxhound/types`) and the wire-format `TraceBatch` message (from
 * `@foxhound/proto` v1).
 *
 * Two things are worth calling out:
 *
 *   1. The internal `Trace` uses millisecond timestamps (`startTimeMs`);
 *      the Protobuf wire uses nanosecond Unix epoch. We convert here once,
 *      at the edge of the SDK, so the rest of the codebase never juggles
 *      units.
 *
 *   2. Foxhound-specific promoted fields (`agent_id`, `session_id`) are
 *      pulled from the Trace's top-level fields and from span metadata,
 *      respectively. `agent_id` is first-class on every span since WP15;
 *      per-span `agentId` overrides the trace-level default so a single
 *      trace can carry subagent attribution. `cost_usd_micros` is
 *      populated by WP16 via the time-series pricing table.
 */
import type { Span as FxSpan, SpanKind as FxSpanKind, Trace } from "@foxhound/types";
import { v1 } from "@foxhound/proto";

const SPAN_KIND_MAP: Readonly<Record<FxSpanKind, v1.SpanKind>> = {
  tool_call: v1.SpanKind.CLIENT,
  llm_call: v1.SpanKind.CLIENT,
  agent_step: v1.SpanKind.INTERNAL,
  workflow: v1.SpanKind.SERVER,
  custom: v1.SpanKind.INTERNAL,
};

const STATUS_MAP: Readonly<Record<"ok" | "error" | "unset", v1.StatusCode>> = {
  ok: v1.StatusCode.OK,
  error: v1.StatusCode.ERROR,
  unset: v1.StatusCode.UNSET,
};

function msToNanos(ms: number): string {
  // BigInt is unavoidable for nanosecond precision on int64.
  // Serialised as a string so protobufjs decodes it into int64 without
  // Number-precision loss.
  return (BigInt(Math.floor(ms)) * 1_000_000n).toString();
}

function attrValue(value: string | number | boolean | null): v1.AttributeValue | null {
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
    const encoded = attrValue(v);
    if (encoded !== null) out[k] = encoded;
  }
  return out;
}

export interface SpanToProtoOpts {
  /**
   * Trace-level agent scope. Used as the default for every span in the
   * trace. A non-empty `span.agentId` overrides this. Passed explicitly
   * so the map function stays pure and does not close over trace state.
   */
  readonly traceAgentId?: string;
}

export function spanToProtoSpan(span: FxSpan, orgId: string, opts: SpanToProtoOpts = {}): v1.Span {
  const endNanos =
    span.endTimeMs !== undefined ? msToNanos(span.endTimeMs) : msToNanos(span.startTimeMs);
  // Resolution order (WP15): span-level scope wins, falls back to the
  // trace-level default. Empty strings are treated as "not set" so the
  // wire carries proto3 field absence rather than a misleading empty id.
  const resolvedAgentId =
    span.agentId !== undefined && span.agentId !== ""
      ? span.agentId
      : opts.traceAgentId !== undefined && opts.traceAgentId !== ""
        ? opts.traceAgentId
        : undefined;
  const protoSpan: v1.Span = {
    orgId,
    traceId: span.traceId,
    spanId: span.spanId,
    ...(span.parentSpanId !== undefined ? { parentSpanId: span.parentSpanId } : {}),
    name: span.name,
    kind: SPAN_KIND_MAP[span.kind],
    startTimeUnixNano: msToNanos(span.startTimeMs),
    endTimeUnixNano: endNanos,
    status: { code: STATUS_MAP[span.status], message: "" },
    attributes: attrsToProto(span.attributes),
    events: span.events.map((e) => ({
      timeUnixNano: msToNanos(e.timeMs),
      name: e.name,
      attributes: attrsToProto(e.attributes),
    })),
    ...(resolvedAgentId !== undefined ? { agentId: resolvedAgentId } : {}),
  };
  return protoSpan;
}

export interface TraceToBatchOpts {
  readonly orgId?: string;
  readonly sdkLanguage?: string;
  readonly sdkVersion?: string;
}

export function traceToTraceBatch(trace: Trace, opts: TraceToBatchOpts = {}): v1.TraceBatch {
  // The internal Trace type has no explicit orgId; the API infers it from
  // the authenticated API key. We embed the hint here so downstream
  // processors (queue consumers, replay) can route without re-auth.
  const orgId = opts.orgId ?? "";
  // Thread trace-level agentId into the per-span mapper (WP15). A span
  // with its own explicit `agentId` still wins.
  const traceAgentId = trace.agentId !== "" ? trace.agentId : undefined;
  const spans = trace.spans.map((s) =>
    spanToProtoSpan(s, orgId, {
      ...(traceAgentId !== undefined ? { traceAgentId } : {}),
    }),
  );

  // batchId: monotonic-within-process millisecond-since-epoch. WP12
  // tightens this into a proper idempotency-key scheme.
  const batchId = Date.now();

  const batch: v1.TraceBatch = {
    schemaVersion: "v1",
    batchId,
    orgId,
    spans,
    ...(opts.sdkLanguage !== undefined ? { sdkLanguage: opts.sdkLanguage } : {}),
    ...(opts.sdkVersion !== undefined ? { sdkVersion: opts.sdkVersion } : {}),
  };
  return batch;
}
