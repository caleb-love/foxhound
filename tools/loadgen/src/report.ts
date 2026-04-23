/**
 * Load-test report writer. Normalises k6 JSON summary output (and the Node
 * orchestrator's in-process sampling) into a single `LoadReport` structure
 * written to `tools/loadgen/last-run.json` and appended to
 * `docs/reference/load-tests.md`.
 *
 * One reason this module exists separately from the k6 scenario: k6's built-in
 * summary JSON is machine-readable but not directly shape-compatible with the
 * program's gate policy. This writer enforces the canonical shape.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface LoadReport {
  readonly date: string; // ISO-8601
  readonly scenario: string; // baseline | burst | sustained | smoke
  readonly tool: "k6" | "node-orchestrator" | "vegeta";
  readonly target: {
    readonly url: string;
    readonly endpoint: string;
  };
  readonly durationSec: number;
  readonly targetRps: number;
  readonly achievedRps: number;
  readonly totalRequests: number;
  readonly totalSpans: number;
  readonly spansPerRequest: number;
  readonly latency: {
    readonly p50Ms: number;
    readonly p95Ms: number;
    readonly p99Ms: number;
    readonly p999Ms?: number;
    readonly maxMs: number;
  };
  readonly errorRate: number; // [0, 1]
  readonly status: Readonly<Record<string, number>>;
  readonly orgIds: readonly string[];
  readonly pass: boolean;
  readonly passCriteria: string;
  readonly commit?: string;
  readonly host?: string;
  readonly notes?: string;
}

export interface SamplingAccumulator {
  readonly scenario: string;
  readonly tool: LoadReport["tool"];
  readonly targetUrl: string;
  readonly endpoint: string;
  readonly targetRps: number;
  readonly spansPerRequest: number;
  readonly orgIds: readonly string[];
  pushLatency(ms: number): void;
  recordStatus(code: number): void;
  recordError(): void;
  finalize(opts: {
    durationSec: number;
    passCriteria: string;
    passPredicate: (p: LoadReport) => boolean;
  }): LoadReport;
}

/**
 * Bounded reservoir-style accumulator. Caps at ~200k samples to keep memory
 * flat under a 30-minute run at 35k RPS. Beyond the cap, samples are replaced
 * with reservoir sampling to preserve tail fidelity.
 */
export function createAccumulator(opts: {
  scenario: string;
  tool: LoadReport["tool"];
  targetUrl: string;
  endpoint: string;
  targetRps: number;
  spansPerRequest: number;
  orgIds: readonly string[];
  sampleCap?: number;
}): SamplingAccumulator {
  const cap = opts.sampleCap ?? 200_000;
  const samples: number[] = [];
  let seen = 0;
  let errors = 0;
  const statusCounts = new Map<number, number>();

  return {
    scenario: opts.scenario,
    tool: opts.tool,
    targetUrl: opts.targetUrl,
    endpoint: opts.endpoint,
    targetRps: opts.targetRps,
    spansPerRequest: opts.spansPerRequest,
    orgIds: opts.orgIds,

    pushLatency(ms: number): void {
      seen += 1;
      if (samples.length < cap) {
        samples.push(ms);
      } else {
        const j = Math.floor(Math.random() * seen);
        if (j < cap) samples[j] = ms;
      }
    },

    recordStatus(code: number): void {
      statusCounts.set(code, (statusCounts.get(code) ?? 0) + 1);
    },

    recordError(): void {
      errors += 1;
    },

    finalize({ durationSec, passCriteria, passPredicate }) {
      const sorted = [...samples].sort((a, b) => a - b);
      const totalRequests = Array.from(statusCounts.values()).reduce((a, b) => a + b, 0);
      const base: Omit<LoadReport, "pass"> = {
        date: new Date().toISOString(),
        scenario: opts.scenario,
        tool: opts.tool,
        target: { url: opts.targetUrl, endpoint: opts.endpoint },
        durationSec,
        targetRps: opts.targetRps,
        achievedRps: durationSec > 0 ? totalRequests / durationSec : 0,
        totalRequests,
        totalSpans: totalRequests * opts.spansPerRequest,
        spansPerRequest: opts.spansPerRequest,
        latency: {
          p50Ms: percentile(sorted, 50),
          p95Ms: percentile(sorted, 95),
          p99Ms: percentile(sorted, 99),
          p999Ms: percentile(sorted, 99.9),
          maxMs: sorted.length > 0 ? sorted[sorted.length - 1]! : 0,
        },
        errorRate: totalRequests > 0 ? errors / totalRequests : 0,
        status: Object.fromEntries(statusCounts),
        orgIds: opts.orgIds,
        passCriteria,
      };
      const pass = passPredicate(base as LoadReport);
      return { ...base, pass };
    },
  };
}

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

