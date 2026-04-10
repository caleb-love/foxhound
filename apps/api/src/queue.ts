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

const EXPERIMENT_QUEUE_NAME = "experiment-runs";

let experimentQueue: Queue | null = null;
let experimentInitialized = false;

export function getExperimentQueue(): Queue | null {
  if (experimentInitialized) return experimentQueue;
  experimentInitialized = true;

  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) return null;

  try {
    const connection = parseRedisUrl(redisUrl);
    experimentQueue = new Queue(EXPERIMENT_QUEUE_NAME, { connection });
  } catch {
    // Redis not available — experiment runs will stay in "pending" state
  }

  return experimentQueue;
}

const COST_MONITOR_QUEUE = "cost-monitor";

let costMonitorQueue: Queue | null = null;
let costMonitorInitialized = false;

export function getCostMonitorQueue(): Queue | null {
  if (costMonitorInitialized) return costMonitorQueue;
  costMonitorInitialized = true;
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) return null;
  try {
    costMonitorQueue = new Queue(COST_MONITOR_QUEUE, { connection: parseRedisUrl(redisUrl) });
  } catch {}
  return costMonitorQueue;
}

const SLA_SCHEDULER_QUEUE = "sla-scheduler";

let slaSchedulerQueue: Queue | null = null;
let slaSchedulerInitialized = false;

export function getSlaSchedulerQueue(): Queue | null {
  if (slaSchedulerInitialized) return slaSchedulerQueue;
  slaSchedulerInitialized = true;
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) return null;
  try {
    slaSchedulerQueue = new Queue(SLA_SCHEDULER_QUEUE, { connection: parseRedisUrl(redisUrl) });
  } catch {}
  return slaSchedulerQueue;
}

const REGRESSION_DETECTOR_QUEUE = "regression-detector";

let regressionQueue: Queue | null = null;
let regressionInitialized = false;

export function getRegressionDetectorQueue(): Queue | null {
  if (regressionInitialized) return regressionQueue;
  regressionInitialized = true;
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) return null;
  try {
    regressionQueue = new Queue(REGRESSION_DETECTOR_QUEUE, { connection: parseRedisUrl(redisUrl) });
  } catch {}
  return regressionQueue;
}
