import { getEntitlements } from "./entitlements.js";
import { getUsageForPeriod, upsertUsageRecord } from "@foxhound/db";

export function currentBillingPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function periodBounds(period: string): { periodStart: string; periodEnd: string } {
  const [year, month] = period.split("-").map(Number) as [number, number];
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // last day of month
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

export interface SpanLimitCheck {
  allowed: boolean;
  spansUsed: number;
  spansLimit: number;
  /** true when spans exceed the included allocation (relevant for pro overage billing) */
  isOverage: boolean;
}

/**
 * Check whether an org can ingest `incomingSpans` more spans this billing period.
 * Free tier is hard-blocked when over limit. Pro is allowed but flagged as overage.
 * Enterprise (-1 limit) is always allowed.
 */
export async function checkSpanLimit(
  orgId: string,
  incomingSpans: number,
): Promise<SpanLimitCheck> {
  const period = currentBillingPeriod();
  const [entitlements, usage] = await Promise.all([
    getEntitlements(orgId),
    getUsageForPeriod(orgId, period),
  ]);

  const spansUsed = usage?.spanCount ?? 0;
  const spansLimit = entitlements.maxSpans;

  if (spansLimit === -1) {
    // Enterprise: unlimited
    return { allowed: true, spansUsed, spansLimit, isOverage: false };
  }

  const isFree = spansLimit <= 10_000;
  const wouldExceedLimit = spansUsed + incomingSpans > spansLimit;

  if (wouldExceedLimit && isFree) {
    return { allowed: false, spansUsed, spansLimit, isOverage: true };
  }

  return {
    allowed: true,
    spansUsed,
    spansLimit,
    isOverage: wouldExceedLimit,
  };
}

/**
 * Atomically increment the span counter for an org in the current billing period.
 * Safe to call after a trace is accepted — uses an upsert so the first call for
 * a new period creates the row, subsequent calls increment it.
 */
export async function incrementSpanCount(orgId: string, count: number): Promise<void> {
  const period = currentBillingPeriod();
  await upsertUsageRecord(orgId, period, count);
}
