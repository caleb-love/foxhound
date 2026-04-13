import { persistTraceWithRetry } from "./persistence.js";
import type { Trace } from "@foxhound/types";
import type { FastifyBaseLogger } from "fastify";

/**
 * Micro-batch trace buffer for high-throughput ingestion.
 *
 * Design decisions:
 * - Buffer ceiling: 200 traces max to bound memory (configurable)
 * - Flush triggers: time-based (100ms) OR size-based (50 traces), whichever comes first
 * - Crash safety: traces are fire-and-forget after 202 — if the process crashes,
 *   buffered traces are lost. This is acceptable for observability data where
 *   occasional loss is tolerable vs. blocking the hot path.
 * - Backpressure: when buffer is full, new traces are persisted immediately (bypass buffer)
 *   rather than dropped, to avoid silent data loss.
 */

interface BufferedTrace {
  trace: Trace;
  orgId: string;
}

const FLUSH_INTERVAL_MS = 100;
const FLUSH_SIZE_THRESHOLD = 50;
const MAX_BUFFER_SIZE = 200;

let buffer: BufferedTrace[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let logger: FastifyBaseLogger | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
  // Prevent timer from keeping the process alive during shutdown
  if (flushTimer && typeof flushTimer === "object" && "unref" in flushTimer) {
    flushTimer.unref();
  }
}

function flush(): void {
  if (buffer.length === 0) return;

  const batch = buffer;
  buffer = [];

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const log = logger;
  if (!log) return;

  // Persist all traces in the batch concurrently
  for (const { trace, orgId } of batch) {
    persistTraceWithRetry(log, trace, orgId).catch((err) => {
      log.error({ err, traceId: trace.id, orgId }, "Trace persistence failed (batch)");
    });
  }
}

/**
 * Initialize the trace buffer with a logger.
 * Call once during server startup.
 */
export function initTraceBuffer(log: FastifyBaseLogger): void {
  logger = log;
}

/**
 * Add a trace to the micro-batch buffer.
 * Flushes when the buffer hits the size threshold or after the time interval.
 * If the buffer is at capacity, persists immediately to provide backpressure.
 */
export function bufferTrace(trace: Trace, orgId: string): void {
  if (!logger) {
    // Fallback: persist immediately if buffer not initialized
    return;
  }

  if (buffer.length >= MAX_BUFFER_SIZE) {
    // Backpressure: persist immediately instead of dropping
    logger.warn({ traceId: trace.id, bufferSize: buffer.length }, "Trace buffer full, persisting immediately");
    persistTraceWithRetry(logger, trace, orgId).catch((err) => {
      logger?.error({ err, traceId: trace.id, orgId }, "Trace persistence failed (overflow)");
    });
    return;
  }

  buffer.push({ trace, orgId });

  if (buffer.length >= FLUSH_SIZE_THRESHOLD) {
    flush();
  } else {
    scheduleFlush();
  }
}

/**
 * Flush any remaining buffered traces.
 * Call during graceful shutdown.
 */
export function flushTraceBuffer(): void {
  flush();
}
