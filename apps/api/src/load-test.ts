/**
 * Load test for POST /v1/traces/otlp
 *
 * Run:  LOAD_TEST_API_KEY=fh_xxx tsx apps/api/src/load-test.ts
 *
 * Env vars:
 *   LOAD_TEST_URL       — Base URL (default: http://localhost:3000)
 *   LOAD_TEST_API_KEY   — Required. Foxhound API key.
 *   LOAD_TEST_RPS       — Requests per second (default: 100)
 *   LOAD_TEST_DURATION  — Duration in seconds (default: 30)
 */

const BASE_URL = process.env["LOAD_TEST_URL"] ?? "http://localhost:3000";
const API_KEY = process.env["LOAD_TEST_API_KEY"];
const RPS = Number(process.env["LOAD_TEST_RPS"] ?? "100");
const DURATION_S = Number(process.env["LOAD_TEST_DURATION"] ?? "30");

if (!API_KEY) {
  console.error("LOAD_TEST_API_KEY is required");
  process.exit(1);
}

const ENDPOINT = `${BASE_URL}/v1/traces/otlp`;

function randomHex(bytes: number): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < bytes * 2; i++) {
    out += chars[Math.floor(Math.random() * 16)];
  }
  return out;
}

const randomTraceId = (): string => randomHex(16);
const randomSpanId = (): string => randomHex(8);

const SPAN_TEMPLATES = [
  { name: "llm.generate", kind: 3, attrs: { "gen_ai.system": "openai", "gen_ai.request.model": "gpt-4o", "gen_ai.usage.input_tokens": 512, "gen_ai.usage.output_tokens": 256 } },
  { name: "llm.embed", kind: 3, attrs: { "gen_ai.system": "openai", "gen_ai.request.model": "text-embedding-3-small", "gen_ai.usage.input_tokens": 128 } },
  { name: "tool.search", kind: 3, attrs: { "tool.name": "vector_search", "tool.result_count": 5 } },
  { name: "tool.sql_query", kind: 3, attrs: { "tool.name": "sql_query", "db.system": "postgresql", "db.statement": "SELECT * FROM docs WHERE ..." } },
  { name: "agent.step", kind: 1, attrs: { "agent.step_index": 0, "agent.reasoning": "Analyzing user request" } },
  { name: "agent.plan", kind: 1, attrs: { "agent.step_index": 1, "agent.reasoning": "Creating execution plan" } },
  { name: "workflow.orchestrate", kind: 2, attrs: { "workflow.name": "rag_pipeline", "workflow.version": "1.2.0" } },
  { name: "retrieval.rerank", kind: 1, attrs: { "retrieval.strategy": "cohere_rerank", "retrieval.top_k": 10 } },
] as const;

function nanoTimestamp(offsetMs: number): string {
  return String(BigInt(Date.now() + offsetMs) * BigInt(1_000_000));
}

function buildPayload(): string {
  const traceId = randomTraceId();
  const spanCount = 2 + Math.floor(Math.random() * 4); // 2-5 spans
  const rootSpanId = randomSpanId();
  const spans: unknown[] = [];
  let prevSpanId = rootSpanId;

  for (let i = 0; i < spanCount; i++) {
    const template = SPAN_TEMPLATES[Math.floor(Math.random() * SPAN_TEMPLATES.length)]!;
    const spanId = i === 0 ? rootSpanId : randomSpanId();
    const parentSpanId = i === 0 ? undefined : prevSpanId;
    const startOffset = i * 50;
    const durationMs = 20 + Math.floor(Math.random() * 200);

    const attributes = Object.entries(template.attrs).map(([key, value]) => ({
      key,
      value: typeof value === "number" ? { intValue: value } : { stringValue: String(value) },
    }));

    spans.push({
      traceId,
      spanId,
      parentSpanId,
      name: template.name,
      kind: template.kind,
      startTimeUnixNano: nanoTimestamp(startOffset),
      endTimeUnixNano: nanoTimestamp(startOffset + durationMs),
      status: { code: Math.random() < 0.05 ? 2 : 1 },
      attributes,
      events: i === 0
        ? [{ timeUnixNano: nanoTimestamp(startOffset + 5), name: "request.start", attributes: [] }]
        : [],
    });
    prevSpanId = spanId;
  }

  return JSON.stringify({
    resourceSpans: [{
      resource: {
        attributes: [
          { key: "service.name", value: { stringValue: "load-test-agent" } },
          { key: "service.instance.id", value: { stringValue: `session-${randomHex(4)}` } },
          { key: "service.version", value: { stringValue: "0.1.0" } },
        ],
      },
      scopeSpans: [{ spans }],
    }],
  });
}

