/**
 * Protobuf decode layer for the `/v1/traces` ingest endpoint.
 *
 * Defined separately from the JSON handler in `traces.ts` so:
 *   (a) the JSON handler remains untouched and existing tests keep passing,
 *   (b) Protobuf-specific decoding concerns (tenant-mismatch, schema-version)
 *       live in one well-named place,
 *   (c) future WPs that promote `TraceBatch` from wire format to first-class
 *       internal type (WP08 queue payload) have a single entry point.
 *
 * The actual route registration is in `traces.ts` — it calls
 * `maybeDecodeProtoBatch(request, orgId)` before the Zod JSON parse. If the
 * content-type indicates Protobuf, this function returns a `Trace` ready for
 * the existing persistence path; otherwise it returns `null` and the caller
 * falls through to JSON.
 */
import type { FastifyRequest } from "fastify";
import { v1 } from "@foxhound/proto";
import type { Span, SpanEvent, SpanKind, SpanStatus, Trace } from "@foxhound/types";
import { decompressIfNeeded } from "../middleware/decompress.js";

export type ProtoDecodeResult =
  | {
      ok: true;
      trace: Trace;
      wireBytes: number;
      schemaVersion: string;
      /** WP05: which `Content-Encoding` was honored on the inbound request. */
      contentEncoding: "gzip" | "none";
    }
  | { ok: false; status: number; error: string; message: string };

const CONTENT_TYPES_PROTOBUF = new Set([
  "application/x-protobuf",
  "application/vnd.google.protobuf",
]);

export function isProtobufRequest(request: FastifyRequest): boolean {
  const ct = request.headers["content-type"] ?? "";
  const base = ct.split(";")[0]?.trim().toLowerCase() ?? "";
  if (CONTENT_TYPES_PROTOBUF.has(base)) return true;
  // Also accept the explicit SDK-side hint header when a proxy strips
  // content-type (rare but real).
  return request.headers["x-foxhound-wire"] === "protobuf";
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

function nanosToMs(nanos: number | string): number {
  if (typeof nanos === "number") return Math.floor(nanos / 1_000_000);
  // protobufjs emits int64 as string when Number precision would lose bits.
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
  // bytesValue and unknown variants are flattened to null; the ingest tier
  // does not currently store binary attribute values.
  return null;
}

function attrsFromProto(
  rec: Record<string, v1.AttributeValue>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[k] = attrFromProto(v);
  }
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
  const span: Span = {
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
  };
  return span;
}

/**
 * Decode a raw Protobuf body into an internal Trace.
 *
 * Tenant-scope checks (enforced here so every Protobuf caller gets them):
 *   - batch.orgId (when non-empty) must match `authOrgId`.
 *   - every span in the batch must carry the same org_id as the batch.
 * A mismatch returns a structured error with HTTP 400.
 */
export function decodeProtoBatch(
  body: Buffer,
  authOrgId: string,
  contentEncoding?: string,
): ProtoDecodeResult {
  // WP05 step 1: honor `Content-Encoding: gzip`, reject oversize bodies
  // with 413 pre-decode so a compressed zip-bomb cannot drive the
  // decode cost before the size check fires.
  const decompressed = decompressIfNeeded(body, contentEncoding);
  if (!decompressed.ok) return decompressed;
  const rawBody = decompressed.body;

  let batch: v1.TraceBatch;
  try {
    batch = v1.TraceBatchCodec.decode(new Uint8Array(rawBody));
  } catch (err) {
    return {
      ok: false,
      status: 400,
      error: "Bad Request",
      message: `Invalid Protobuf payload: ${(err as Error).message}`,
    };
  }

  if (batch.schemaVersion !== "v1") {
    return {
      ok: false,
      status: 400,
      error: "Bad Request",
      message:
        `Unsupported schema_version=${JSON.stringify(batch.schemaVersion)}; ` +
        "this endpoint accepts v1. Upgrade the server or downgrade the SDK.",
    };
  }

  if (batch.orgId && batch.orgId !== authOrgId) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
      message: "batch.org_id does not match the authenticated API key's org",
    };
  }

  for (const span of batch.spans) {
    if (span.orgId && span.orgId !== authOrgId) {
      return {
        ok: false,
        status: 403,
        error: "Forbidden",
        message: `span ${span.spanId} carries a different org_id than the authenticated caller`,
      };
    }
  }

  if (batch.spans.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Bad Request",
      message: "batch contains zero spans",
    };
  }

  // Group by traceId; preserve original order within each group.
  type Acc = { spans: Span[]; minStart: number; maxEnd: number };
  const byTrace = new Map<string, Acc>();
  for (const pb of batch.spans) {
    const span = spanFromProto(pb);
    const group = byTrace.get(span.traceId);
    if (group) {
      group.spans.push(span);
      if (span.startTimeMs < group.minStart) group.minStart = span.startTimeMs;
      if (span.endTimeMs !== undefined && span.endTimeMs > group.maxEnd) {
        group.maxEnd = span.endTimeMs;
      }
    } else {
      byTrace.set(span.traceId, {
        spans: [span],
        minStart: span.startTimeMs,
        maxEnd: span.endTimeMs ?? span.startTimeMs,
      });
    }
  }

  // This handler intentionally emits ONE trace per decoded batch (the first
  // trace-id encountered). WP07 (trace-joining middleware) broadens this to
  // surface all traces in a multi-trace batch; today the common SDK path
  // sends one trace per batch anyway.
  const firstEntry = byTrace.entries().next().value;
  if (!firstEntry) {
    return {
      ok: false,
      status: 400,
      error: "Bad Request",
      message: "batch decoded to zero traces after span grouping",
    };
  }
  const [traceId, acc] = firstEntry;

  const trace: Trace = {
    id: traceId,
    agentId: "",
    spans: acc.spans,
    startTimeMs: acc.minStart,
    endTimeMs: acc.maxEnd,
    metadata: {
      ...(batch.sdkLanguage ? { "sdk.language": batch.sdkLanguage } : {}),
      ...(batch.sdkVersion ? { "sdk.version": batch.sdkVersion } : {}),
      "foxhound.schema_version": batch.schemaVersion,
      "foxhound.wire_format": "protobuf",
    },
  };

  return {
    ok: true,
    trace,
    // `wireBytes` reports the inbound (possibly compressed) size so
    // metrics match what the client actually transmitted. The
    // uncompressed size is available via the `contentEncoding` hint
    // plus the decoded batch shape if a caller wants to reconstruct
    // it.
    wireBytes: body.byteLength,
    schemaVersion: batch.schemaVersion,
    contentEncoding: decompressed.encoding,
  };
}
