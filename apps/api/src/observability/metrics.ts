/**
 * Ingest-path metrics.
 *
 * Eight core SLIs that together describe the ingest hot path end-to-end:
 *
 *   1. foxhound_ingest_request_duration_seconds  (histogram)
 *   2. foxhound_ingest_payload_bytes             (histogram)
 *   3. foxhound_ingest_buffer_depth              (gauge)
 *   4. foxhound_ingest_errors_total              (counter, labeled by reason)
 *   5. foxhound_ingest_oversize_drops_total      (counter, labeled by reason) [WP05]
 *   6. foxhound_ingest_requests_total            (counter; PromQL `rate()` gives RPS)
 *   7. foxhound_ingest_per_org_requests_total    (counter, labeled by bounded org_id)
 *   8. foxhound_worker_queue_consumer_lag_seconds (gauge, labeled by consumer) [WP08]
 *
 * Cardinality policy (RFC-002):
 *   - org_id is the only tenant-scoped label and is bounded via
 *     `BoundedLabels` (default 100 orgs + "other").
 *   - trace_id and span_id MUST NEVER appear as labels.
 *   - error reasons are an enumerated, closed set; free-form error
 *     strings must be normalised before being used as a label.
 *
 * Runtime: prom-client. Chosen over `@opentelemetry/sdk-metrics` +
 * `@opentelemetry/exporter-prometheus` because (a) dependency surface is
 * smaller, (b) prom-client is battle-tested at our scale, (c) an OTel
 * metrics swap later is a localised change to this module. See RFC-002.
 */
import * as promClient from "prom-client";
import { createBoundedLabels, type BoundedLabels } from "./cardinality.js";

export type IngestErrorReason =
  | "bad_request"
  | "unsupported_media"
  | "auth_failed"
  | "rate_limited"
  | "span_limit_exceeded"
  | "server_error"
  | "buffer_overflow";

export type OversizeReason = "payload" | "cap";

export interface IngestMetrics {
  /** Record a completed ingest request. */
  recordRequest(opts: {
    orgId: string;
    durationSeconds: number;
    payloadBytes: number;
    statusCode: number;
    spanCount: number;
  }): void;
  /** Record a request that failed before normal completion. */
  recordError(opts: { orgId: string; reason: IngestErrorReason }): void;
  /** Record a payload dropped for being oversize (WP05). */
  recordOversizeDrop(opts: { orgId: string; reason: OversizeReason }): void;
  /** Set current buffer depth gauge. */
  setBufferDepth(depth: number): void;
  /** Set current consumer-group lag (WP08). */
  setQueueConsumerLag(opts: { consumer: string; lagSeconds: number }): void;
  /** The prom-client registry that owns these metrics. */
  registry: promClient.Registry;
  /** Expose the bounded labels tracker for tests and introspection. */
  readonly orgLabels: BoundedLabels;
  /** Test hook: reset all metric values. */
  reset(): void;
}

export interface CreateIngestMetricsOpts {
  /** Inject a registry for tests; defaults to a fresh one. */
  registry?: promClient.Registry;
  /** Max distinct org labels tracked; beyond this, orgs roll into "other". */
  maxOrgLabels?: number;
  /** Include default Node process metrics on this registry. */
  collectNodeDefaults?: boolean;
}

export function createIngestMetrics(opts: CreateIngestMetricsOpts = {}): IngestMetrics {
  const registry = opts.registry ?? new promClient.Registry();
  const orgLabels = createBoundedLabels({
    maxLabels: opts.maxOrgLabels ?? 100,
    otherLabel: "other",
  });

  if (opts.collectNodeDefaults ?? true) {
    promClient.collectDefaultMetrics({ register: registry });
  }

  // ---- 1. Request duration histogram (seconds)
  const requestDuration = new promClient.Histogram({
    name: "foxhound_ingest_request_duration_seconds",
    help: "End-to-end duration of POST /v1/traces/otlp (SDK request → 202), seconds.",
    labelNames: ["status_code", "org_id"] as const,
    // Matches realistic agent latency. Buckets span 1ms to 5s.
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  // ---- 2. Payload size histogram (bytes)
  const payloadBytes = new promClient.Histogram({
    name: "foxhound_ingest_payload_bytes",
    help: "Size of the decoded OTLP request body in bytes.",
    labelNames: ["org_id"] as const,
    // Buckets span 256B to 4MiB; captures small heartbeats and large batches.
    buckets: [256, 1024, 4096, 16384, 65536, 262144, 1048576, 4194304],
    registers: [registry],
  });

  // ---- 3. Buffer depth gauge
  const bufferDepth = new promClient.Gauge({
    name: "foxhound_ingest_buffer_depth",
    help: "Current number of traces in the micro-batch buffer awaiting persistence.",
    registers: [registry],
  });

  // ---- 4. Error counter
  const errorsTotal = new promClient.Counter({
    name: "foxhound_ingest_errors_total",
    help: "Errors on the ingest path, labeled by reason.",
    labelNames: ["reason", "org_id"] as const,
    registers: [registry],
  });

  // ---- 5. Oversize-drop counter (WP05 lights this up)
  const oversizeDropsTotal = new promClient.Counter({
    name: "foxhound_ingest_oversize_drops_total",
    help: "Payloads dropped due to size limits, labeled by trigger.",
    labelNames: ["reason", "org_id"] as const,
    registers: [registry],
  });

  // ---- 6. Global request counter (PromQL `rate(...)` gives RPS)
  const requestsTotal = new promClient.Counter({
    name: "foxhound_ingest_requests_total",
    help: "Total ingest requests accepted. Use rate() for RPS.",
    labelNames: ["status_code"] as const,
    registers: [registry],
  });

  // ---- 7. Per-org request counter
  const perOrgRequestsTotal = new promClient.Counter({
    name: "foxhound_ingest_per_org_requests_total",
    help: "Ingest requests per org (cardinality-bounded; excess orgs roll into 'other').",
    labelNames: ["org_id"] as const,
    registers: [registry],
  });

  // ---- 8. Consumer-group lag gauge (WP08 lights this up)
  const consumerLagSeconds = new promClient.Gauge({
    name: "foxhound_worker_queue_consumer_lag_seconds",
    help: "Durable-queue consumer-group lag in seconds.",
    labelNames: ["consumer"] as const,
    registers: [registry],
  });

  return {
    registry,
    orgLabels,
    recordRequest({
      orgId,
      durationSeconds,
      payloadBytes: bytes,
      statusCode,
      spanCount: _spanCount,
    }) {
      const label = orgLabels.resolve(orgId);
      const statusLabel = String(statusCode);
      requestDuration.labels(statusLabel, label).observe(durationSeconds);
      payloadBytes.labels(label).observe(bytes);
      requestsTotal.labels(statusLabel).inc(1);
      perOrgRequestsTotal.labels(label).inc(1);
    },
    recordError({ orgId, reason }) {
      const label = orgLabels.resolve(orgId);
      errorsTotal.labels(reason, label).inc(1);
    },
    recordOversizeDrop({ orgId, reason }) {
      const label = orgLabels.resolve(orgId);
      oversizeDropsTotal.labels(reason, label).inc(1);
    },
    setBufferDepth(depth) {
      bufferDepth.set(depth);
    },
    setQueueConsumerLag({ consumer, lagSeconds }) {
      consumerLagSeconds.labels(consumer).set(lagSeconds);
    },
    reset() {
      registry.resetMetrics();
    },
  };
}