interface Stats {
  readonly total: number;
  readonly success: number;
  readonly fail: number;
  readonly statusCounts: ReadonlyMap<number, number>;
  readonly latencies: readonly number[];
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)]!;
}

function printReport(stats: Stats, elapsedMs: number): void {
  const sorted = [...stats.latencies].sort((a, b) => a - b);
  const elapsedS = elapsedMs / 1000;

  console.log("\n--- Load Test Results ---");
  console.log(`Duration:       ${elapsedS.toFixed(1)}s`);
  console.log(`Total requests: ${stats.total}`);
  console.log(`Success:        ${stats.success}`);
  console.log(`Failed:         ${stats.fail}`);
  console.log(`Throughput:     ${(stats.total / elapsedS).toFixed(1)} req/s`);
  console.log("\nStatus code distribution:");
  for (const [code, count] of stats.statusCounts) {
    console.log(`  ${code}: ${count}`);
  }
  console.log("\nLatency:");
  console.log(`  p50: ${percentile(sorted, 50).toFixed(1)}ms`);
  console.log(`  p95: ${percentile(sorted, 95).toFixed(1)}ms`);
  console.log(`  p99: ${percentile(sorted, 99).toFixed(1)}ms`);
  console.log(`  min: ${(sorted[0] ?? 0).toFixed(1)}ms`);
  console.log(`  max: ${(sorted[sorted.length - 1] ?? 0).toFixed(1)}ms`);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function sendRequest(
  latencies: number[],
  statusCounts: Map<number, number>,
  counters: { success: number; fail: number; total: number },
): Promise<void> {
  const body = buildPayload();
  const start = performance.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body,
    });
    const latency = performance.now() - start;
    latencies.push(latency);
    statusCounts.set(res.status, (statusCounts.get(res.status) ?? 0) + 1);
    if (res.status === 202) {
      counters.success++;
    } else {
      counters.fail++;
    }
  } catch {
    const latency = performance.now() - start;
    latencies.push(latency);
    counters.fail++;
    statusCounts.set(0, (statusCounts.get(0) ?? 0) + 1);
  }
  counters.total++;
}

async function run(): Promise<void> {
  console.log(`Load test: ${ENDPOINT}`);
  console.log(`Target:    ${RPS} req/s for ${DURATION_S}s (${RPS * DURATION_S} total requests)\n`);

  const latencies: number[] = [];
  const statusCounts = new Map<number, number>();
  const counters = { success: 0, fail: 0, total: 0 };
  const globalStart = performance.now();

  for (let window = 0; window < DURATION_S; window++) {
    const windowStart = performance.now();

    const batch = Array.from({ length: RPS }, () =>
      sendRequest(latencies, statusCounts, counters),
    );
    await Promise.all(batch);

    // Pad the remainder of the 1s window to enforce the target rate
    const remaining = 1000 - (performance.now() - windowStart);
    if (remaining > 0 && window < DURATION_S - 1) {
      await sleep(remaining);
    }

    const totalElapsed = (performance.now() - globalStart) / 1000;
    if ((window + 1) % 5 === 0 || window === DURATION_S - 1) {
      process.stdout.write(
        `\r  [${totalElapsed.toFixed(0)}s] sent=${counters.total} ok=${counters.success} fail=${counters.fail}`,
      );
    }
  }

  printReport(
    { total: counters.total, success: counters.success, fail: counters.fail, statusCounts, latencies },
    performance.now() - globalStart,
  );
}

run().catch((err) => {
  console.error("Load test crashed:", err);
  process.exit(1);
});
