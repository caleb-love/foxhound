/**
 * Foxhound Worker — background job processor.
 *
 * Runs as a separate process from the API server.
 * Consumes BullMQ jobs from Redis for:
 *   - LLM-as-a-Judge evaluator runs
 *   - (Future: experiment runs, dataset curation, etc.)
 */

import type { ConnectionOptions } from "bullmq";
import { startEvaluatorWorker } from "./queues/evaluator.js";
import { startExperimentWorker } from "./queues/experiment.js";

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

// Start evaluator worker
const evaluatorWorker = startEvaluatorWorker(connection);
console.log("[worker] Evaluator worker started (concurrency: 10)");

// Start experiment worker
const experimentWorker = startExperimentWorker(connection);
console.log("[worker] Experiment worker started (concurrency: 5)");

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] Received ${signal}, shutting down...`);
  await Promise.all([evaluatorWorker.close(), experimentWorker.close()]);
  console.log("[worker] Shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
