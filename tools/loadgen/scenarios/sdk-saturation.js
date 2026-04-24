#!/usr/bin/env node
// WP06 SDK saturation scenario.
//
// Run after building the TS SDK:
//   pnpm --filter @foxhound-ai/sdk build
//   node tools/loadgen/scenarios/sdk-saturation.js
//
// This is an SDK-side gate, not an API ingest test. It saturates the
// BatchSpanProcessor queue with a slow fake transport and reports caller-thread
// enqueue latency percentiles. Program target: p99 < 1 ms.

import { performance } from "node:perf_hooks";
import { BatchSpanProcessor } from "../../../packages/sdk/dist/index.js";

const DURATION_MS = intEnv("SDK_SATURATION_DURATION_MS", 10_000);
const TARGET_RPS = intEnv("SDK_SATURATION_RPS", 10_000);
const MAX_QUEUE_SIZE = intEnv("SDK_SATURATION_MAX_QUEUE_SIZE", 2048);
const MAX_EXPORT_BATCH_SIZE = intEnv("SDK_SATURATION_MAX_EXPORT_BATCH_SIZE", 512);
const TRANSPORT_DELAY_MS = intEnv("SDK_SATURATION_TRANSPORT_DELAY_MS", 25);

const sent = [];
const transport = {
  wireFormat: "protobuf",
  async send(trace) {
    await sleep(TRANSPORT_DELAY_MS);
    sent.push(trace.id);
    return {
      status: 202,
      wireFormat: "protobuf",
      payloadBytes: 0,
      headers: new Headers(),
    };
  },
  async close() {},
};

const drops = [];
const processor = new BatchSpanProcessor({
  transport,
  maxQueueSize: MAX_QUEUE_SIZE,
  maxExportBatchSize: MAX_EXPORT_BATCH_SIZE,
  scheduleDelayMs: 2000,
  backpressurePolicy: "drop-oldest",
  onDrop: (trace) => drops.push(trace.id),
});

const latenciesMs = [];
const intervalMs = 1000 / TARGET_RPS;
const startMs = performance.now();
let nextAtMs = startMs;
let produced = 0;

while (performance.now() - startMs < DURATION_MS) {
  const now = performance.now();
  if (now < nextAtMs) {
    await sleep(Math.min(nextAtMs - now, 5));
    continue;
  }

  const enqueueStart = performance.now();
  processor.enqueue(makeTrace(`sdk-saturation-${produced}`));
  latenciesMs.push(performance.now() - enqueueStart);
  produced += 1;
  nextAtMs += intervalMs;
}

const drained = await processor.shutdown(5000);
latenciesMs.sort((a, b) => a - b);
const report = {
  scenario: "sdk-saturation",
  produced,
  sent: sent.length,
  dropped: drops.length,
  drained,
  targetRps: TARGET_RPS,
  durationMs: DURATION_MS,
  queue: {
    maxQueueSize: MAX_QUEUE_SIZE,
    maxExportBatchSize: MAX_EXPORT_BATCH_SIZE,
    backpressurePolicy: "drop-oldest",
  },
  enqueueLatencyMs: {
    p50: percentile(latenciesMs, 50),
    p95: percentile(latenciesMs, 95),
    p99: percentile(latenciesMs, 99),
    max: latenciesMs.at(-1) ?? 0,
  },
  pass: percentile(latenciesMs, 99) < 1,
};

console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;

function makeTrace(id) {
  return {
    id,
    agentId: "sdk-saturation-agent",
    spans: [],
    startTimeMs: Date.now(),
    endTimeMs: Date.now(),
    metadata: {},
  };
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const index = Math.min(values.length - 1, Math.ceil((p / 100) * values.length) - 1);
  return values[index];
}

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
