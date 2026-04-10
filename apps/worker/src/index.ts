import type { ConnectionOptions } from "bullmq";
import { Queue } from "bullmq";
import { startEvaluatorWorker } from "./queues/evaluator.js";
import { startExperimentWorker } from "./queues/experiment.js";
import { startCostMonitorWorker } from "./queues/cost-monitor.js";
import { startCostReconcilerWorker, COST_RECONCILER_QUEUE } from "./queues/cost-reconciler.js";
import { startSlaSchedulerWorker, SLA_SCHEDULER_QUEUE } from "./queues/sla-scheduler.js";
import { startSlaCheckWorker } from "./queues/sla-check.js";
import { startRegressionDetectorWorker } from "./queues/regression-detector.js";

const redisUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

const connection = parseRedisUrl(redisUrl);

console.log("[worker] Starting Foxhound worker...");
console.log(`[worker] Redis: ${redisUrl.replace(/\/\/.*@/, "//***@")}`);

// Phase 2 workers
const evaluatorWorker = startEvaluatorWorker(connection);
console.log("[worker] Evaluator worker started (concurrency: 10)");

const experimentWorker = startExperimentWorker(connection);
console.log("[worker] Experiment worker started (concurrency: 5)");

// Phase 4 workers
const costMonitorWorker = startCostMonitorWorker(connection);
console.log("[worker] Cost monitor worker started (concurrency: 10)");

const costReconcilerWorker = startCostReconcilerWorker(connection);
console.log("[worker] Cost reconciler worker started (concurrency: 1)");

const slaSchedulerWorker = startSlaSchedulerWorker(connection);
console.log("[worker] SLA scheduler worker started (concurrency: 1)");

const slaCheckWorker = startSlaCheckWorker(connection);
console.log("[worker] SLA check worker started (concurrency: 10)");

const regressionWorker = startRegressionDetectorWorker(connection);
console.log("[worker] Regression detector worker started (concurrency: 3)");

// Set up repeatable jobs
async function setupRepeatableJobs(): Promise<void> {
  // SLA scheduler: run every 60 seconds
  const slaQueue = new Queue(SLA_SCHEDULER_QUEUE, { connection });
  await slaQueue.add("sla-schedule", {}, {
    repeat: { every: 60_000 },
    jobId: "sla-schedule-repeatable",
  });
  console.log("[worker] SLA scheduler repeatable job configured (every 60s)");

  // Cost reconciler: run every 5 minutes
  const reconcilerQueue = new Queue(COST_RECONCILER_QUEUE, { connection });
  await reconcilerQueue.add("reconcile", {}, {
    repeat: { every: 300_000 },
    jobId: "cost-reconcile-repeatable",
  });
  console.log("[worker] Cost reconciler repeatable job configured (every 5m)");
}

void setupRepeatableJobs();

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] Received ${signal}, shutting down...`);
  await Promise.all([
    evaluatorWorker.close(),
    experimentWorker.close(),
    costMonitorWorker.close(),
    costReconcilerWorker.close(),
    slaSchedulerWorker.close(),
    slaCheckWorker.close(),
    regressionWorker.close(),
  ]);
  console.log("[worker] Shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
