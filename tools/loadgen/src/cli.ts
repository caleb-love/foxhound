/**
 * Orchestrator for the Foxhound scale load harness.
 *
 * Two modes:
 *  - k6 mode (preferred; requires `k6` on PATH):
 *      spawn `k6 run tools/loadgen/scenarios/<scenario>.js --summary-export=…`
 *      then pipe the JSON summary through `k6SummaryToReport`.
 *  - Node orchestrator mode (fallback, no external dep):
 *      fire concurrent `fetch` workers from this process and sample latencies
 *      with `createAccumulator`. This mode exists so the harness runs even on
 *      hosts where k6 is not installable; it does NOT replace k6 for the
 *      program's numeric gates at 35k RPS.
 *
 * Run: `pnpm --filter @foxhound/loadgen scale [flags]` or `pnpm load:scale`
 *
 * Flags:
 *   --scenario=baseline|burst|sustained|smoke   (default: smoke)
 *   --target=http://localhost:3000              (default: env LOAD_TEST_URL or http://localhost:3000)
 *   --rps=<int>                                 (override scenario default)
 *   --duration=<seconds>                        (override scenario default)
 *   --api-key=<foxhound key>                    (default: env LOAD_TEST_API_KEY)
 *   --tool=k6|node                              (default: auto-detect k6)
 *   --out=<path>                                (default: tools/loadgen/last-run.json)
 *   --concurrency=<int>                         (node mode only; default 64)
 *   --spans-per-trace=<int>                     (default 4)
 *   --traces-per-req=<int>                      (default 1; k6 batching set by scenario)
 *   --seed=<int>                                (deterministic; default Date.now)
 *   --org-ids=<csv>                             (default: org_a,org_b,org_c)
 *   --notes="<string>"                          (stamped into the report)
 */
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { hostname } from "node:os";
import {
  createAccumulator,
  defaultGate,
  k6SummaryToReport,
  writeReport,
  type LoadReport,
} from "./report.js";
import { createRng, generateBatch } from "./generate-spans.js";

// ---------------------------------------------------------------------------
// Scenario definitions. k6 scenarios in `scenarios/*.js` mirror these values.
// ---------------------------------------------------------------------------

interface Scenario {
  readonly name: string;
  readonly targetRps: number;
  readonly durationSec: number;
  readonly k6Script: string;
  readonly passCriteria: string;
}

const SCENARIOS: Readonly<Record<string, Scenario>> = {
  smoke: {
    name: "smoke",
    targetRps: 50,
    durationSec: 10,
    k6Script: "tools/loadgen/scenarios/ingest-baseline.js",
    passCriteria: "error_rate < 1%; no crash",
  },
  baseline: {
    name: "baseline",
    targetRps: 1_000,
    durationSec: 300,
    k6Script: "tools/loadgen/scenarios/ingest-baseline.js",
    passCriteria: "error_rate < 1%; p99 not regressed > 20% vs last green; achieved_rps >= 85% of last green",
  },
  burst: {
    name: "burst",
    targetRps: 10_000,
    durationSec: 300,
    k6Script: "tools/loadgen/scenarios/ingest-burst.js",
    passCriteria: "error_rate < 1%; p99 not regressed > 20% vs last green",
  },
  sustained: {
    name: "sustained",
    targetRps: 35_000,
    durationSec: 1800,
    k6Script: "tools/loadgen/scenarios/ingest-sustained.js",
    passCriteria: "error_rate < 1%; p99 < 500ms (program target)",
  },
  otlp: {
    name: "otlp",
    targetRps: 1_000,
    durationSec: 300,
    k6Script: "tools/loadgen/scenarios/ingest-otlp.js",
    passCriteria: "error_rate < 1%; p99 ≥ 20% better than JSON baseline (RFC-004)",
  },
};

// ---------------------------------------------------------------------------
// Flag parsing (zero-dep).
// ---------------------------------------------------------------------------

function parseFlags(argv: readonly string[]): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const arg of argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) out[arg.slice(2)] = "true";
    else out[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// k6 detection.
// ---------------------------------------------------------------------------

async function hasK6(): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const child = spawn("k6", ["version"], { stdio: "ignore" });
    child.on("error", () => resolvePromise(false));
    child.on("close", (code) => resolvePromise(code === 0));
  });
}

// ---------------------------------------------------------------------------
// Run mode: k6.
// ---------------------------------------------------------------------------

