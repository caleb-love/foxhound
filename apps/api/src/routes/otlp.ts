import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { checkSpanLimit } from "@foxhound/billing";
import { bufferTrace, initTraceBuffer } from "../trace-buffer.js";
import type { Trace, Span, SpanKind, SpanEvent } from "@foxhound/types";

// ---------------------------------------------------------------------------
// OTel AnyValue JSON representation — Zod schemas
// ---------------------------------------------------------------------------

const OtelAnyValueSchema: z.ZodType<
  | { stringValue: string }
  | { intValue: number | string }
  | { doubleValue: number }
  | { boolValue: boolean }
  | { arrayValue: { values: unknown[] } }
  | { kvlistValue: { values: { key: string; value: unknown }[] } }
> = z.union([
  z.object({ stringValue: z.string() }),
  z.object({ intValue: z.union([z.number(), z.string()]) }),
  z.object({ doubleValue: z.number() }),
  z.object({ boolValue: z.boolean() }),
  z.object({ arrayValue: z.object({ values: z.array(z.lazy(() => OtelAnyValueSchema)) }) }),
  z.object({
    kvlistValue: z.object({
      values: z.array(
        z.object({ key: z.string(), value: z.lazy(() => OtelAnyValueSchema) }),
      ),
    }),
  }),
]);

type OtelAnyValue = z.infer<typeof OtelAnyValueSchema>;

const OtelAttributeSchema = z.object({
  key: z.string(),
  value: OtelAnyValueSchema,
});

type OtelAttribute = z.infer<typeof OtelAttributeSchema>;

// ---------------------------------------------------------------------------
// OTLP/HTTP JSON request shape — Zod schemas
// ---------------------------------------------------------------------------

const OtelEventSchema = z.object({
  timeUnixNano: z.string().optional(),
  name: z.string().optional(),
  attributes: z.array(OtelAttributeSchema).optional(),
});

const OtelSpanSchema = z.object({
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  parentSpanId: z.string().optional(),
  name: z.string().optional(),
  kind: z.number().optional(),
  startTimeUnixNano: z.string().optional(),
  endTimeUnixNano: z.string().optional(),
  status: z.object({ code: z.number().optional() }).optional(),
  attributes: z.array(OtelAttributeSchema).optional(),
  events: z.array(OtelEventSchema).optional(),
});

const OtelScopeSpanSchema = z.object({
  spans: z.array(OtelSpanSchema).optional(),
});

const OtelResourceSpanSchema = z.object({
  resource: z.object({ attributes: z.array(OtelAttributeSchema).optional() }).optional(),
  scopeSpans: z.array(OtelScopeSpanSchema).optional(),
});

const OtlpExportRequestSchema = z.object({
  resourceSpans: z.array(OtelResourceSpanSchema),
});

type OtlpExportRequest = z.infer<typeof OtlpExportRequestSchema>;

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
    // BigInt failed — try parseInt as fallback, but guard against NaN
    const parsed = parseInt(nano, 10);
    if (Number.isNaN(parsed)) return undefined;
    return Math.floor(parsed / 1_000_000);
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

      const parsed = OtlpExportRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Bad Request",
          message: "Expected OTLP ExportTraceServiceRequest JSON",
          issues: parsed.error.issues,
        });
      }

      const traces = mapOtlpToFoxhoundTraces(parsed.data);

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

      // Initialize buffer on first request (idempotent — logger ref is set once)
      initTraceBuffer(fastify.log);

      // Respond immediately — OTLP spec requires 202 before slow persistence
      void reply.code(202).send({ partialSuccess: {} });

      // Micro-batch: buffer traces and flush in batches (100ms or 50 traces)
      for (const trace of tracesToPersist) {
        bufferTrace(trace, orgId);
      }
    },
  );
}
