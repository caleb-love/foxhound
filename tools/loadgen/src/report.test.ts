import { describe, it, expect } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createAccumulator,
  defaultGate,
  k6SummaryToReport,
  percentile,
  writeReport,
  type LoadReport,
} from "./report.js";

describe("loadgen · report · percentile", () => {
  it("returns 0 for empty input", () => {
    expect(percentile([], 50)).toBe(0);
  });
  it("returns the correct percentile value for sorted input", () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 95)).toBe(95);
    expect(percentile(sorted, 99)).toBe(99);
    expect(percentile(sorted, 100)).toBe(100);
  });
});

describe("loadgen · report · accumulator", () => {
  it("caps samples at sampleCap while preserving count", () => {
    const acc = createAccumulator({
      scenario: "smoke",
      tool: "node-orchestrator",
      targetUrl: "http://localhost:3000",
      endpoint: "/v1/traces/otlp",
      targetRps: 100,
      spansPerRequest: 4,
      orgIds: ["org_a"],
      sampleCap: 1000,
    });
    for (let i = 0; i < 5000; i++) {
      acc.pushLatency(i % 200);
      acc.recordStatus(200);
    }
    const report = acc.finalize({
      durationSec: 10,
      passCriteria: "error_rate < 1%",
      passPredicate: () => true,
    });
    expect(report.totalRequests).toBe(5000);
    expect(report.achievedRps).toBe(500);
    expect(report.latency.maxMs).toBeGreaterThan(0);
  });

  it("records error counts separately from status counts", () => {
    const acc = createAccumulator({
      scenario: "smoke",
      tool: "node-orchestrator",
      targetUrl: "http://localhost:3000",
      endpoint: "/v1/traces/otlp",
      targetRps: 10,
      spansPerRequest: 1,
      orgIds: ["org_a"],
    });
    for (let i = 0; i < 90; i++) {
      acc.pushLatency(1);
      acc.recordStatus(200);
    }
    for (let i = 0; i < 10; i++) {
      acc.pushLatency(1);
      acc.recordStatus(500);
      acc.recordError();
    }
    const report = acc.finalize({
      durationSec: 10,
      passCriteria: "error_rate < 1%",
      passPredicate: () => true,
    });
    expect(report.totalRequests).toBe(100);
    expect(report.errorRate).toBe(0.1);
    expect(report.status["200"]).toBe(90);
    expect(report.status["500"]).toBe(10);
  });
});

describe("loadgen · report · k6 summary translation", () => {
  it("translates a k6 summary into LoadReport", () => {
    const summary = {
      metrics: {
        http_req_duration: {
          values: { "p(50)": 120, "p(95)": 380, "p(99)": 420, max: 501 },
        },
        http_reqs: { values: { count: 300_000, rate: 1000 } },
        http_req_failed: { values: { rate: 0.004 } },
      },
    };
    const report = k6SummaryToReport(summary, {
      scenario: "baseline",
      targetUrl: "http://localhost:3000",
      endpoint: "/v1/traces/otlp",
      targetRps: 1000,
      spansPerRequest: 4,
      orgIds: ["org_a", "org_b", "org_c"],
      durationSec: 300,
      passCriteria: "error_rate < 1%; p99 not regressed > 20%",
      passPredicate: () => true,
    });
    expect(report.tool).toBe("k6");
    expect(report.totalRequests).toBe(300_000);
    expect(report.totalSpans).toBe(1_200_000);
    expect(report.latency.p99Ms).toBe(420);
    expect(report.errorRate).toBe(0.004);
  });
});

describe("loadgen · report · default gate", () => {
  const make = (p99: number, rps: number, errRate: number): LoadReport => ({
    date: new Date().toISOString(),
    scenario: "baseline",
    tool: "k6",
    target: { url: "x", endpoint: "/v1/traces/otlp" },
    durationSec: 300,
    targetRps: 1000,
    achievedRps: rps,
    totalRequests: rps * 300,
    totalSpans: rps * 300 * 4,
    spansPerRequest: 4,
    latency: { p50Ms: 100, p95Ms: 200, p99Ms: p99, maxMs: p99 * 2 },
    errorRate: errRate,
    status: { "200": rps * 300 },
    orgIds: ["org_a"],
    pass: true,
    passCriteria: "x",
  });

  it("first run (no prior) passes when error_rate is under 1%", () => {
    expect(defaultGate(make(400, 1000, 0.005))).toBe(true);
    expect(defaultGate(make(400, 1000, 0.02))).toBe(false);
  });

  it("p99 regression > 20% fails", () => {
    const prior = make(400, 1000, 0.001);
    const current = make(500, 1000, 0.001); // +25% p99
    expect(defaultGate(current, prior)).toBe(false);
  });

  it("rps drop > 15% fails", () => {
    const prior = make(400, 1000, 0.001);
    const current = make(400, 800, 0.001); // -20% rps
    expect(defaultGate(current, prior)).toBe(false);
  });
});

describe("loadgen · report · writer", () => {
  it("writeReport round-trips a LoadReport to disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loadgen-"));
    const path = join(dir, "last-run.json");
    const report: LoadReport = {
      date: "2026-04-20T00:00:00.000Z",
      scenario: "baseline",
      tool: "k6",
      target: { url: "http://localhost:3000", endpoint: "/v1/traces/otlp" },
      durationSec: 300,
      targetRps: 1000,
      achievedRps: 998,
      totalRequests: 299_400,
      totalSpans: 1_197_600,
      spansPerRequest: 4,
      latency: { p50Ms: 80, p95Ms: 190, p99Ms: 310, maxMs: 500 },
      errorRate: 0.003,
      status: { "202": 298_500, "500": 900 },
      orgIds: ["org_a", "org_b", "org_c"],
      pass: true,
      passCriteria: "error_rate < 1%",
    };
    await writeReport(report, path);
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as LoadReport;
    expect(parsed.scenario).toBe("baseline");
    expect(parsed.totalRequests).toBe(299_400);
    expect(parsed.pass).toBe(true);
  });
});
