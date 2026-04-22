import { describe, it, expect, beforeEach } from "vitest";
import { Registry } from "prom-client";
import { createIngestMetrics, type IngestMetrics } from "./metrics.js";

describe("observability · IngestMetrics", () => {
  let registry: Registry;
  let metrics: IngestMetrics;

  beforeEach(() => {
    registry = new Registry();
    metrics = createIngestMetrics({
      registry,
      maxOrgLabels: 3,
      collectNodeDefaults: false,
    });
  });

  it("exposes all 8 named series", async () => {
    // Emit at least one sample of each so prom-client prints them.
    metrics.recordRequest({
      orgId: "org_a",
      durationSeconds: 0.042,
      payloadBytes: 2048,
      statusCode: 202,
      spanCount: 4,
    });
    metrics.recordError({ orgId: "org_a", reason: "bad_request" });
    metrics.recordOversizeDrop({ orgId: "org_a", reason: "payload" });
    metrics.setBufferDepth(12);
    metrics.setQueueConsumerLag({ consumer: "persister", lagSeconds: 0.5 });

    const text = await registry.metrics();
    expect(text).toContain("foxhound_ingest_request_duration_seconds");
    expect(text).toContain("foxhound_ingest_payload_bytes");
    expect(text).toContain("foxhound_ingest_buffer_depth");
    expect(text).toContain("foxhound_ingest_errors_total");
    expect(text).toContain("foxhound_ingest_oversize_drops_total");
    expect(text).toContain("foxhound_ingest_requests_total");
    expect(text).toContain("foxhound_ingest_per_org_requests_total");
    expect(text).toContain("foxhound_worker_queue_consumer_lag_seconds");
  });

  it("bounds per-org cardinality under pressure", async () => {
    // Send 50 distinct orgs into a metrics recorder capped at 3.
    for (let i = 0; i < 50; i++) {
      metrics.recordRequest({
        orgId: `org_${i}`,
        durationSeconds: 0.01,
        payloadBytes: 512,
        statusCode: 202,
        spanCount: 1,
      });
    }
    const text = await registry.metrics();
    // Parse lines of foxhound_ingest_per_org_requests_total and count unique org_id labels.
    const lines = text
      .split("\n")
      .filter((l) => l.startsWith("foxhound_ingest_per_org_requests_total{"));
    const orgLabels = new Set<string>();
    for (const line of lines) {
      const m = /org_id="([^"]+)"/.exec(line);
      if (m) orgLabels.add(m[1]!);
    }
    // Tracked orgs + "other" = at most 4 distinct label values.
    expect(orgLabels.size).toBeLessThanOrEqual(4);
    expect(orgLabels.has("other")).toBe(true);
  });

  it("labels request duration by status_code", async () => {
    metrics.recordRequest({
      orgId: "org_a",
      durationSeconds: 0.1,
      payloadBytes: 1024,
      statusCode: 202,
      spanCount: 1,
    });
    metrics.recordRequest({
      orgId: "org_a",
      durationSeconds: 0.4,
      payloadBytes: 1024,
      statusCode: 500,
      spanCount: 0,
    });
    const text = await registry.metrics();
    expect(text).toMatch(/foxhound_ingest_request_duration_seconds_bucket\{[^}]*status_code="202"/);
    expect(text).toMatch(/foxhound_ingest_request_duration_seconds_bucket\{[^}]*status_code="500"/);
  });

  it("records error counter with the correct reason label", async () => {
    metrics.recordError({ orgId: "org_a", reason: "rate_limited" });
    metrics.recordError({ orgId: "org_a", reason: "rate_limited" });
    metrics.recordError({ orgId: "org_a", reason: "server_error" });
    const text = await registry.metrics();
    expect(text).toMatch(/foxhound_ingest_errors_total\{[^}]*reason="rate_limited"[^}]*\} 2/);
    expect(text).toMatch(/foxhound_ingest_errors_total\{[^}]*reason="server_error"[^}]*\} 1/);
  });

  it("buffer depth gauge reflects the most recent value", async () => {
    metrics.setBufferDepth(1);
    metrics.setBufferDepth(7);
    metrics.setBufferDepth(3);
    const text = await registry.metrics();
    expect(text).toMatch(/foxhound_ingest_buffer_depth 3/);
  });

  it("NEVER emits trace_id or span_id as a label (cardinality guardrail)", async () => {
    metrics.recordRequest({
      orgId: "org_a",
      durationSeconds: 0.01,
      payloadBytes: 256,
      statusCode: 202,
      spanCount: 1,
    });
    const text = await registry.metrics();
    expect(text).not.toContain("trace_id=");
    expect(text).not.toContain("span_id=");
  });

  it("tenant scoping: error counter rolls unknown orgs into 'other'", async () => {
    // Already at cap (3); a 4th org triggers the rollup.
    metrics.recordRequest({ orgId: "org_a", durationSeconds: 0.01, payloadBytes: 1, statusCode: 202, spanCount: 0 });
    metrics.recordRequest({ orgId: "org_b", durationSeconds: 0.01, payloadBytes: 1, statusCode: 202, spanCount: 0 });
    metrics.recordRequest({ orgId: "org_c", durationSeconds: 0.01, payloadBytes: 1, statusCode: 202, spanCount: 0 });
    metrics.recordError({ orgId: "org_d", reason: "bad_request" });
    const text = await registry.metrics();
    expect(text).toMatch(/foxhound_ingest_errors_total\{[^}]*org_id="other"/);
  });
});
