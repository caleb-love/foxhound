import { insertTrace, insertSpans } from "@foxhound/db";
import { incrementSpanCount } from "@foxhound/billing";
import type { Trace } from "@foxhound/types";
import type { FastifyBaseLogger } from "fastify";

/**
 * Persist a trace and its normalized spans with retry logic.
 * Shared by both native SDK and OTLP ingestion paths.
 */
export async function persistTraceWithRetry(
  log: FastifyBaseLogger,
  trace: Trace,
  orgId: string,
  maxAttempts = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await Promise.all([
        insertTrace(trace, orgId),
        insertSpans(trace.id, orgId, trace.spans),
        incrementSpanCount(orgId, trace.spans.length),
      ]);
      return;
    } catch (err: unknown) {
      if (attempt === maxAttempts) {
        log.error({ err, traceId: trace.id, attempt }, "Failed to persist trace after all retries");
        return;
      }
      const delayMs = 100 * Math.pow(2, attempt - 1);
      log.warn(
        { err, traceId: trace.id, attempt, nextRetryMs: delayMs },
        "Trace persist failed, retrying",
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
