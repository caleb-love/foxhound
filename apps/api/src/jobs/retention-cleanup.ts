import { getOrgsWithRetention, deleteExpiredTraces } from "@foxhound/db";
import type { FastifyBaseLogger } from "fastify";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Run every hour

let timer: ReturnType<typeof setInterval> | null = null;

async function runCleanup(log: FastifyBaseLogger): Promise<void> {
  const orgs = await getOrgsWithRetention();

  for (const org of orgs) {
    try {
      // CASCADE on traces→spans ensures span rows are deleted too
      const deleted = await deleteExpiredTraces(org.id, org.retentionDays);
      if (deleted > 0) {
        log.info({ orgId: org.id, deletedTraces: deleted }, "Retention cleanup completed");
      }
    } catch (err) {
      log.error({ err, orgId: org.id }, "Retention cleanup failed for org");
    }
  }
}

export function startRetentionCleanup(log: FastifyBaseLogger): void {
  if (timer) return;

  // Run once on startup (after a short delay to let the server settle)
  setTimeout(() => {
    runCleanup(log).catch((err) => {
      log.error({ err }, "Initial retention cleanup failed");
    });
  }, 10_000);

  timer = setInterval(() => {
    runCleanup(log).catch((err) => {
      log.error({ err }, "Scheduled retention cleanup failed");
    });
  }, CLEANUP_INTERVAL_MS);

  if (timer && typeof timer === "object" && "unref" in timer) {
    timer.unref();
  }
}

export function stopRetentionCleanup(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
