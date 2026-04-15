/**
 * Optional BullMQ queue connection for the API server.
 * Used to enqueue evaluator jobs for the worker process.
 * Returns null if REDIS_URL is not configured (e.g., self-hosted without worker).
 */

import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";

const EVALUATOR_QUEUE_NAME = "evaluator-runs";
const EXPERIMENT_QUEUE_NAME = "experiment-runs";
const COST_MONITOR_QUEUE = "cost-monitor";
const SLA_SCHEDULER_QUEUE = "sla-scheduler";
const REGRESSION_DETECTOR_QUEUE = "regression-detector";

interface QueueCache {
  initialized: boolean;
  queue: Queue | null;
}

const queueCaches: Record<string, QueueCache> = {
  [EVALUATOR_QUEUE_NAME]: { initialized: false, queue: null },
  [EXPERIMENT_QUEUE_NAME]: { initialized: false, queue: null },
  [COST_MONITOR_QUEUE]: { initialized: false, queue: null },
  [SLA_SCHEDULER_QUEUE]: { initialized: false, queue: null },
  [REGRESSION_DETECTOR_QUEUE]: { initialized: false, queue: null },
};

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

function getQueue(queueName: string): Queue | null {
  const cache = queueCaches[queueName];
  if (!cache) return null;
  if (cache.initialized) return cache.queue;
  cache.initialized = true;

  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) return null;

  try {
    cache.queue = new Queue(queueName, { connection: parseRedisUrl(redisUrl) });
  } catch {
    // Redis not available — queue stays null and callers fall back to degraded behavior.
  }

  return cache.queue;
}

export function getEvaluatorQueue(): Queue | null {
  return getQueue(EVALUATOR_QUEUE_NAME);
}

export function getExperimentQueue(): Queue | null {
  return getQueue(EXPERIMENT_QUEUE_NAME);
}

export function getCostMonitorQueue(): Queue | null {
  return getQueue(COST_MONITOR_QUEUE);
}

export function getSlaSchedulerQueue(): Queue | null {
  return getQueue(SLA_SCHEDULER_QUEUE);
}

export function getRegressionDetectorQueue(): Queue | null {
  return getQueue(REGRESSION_DETECTOR_QUEUE);
}