export async function writeReport(report: LoadReport, path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(report, null, 2) + "\n", "utf8");
}

/**
 * Parse a k6 JSON summary (emitted by `k6 run --summary-export=...`) into a
 * `LoadReport`. k6's summary is machine-readable but k6-shaped; we flatten the
 * pieces that matter for the program's gate policy.
 *
 * k6 summary shape (as of v0.50): `{ metrics: { http_req_duration: { values: { "p(50)": …, "p(95)": …, "p(99)": … }}, http_reqs: { values: { rate: …, count: … } }, ... } }`
 */
export function k6SummaryToReport(
  summary: unknown,
  meta: {
    scenario: string;
    targetUrl: string;
    endpoint: string;
    targetRps: number;
    spansPerRequest: number;
    orgIds: readonly string[];
    durationSec: number;
    passCriteria: string;
    passPredicate: (p: LoadReport) => boolean;
    commit?: string;
    host?: string;
    notes?: string;
  },
): LoadReport {
  const s = summary as {
    metrics?: Record<string, { values?: Record<string, number> }>;
  };
  const dur = s.metrics?.["http_req_duration"]?.values ?? {};
  const reqs = s.metrics?.["http_reqs"]?.values ?? {};
  const failed = s.metrics?.["http_req_failed"]?.values ?? {};
  const statusEntries: Array<[string, number]> = [];
  for (const [k, v] of Object.entries(s.metrics ?? {})) {
    if (k.startsWith("status_") && typeof v?.values?.["count"] === "number") {
      statusEntries.push([k.replace(/^status_/, ""), v.values["count"]]);
    }
  }
  const totalRequests = Number(reqs["count"] ?? 0);
  const achievedRps = Number(reqs["rate"] ?? 0);
  const base: Omit<LoadReport, "pass"> = {
    date: new Date().toISOString(),
    scenario: meta.scenario,
    tool: "k6",
    target: { url: meta.targetUrl, endpoint: meta.endpoint },
    durationSec: meta.durationSec,
    targetRps: meta.targetRps,
    achievedRps,
    totalRequests,
    totalSpans: totalRequests * meta.spansPerRequest,
    spansPerRequest: meta.spansPerRequest,
    latency: {
      p50Ms: Number(dur["p(50)"] ?? dur["med"] ?? 0),
      p95Ms: Number(dur["p(95)"] ?? 0),
      p99Ms: Number(dur["p(99)"] ?? 0),
      p999Ms: Number(dur["p(99.9)"] ?? 0),
      maxMs: Number(dur["max"] ?? 0),
    },
    errorRate: Number(failed["rate"] ?? 0),
    status: Object.fromEntries(statusEntries),
    orgIds: meta.orgIds,
    passCriteria: meta.passCriteria,
    ...(meta.commit !== undefined ? { commit: meta.commit } : {}),
    ...(meta.host !== undefined ? { host: meta.host } : {}),
    ...(meta.notes !== undefined ? { notes: meta.notes } : {}),
  };
  const pass = meta.passPredicate(base as LoadReport);
  return { ...base, pass };
}

/**
 * Default gate predicate used by CI. First run (no baseline) always passes.
 * Subsequent runs enforce the program's regression thresholds.
 */
export function defaultGate(report: LoadReport, prior?: LoadReport): boolean {
  if (report.errorRate > 0.01) return false;
  if (!prior) return true;
  if (report.latency.p99Ms > prior.latency.p99Ms * 1.2) return false;
  if (report.achievedRps < prior.achievedRps * 0.85) return false;
  return true;
}
