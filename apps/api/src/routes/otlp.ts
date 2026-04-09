import type { FastifyInstance } from "fastify";
import { checkSpanLimit } from "@foxhound/billing";
import { persistTraceWithRetry } from "../persistence.js";
import type { Trace, Span, SpanKind, SpanEvent } from "@foxhound/types";

// ---------------------------------------------------------------------------
// OTel AnyValue JSON representation
// ---------------------------------------------------------------------------

type OtelAnyValue =
  | { stringValue: string }
  | { intValue: number | string }
  | { doubleValue: number }
  | { boolValue: boolean }
  | { arrayValue: { values: OtelAnyValue[] } }
  | { kvlistValue: { values: { key: string; value: OtelAnyValue }[] } };

type OtelAttribute = { key: string; value: OtelAnyValue };

// ---------------------------------------------------------------------------
// OTLP/HTTP JSON request shape
// ---------------------------------------------------------------------------

interface OtlpExportRequest {
  resourceSpans?: OtelResourceSpan[];
}

interface OtelResourceSpan {
  resource?: { attributes?: OtelAttribute[] };
  scopeSpans?: OtelScopeSpan[];
}

interface OtelScopeSpan {
  spans?: OtelSpan[];
}

interface OtelSpan {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  name?: string;
  kind?: number;
  startTimeUnixNano?: string;
  endTimeUnixNano?: string;
  status?: { code?: number };
  attributes?: OtelAttribute[];
  events?: OtelEvent[];
}

interface OtelEvent {
  timeUnixNano?: string;
  name?: string;
  attributes?: OtelAttribute[];
}

// ---------------------------------------------------------------------------
// Helpers — OTel → Foxhound conversions
// ---------------------------------------------------------------------------

function extractAnyValue(v: OtelAnyValue): string | number | boolean | null {
  if ("stringValue" in v) return v.stringValue;
  if ("intValue" in v)
    return typeof v.intValue === "string" ? parseInt(v.intValue, 10) : v.intValue;
  if ("doubleValue" in v) return v.doubleValue;
  if ("boolValue" in v) return v.boolValue;
  return null; // arrays/kvlists are not representable as a flat value
}

function extractAttributes(
  attrs: OtelAttribute[] | undefined,
): Record<string, string | number | boolean | null> {
  if (!attrs) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const { key, value } of attrs) {
    out[key] = extractAnyValue(value);
  }
  return out;
}

/**
 * OTel SpanKind enum → Foxhound SpanKind.
 * Spans with `gen_ai.*` attributes are always mapped to `llm_call`.
 */
function mapSpanKind(
  kind: number | undefined,
  attributes: Record<string, string | number | boolean | null>,
): SpanKind {
  const hasGenAi = Object.keys(attributes).some((k) => k.startsWith("gen_ai."));
  if (hasGenAi) return "llm_call";

  // OTel SpanKind: 0=UNSPECIFIED, 1=INTERNAL, 2=SERVER, 3=CLIENT, 4=PRODUCER, 5=CONSUMER
  switch (kind) {
    case 3:
      return "tool_call"; // CLIENT → external tool invocation
    case 2:
      return "workflow"; // SERVER → entry point / orchestration
    default:
      return "agent_step"; // INTERNAL, UNSPECIFIED, PRODUCER, CONSUMER
  }
}

/** OTel StatusCode → Foxhound span status. */
function mapStatus(code: number | undefined): "ok" | "error" | "unset" {
  if (code === 1) return "ok";
  if (code === 2) return "error";
  return "unset";
}

/** Nanosecond timestamp string → milliseconds (number). */
function nanoToMs(nano: string | undefined): number | undefined {
  if (!nano) return undefined;
  try {
    return Number(BigInt(nano) / BigInt(1_000_000));
  } catch {
    return Math.floor(parseInt(nano, 10) / 1_000_000);
  }
}

/**
 * Normalize OTel trace/span IDs.
 * OTLP JSON encodes bytes as base64; some implementations send hex instead.
 * We convert to hex for a stable Foxhound ID format.
 */
function normalizeId(id: string | undefined, byteLen: number): string {
  if (!id) return "";
  const hexLen = byteLen * 2;
  if (id.length === hexLen) return id.toLowerCase();
  try {
    return Buffer.from(id, "base64").toString("hex");
  } catch {
    return id.toLowerCase();
  }
}

// ---------------------------------------------------------------------------
// Core mapping: OTel resource span → Foxhound traces (grouped by traceId)
// ---------------------------------------------------------------------------

interface TraceAccumulator {
  spans: Span[];
  startTimeMs: number;
  endTimeMs: number | undefined;
  agentId: string;
  sessionId: string | undefined;
  metadata: Record<string, string | number | boolean | null>;
}