async function runK6(
  scenario: Scenario,
  meta: {
    targetUrl: string;
    endpoint: string;
    apiKey: string;
    orgIds: readonly string[];
    rpsOverride?: number;
    durationOverride?: number;
    spansPerTrace: number;
    seed: number;
    notes?: string;
  }
): Promise<LoadReport> {
  const summaryPath = resolve(process.cwd(), "tools/loadgen/.k6-summary.json");
  await mkdir(dirname(summaryPath), { recursive: true });

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    LOAD_TEST_URL: meta.targetUrl,
    LOAD_TEST_API_KEY: meta.apiKey,
    LOAD_TEST_RPS: String(meta.rpsOverride ?? scenario.targetRps),
    LOAD_TEST_DURATION: String(meta.durationOverride ?? scenario.durationSec),
    LOAD_TEST_ORG_IDS: meta.orgIds.join(","),
    LOAD_TEST_SPANS_PER_TRACE: String(meta.spansPerTrace),
    LOAD_TEST_SEED: String(meta.seed),
  };

  const args = ["run", scenario.k6Script, `--summary-export=${summaryPath}`];
  const started = Date.now();
  const exitCode = await new Promise<number>((resolvePromise, reject) => {
    const proc = spawn("k6", args, { stdio: "inherit", env });
    proc.on("error", reject);
    proc.on("close", (code) => resolvePromise(code ?? 1));
  });
  const elapsedSec = (Date.now() - started) / 1000;
  if (exitCode !== 0 && exitCode !== 99) {
    // k6 returns 99 when a threshold failed but the run completed; accept that
    // and let the report's own `pass` decide.
    throw new Error(`k6 exited with code ${exitCode}`);
  }

  const raw = await readFile(summaryPath, "utf8");
  const summary = JSON.parse(raw) as unknown;

  const prior = await loadPriorReport();
  const report = k6SummaryToReport(summary, {
    scenario: scenario.name,
    targetUrl: meta.targetUrl,
    endpoint: meta.endpoint,
    targetRps: meta.rpsOverride ?? scenario.targetRps,
    spansPerRequest: meta.spansPerTrace,
    orgIds: meta.orgIds,
    durationSec: elapsedSec,
    passCriteria: scenario.passCriteria,
    passPredicate: (r) => defaultGate(r, prior),
    ...(process.env["GITHUB_SHA"] !== undefined ? { commit: process.env["GITHUB_SHA"] } : {}),
    host: hostname(),
    ...(meta.notes !== undefined ? { notes: meta.notes } : {}),
  });
  return report;
}

// ---------------------------------------------------------------------------
// Run mode: Node orchestrator (no k6).
// ---------------------------------------------------------------------------

