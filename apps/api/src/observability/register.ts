/**
 * Fastify integration for the ingest metrics module.
 *
 * Exposes:
 *   GET /metrics — Prometheus-format scrape endpoint (text/plain; version=0.0.4)
 *
 * Wiring:
 *   - A request timer is started on every POST to the ingest path.
 *   - On response (any status), duration + payload size + status are recorded.
 *   - Errors (4xx/5xx) additionally increment the error counter with a
 *     normalised `reason`.
 *
 * Non-goals (deferred):
 *   - OTLP-native metrics egress (currently Prometheus-only; OTLP export
 *     added when a central collector exists).
 *   - Per-route latency for non-ingest endpoints (can be added later by
 *     attaching the hook to more routes).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createIngestMetrics, type IngestErrorReason, type IngestMetrics } from "./metrics.js";

const METRICS_STARTED_AT = Symbol("foxhound-metrics-started-at");
const METRICS_PAYLOAD_BYTES = Symbol("foxhound-metrics-payload-bytes");
const METRICS_ORG_ID = Symbol("foxhound-metrics-org-id");
const METRICS_SPAN_COUNT = Symbol("foxhound-metrics-span-count");

type Augmented = FastifyRequest & {
  [METRICS_STARTED_AT]?: bigint;
  [METRICS_PAYLOAD_BYTES]?: number;
  [METRICS_ORG_ID]?: string;
  [METRICS_SPAN_COUNT]?: number;
};

export interface RegisterMetricsOpts {
  /** Routes that receive the ingest-path instrumentation hook. */
  ingestRouteUrls?: readonly string[];
  /** Override the metrics recorder for tests. */
  metrics?: IngestMetrics;
  /** Bounded-org-label cap. */
  maxOrgLabels?: number;
  /** Include default Node process metrics. */
  collectNodeDefaults?: boolean;
}

export async function registerMetrics(
  app: FastifyInstance,
  opts: RegisterMetricsOpts = {},
): Promise<IngestMetrics> {
  const ingestRoutes = new Set(opts.ingestRouteUrls ?? ["/v1/traces/otlp", "/v1/traces"]);
  const metrics =
    opts.metrics ??
    createIngestMetrics({
      ...(opts.maxOrgLabels !== undefined ? { maxOrgLabels: opts.maxOrgLabels } : {}),
      ...(opts.collectNodeDefaults !== undefined ? { collectNodeDefaults: opts.collectNodeDefaults } : {}),
    });

  // WP05: decorate the Fastify instance so route handlers can record
  // oversize drops + other ingest-path metrics without reaching for
  // module-level state. Accessed as `request.server.ingestMetrics` in
  // handlers; the `FastifyInstance` augmentation below keeps it typed.
  if (!app.hasDecorator("ingestMetrics")) {
    app.decorate("ingestMetrics", metrics);
  }

  const routeMatches = (request: FastifyRequest): boolean => {
    // Fastify v5: routeOptions.url is the registered path pattern; fall back
    // to request.url for tests that inject without a matched route.
    const pattern = request.routeOptions?.url ?? request.url;
    return ingestRoutes.has(pattern);
  };

  // onRequest: start the timer, capture payload size + orgId when visible.
  app.addHook("onRequest", async (request: FastifyRequest) => {
    if (!routeMatches(request)) return;
    const req = request as Augmented;
    req[METRICS_STARTED_AT] = process.hrtime.bigint();
    const lenHeader = request.headers["content-length"];
    if (typeof lenHeader === "string") {
      const n = Number.parseInt(lenHeader, 10);
      if (Number.isFinite(n) && n >= 0) req[METRICS_PAYLOAD_BYTES] = n;
    }
  });

  // preHandler: orgId is now available from auth.
  app.addHook("preHandler", async (request: FastifyRequest) => {
    if (!routeMatches(request)) return;
    const req = request as Augmented;
    const orgId = (request as unknown as { orgId?: string }).orgId;
    if (typeof orgId === "string" && orgId.length > 0) req[METRICS_ORG_ID] = orgId;
  });

  // onResponse: emit the recorded data point. This runs after body flush,
  // so duration captures the full request-handling time.
  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!routeMatches(request)) return;
    const req = request as Augmented;
    const started = req[METRICS_STARTED_AT];
    if (started === undefined) return;
    const durationSeconds = Number(process.hrtime.bigint() - started) / 1e9;
    const orgId = req[METRICS_ORG_ID] ?? "anonymous";
    const payloadBytes = req[METRICS_PAYLOAD_BYTES] ?? 0;
    const statusCode = reply.statusCode;
    const spanCount = req[METRICS_SPAN_COUNT] ?? 0;

    metrics.recordRequest({ orgId, durationSeconds, payloadBytes, statusCode, spanCount });

    if (statusCode >= 400) {
      const reason = statusCodeToReason(statusCode);
      metrics.recordError({ orgId, reason });
    }
  });

  // GET /metrics
  app.get("/metrics", async (_req, reply) => {
    const body = await metrics.registry.metrics();
    void reply.header("content-type", metrics.registry.contentType);
    return body;
  });

  return metrics;
}

function statusCodeToReason(code: number): IngestErrorReason {
  if (code === 400) return "bad_request";
  if (code === 401 || code === 403) return "auth_failed";
  if (code === 415) return "unsupported_media";
  if (code === 429) return "rate_limited";
  if (code === 413) return "span_limit_exceeded";
  return "server_error";
}

/**
 * Helper: expose a typed way for route handlers to annotate a request with
 * the decoded span count before the `onResponse` hook fires. Avoids having
 * each route reach into the symbol table directly.
 */
declare module "fastify" {
  interface FastifyInstance {
    /** Ingest-path metrics recorder (WP02 + WP05 oversize drops). */
    ingestMetrics: IngestMetrics;
  }
}

export function setIngestSpanCount(request: FastifyRequest, count: number): void {
  (request as Augmented)[METRICS_SPAN_COUNT] = count;
}