function mapOtlpToFoxhoundTraces(body: OtlpExportRequest): Trace[] {
  const byTraceId = new Map<string, TraceAccumulator>();

  for (const resourceSpan of body.resourceSpans ?? []) {
    const resourceAttrs = extractAttributes(resourceSpan.resource?.attributes);
    const agentId = String(resourceAttrs["service.name"] ?? "unknown");
    const sessionId =
      "service.instance.id" in resourceAttrs
        ? String(resourceAttrs["service.instance.id"])
        : undefined;

    // Collect resource attrs as metadata (drop service.name / service.instance.id
    // since they are promoted to first-class fields).
    const metadata: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(resourceAttrs)) {
      if (k !== "service.name" && k !== "service.instance.id") {
        metadata[k] = v;
      }
    }

    for (const scopeSpan of resourceSpan.scopeSpans ?? []) {
      for (const otelSpan of scopeSpan.spans ?? []) {
        const traceId = normalizeId(otelSpan.traceId, 16);
        if (!traceId) continue;

        const spanAttrs = extractAttributes(otelSpan.attributes);
        const startMs = nanoToMs(otelSpan.startTimeUnixNano) ?? Date.now();
        const endMs = nanoToMs(otelSpan.endTimeUnixNano);

        const events: SpanEvent[] = (otelSpan.events ?? []).map((e) => ({
          timeMs: nanoToMs(e.timeUnixNano) ?? startMs,
          name: e.name ?? "",
          attributes: extractAttributes(e.attributes),
        }));

        const span: Span = {
          traceId,
          spanId: normalizeId(otelSpan.spanId, 8),
          parentSpanId: otelSpan.parentSpanId ? normalizeId(otelSpan.parentSpanId, 8) : undefined,
          name: otelSpan.name ?? "",
          kind: mapSpanKind(otelSpan.kind, spanAttrs),
          startTimeMs: startMs,
          endTimeMs: endMs,
          status: mapStatus(otelSpan.status?.code),
          attributes: spanAttrs,
          events,
        };

        const acc = byTraceId.get(traceId);
        if (acc) {
          acc.spans.push(span);
          if (startMs < acc.startTimeMs) acc.startTimeMs = startMs;
          if (endMs !== undefined) {
            acc.endTimeMs = acc.endTimeMs === undefined ? endMs : Math.max(acc.endTimeMs, endMs);
          }
        } else {
          byTraceId.set(traceId, {
            spans: [span],
            startTimeMs: startMs,
            endTimeMs: endMs,
            agentId,
            sessionId,
            metadata,
          });
        }
      }
    }
  }

  return Array.from(byTraceId.entries()).map(([traceId, acc]) => ({
    id: traceId,
    agentId: acc.agentId,
    sessionId: acc.sessionId,
    spans: acc.spans,
    startTimeMs: acc.startTimeMs,
    endTimeMs: acc.endTimeMs,
    metadata: acc.metadata,
  }));
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function otlpRoutes(fastify: FastifyInstance): void {
  // Register a custom content-type parser for application/x-protobuf.
  // Binary protobuf decoding requires the @opentelemetry/otlp-transformer
  // package; this server currently handles OTLP/HTTP+JSON only and returns
  // 415 for binary protobuf requests.
  fastify.addContentTypeParser(
    "application/x-protobuf",
    { parseAs: "buffer" },
    (_req, _body, done) => {
      done(null, null);
    },
  );

  /**
   * POST /v1/traces/otlp
   *
   * OpenTelemetry OTLP/HTTP trace ingestion endpoint.
   * Accepts application/json (OTLP JSON encoding).
   * Returns 202 Accepted immediately; persistence is async.
   *
   * Content negotiation:
   *   application/json             → fully supported
   *   application/x-protobuf      → 415 (binary proto not yet supported)
   */
  fastify.post(
    "/v1/traces/otlp",
    { config: { rateLimit: { max: 1000, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const contentType = request.headers["content-type"] ?? "";

      // Binary protobuf: not yet supported
      if (contentType.includes("application/x-protobuf") && request.body === null) {
        return reply.code(415).send({
          error: "Unsupported Media Type",
          message:
            "Binary protobuf encoding is not supported. " +
            "Configure your OTel exporter to use OTLP/HTTP+JSON " +
            "(Content-Type: application/json).",
        });
      }

      const body = request.body as OtlpExportRequest | null;
      if (!body || !Array.isArray(body.resourceSpans)) {
        return reply
          .code(400)
          .send({ error: "Bad Request", message: "Expected OTLP ExportTraceServiceRequest JSON" });
      }

      const traces = mapOtlpToFoxhoundTraces(body);

      if (traces.length === 0) {
        // Empty payload — OTLP spec says return success
        return reply.code(202).send({ partialSuccess: {} });
      }

      const orgId = request.orgId;
      const totalSpans = traces.reduce((n, t) => n + t.spans.length, 0);

      const limitCheck = await checkSpanLimit(orgId, totalSpans);
      if (!limitCheck.allowed) {
        return reply.code(429).send({
          error: "span_limit_exceeded",
          message: `Monthly span limit of ${limitCheck.spansLimit.toLocaleString()} reached. Upgrade to Pro for higher limits.`,
          spansUsed: limitCheck.spansUsed,
          spansLimit: limitCheck.spansLimit,
        });
      }

      // Server-side sampling: filter out non-error traces probabilistically.
      const samplingRate = request.samplingRate;
      const tracesToPersist =
        samplingRate >= 1.0
          ? traces
          : traces.filter((t) => {
              const hasError = t.spans.some((s) => s.status === "error");
              return hasError || Math.random() < samplingRate;
            });

      // Respond immediately — OTLP spec requires 202 before slow persistence
      void reply.code(202).send({ partialSuccess: {} });

      setImmediate(() => {
        for (const trace of tracesToPersist) {
          persistTraceWithRetry(fastify.log, trace, orgId).catch(() => {});
        }
      });
    },
  );
}