async function runNode(
  scenario: Scenario,
  meta: {
    targetUrl: string;
    endpoint: string;
    apiKey: string;
    orgIds: readonly string[];
    rpsOverride?: number;
    durationOverride?: number;
    concurrency: number;
    spansPerTrace: number;
    tracesPerReq: number;
    seed: number;
    notes?: string;
  }
): Promise<LoadReport> {
  const targetRps = meta.rpsOverride ?? scenario.targetRps;
  const durationSec = meta.durationOverride ?? scenario.durationSec;
  const acc = createAccumulator({
    scenario: scenario.name,
    tool: "node-orchestrator",
    targetUrl: meta.targetUrl,
    endpoint: meta.endpoint,
    targetRps,
    spansPerRequest: meta.spansPerTrace * meta.tracesPerReq,
    orgIds: meta.orgIds,
  });

  const url = `${meta.targetUrl.replace(/\/$/, "")}${meta.endpoint}`;
  const rng = createRng(meta.seed);
  const interval = 1000 / Math.max(1, Math.floor(targetRps / meta.concurrency));
  const endAt = Date.now() + durationSec * 1000;

  const worker = async (): Promise<void> => {
    while (Date.now() < endAt) {
      const body = JSON.stringify(
        generateBatch({
          rng,
          orgIds: meta.orgIds,
          tracesPerOrg: Math.max(1, Math.floor(meta.tracesPerReq / meta.orgIds.length)),
          spansPerTrace: meta.spansPerTrace,
        })
      );
      const started = performance.now();
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${meta.apiKey}`,
          },
          body,
        });
        acc.recordStatus(res.status);
        if (!res.ok) acc.recordError();
      } catch {
        acc.recordStatus(0);
        acc.recordError();
      } finally {
        acc.pushLatency(performance.now() - started);
      }
      const sleep = interval - (performance.now() - started);
      if (sleep > 0) await new Promise((r) => setTimeout(r, sleep));
    }
  };

  const started = Date.now();
  await Promise.all(Array.from({ length: meta.concurrency }, () => worker()));
  const elapsed = (Date.now() - started) / 1000;

  const prior = await loadPriorReport();
  return acc.finalize({
    durationSec: elapsed,
    passCriteria: scenario.passCriteria,
    passPredicate: (r) => defaultGate(r, prior),
  });
}

// ---------------------------------------------------------------------------
// Prior report (for regression gate).
// ---------------------------------------------------------------------------

async function loadPriorReport(): Promise<LoadReport | undefined> {
  const path = resolve(process.cwd(), "tools/loadgen/last-run.json");
  if (!existsSync(path)) return undefined;
  try {
    const st = await stat(path);
    if (!st.isFile()) return undefined;
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as LoadReport;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Summary writer: append to docs/reference/load-tests.md.
// ---------------------------------------------------------------------------

async function appendMarkdownRow(report: LoadReport): Promise<void> {
  const path = resolve(process.cwd(), "docs/reference/load-tests.md");
  if (!existsSync(path)) return; // page not present; skip silently
  const row =
    `| ${report.date} | ${report.scenario} | ${report.tool} | ` +
    `${report.targetRps.toLocaleString()} | ${report.achievedRps.toFixed(0)} | ` +
    `${report.latency.p50Ms.toFixed(0)} | ${report.latency.p95Ms.toFixed(0)} | ` +
    `${report.latency.p99Ms.toFixed(0)} | ${(report.errorRate * 100).toFixed(2)}% | ` +
    `${report.pass ? "✅" : "❌"} | ${report.notes ?? ""} |\n`;
  const existing = await readFile(path, "utf8");
  const marker = "<!-- LOAD_TEST_APPEND -->";
  if (!existing.includes(marker)) return;
  const updated = existing.replace(marker, `${marker}\n${row}`);
  await writeFile(path, updated, "utf8");
}

// ---------------------------------------------------------------------------
// Entry.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseFlags(process.argv);
  const scenarioName = flags["scenario"] ?? "smoke";
  const scenario = SCENARIOS[scenarioName];
  if (!scenario) {
    console.error(`unknown scenario: ${scenarioName}. valid: ${Object.keys(SCENARIOS).join(", ")}`);
    process.exit(2);
  }

  const targetUrl = flags["target"] ?? process.env["LOAD_TEST_URL"] ?? "http://localhost:3000";
  const endpoint = "/v1/traces/otlp";
  const apiKey = flags["api-key"] ?? process.env["LOAD_TEST_API_KEY"] ?? "";
  if (!apiKey) {
    console.error("LOAD_TEST_API_KEY (or --api-key=) is required");
    process.exit(2);
  }

  const orgIds = (flags["org-ids"] ?? "org_a,org_b,org_c")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const seed = Number(flags["seed"] ?? Date.now());
  const tool = flags["tool"] ?? ((await hasK6()) ? "k6" : "node");
  const rpsOverride = flags["rps"] ? Number(flags["rps"]) : undefined;
  const durationOverride = flags["duration"] ? Number(flags["duration"]) : undefined;
  const spansPerTrace = Number(flags["spans-per-trace"] ?? 4);
  const tracesPerReq = Number(flags["traces-per-req"] ?? 1);
  const concurrency = Number(flags["concurrency"] ?? 64);
  const notes = flags["notes"];

  const meta = {
    targetUrl,
    endpoint,
    apiKey,
    orgIds,
    ...(rpsOverride !== undefined ? { rpsOverride } : {}),
    ...(durationOverride !== undefined ? { durationOverride } : {}),
    spansPerTrace,
    tracesPerReq,
    seed,
    ...(notes !== undefined ? { notes } : {}),
  };

  console.log(
    `[loadgen] scenario=${scenario.name} tool=${tool} target=${targetUrl}${endpoint} ` +
      `rps=${rpsOverride ?? scenario.targetRps} duration=${durationOverride ?? scenario.durationSec}s ` +
      `orgIds=${orgIds.join(",")} seed=${seed}`
  );

  const report =
    tool === "k6"
      ? await runK6(scenario, meta)
      : await runNode(scenario, { ...meta, concurrency });

  const outPath = flags["out"] ?? "tools/loadgen/last-run.json";
  await writeReport(report, resolve(process.cwd(), outPath));
  await appendMarkdownRow(report);

  console.log(
    `[loadgen] done: achievedRps=${report.achievedRps.toFixed(0)} ` +
      `p50=${report.latency.p50Ms.toFixed(0)}ms ` +
      `p95=${report.latency.p95Ms.toFixed(0)}ms ` +
      `p99=${report.latency.p99Ms.toFixed(0)}ms ` +
      `err=${(report.errorRate * 100).toFixed(2)}% ` +
      `pass=${report.pass}`
  );
  console.log(`[loadgen] report written → ${outPath}`);

  process.exit(report.pass ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
