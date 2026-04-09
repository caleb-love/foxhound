/**
 * Optional BullMQ queue connection for the API server.
 * Used to enqueue evaluator jobs for the worker process.
 * Returns null if REDIS_URL is not configured (e.g., self-hosted without worker).
 */

import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";

const EVALUATOR_QUEUE_NAME = "evaluator-runs";

let evaluatorQueue: Queue | null = null;
let initialized = false;

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

export function getEvaluatorQueue(): Queue | null {
  if (initialized) return evaluatorQueue;
  initialized = true;

  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) return null;

  try {
    const connection = parseRedisUrl(redisUrl);
    evaluatorQueue = new Queue(EVALUATOR_QUEUE_NAME, { connection });
  } catch {
    // Redis not available — evaluator runs will stay in "pending" state
    // until a worker picks them up via polling
  }

  return evaluatorQueue;
}
