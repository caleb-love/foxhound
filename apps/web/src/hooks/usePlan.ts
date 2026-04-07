"use client";

import { useState, useEffect } from "react";

export type Plan = "free" | "pro" | "enterprise";

export interface PlanStatus {
  plan: Plan;
  canReplay: boolean;
  canRunDiff: boolean;
  spansUsed: number;
  spansLimit: number;
  loading: boolean;
  error: string | null;
}

interface BillingStatusResponse {
  plan: Plan;
  period: string;
  spanCount: number;
  nextBillingDate: string | null;
}

interface BillingUsageResponse {
  spansUsed: number;
  spansLimit: number;
  periodStart: string;
  periodEnd: string;
}

export function usePlan(): PlanStatus {
  const [plan, setPlan] = useState<Plan>("free");
  const [spansUsed, setSpansUsed] = useState(0);
  const [spansLimit, setSpansLimit] = useState(10_000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/status", { cache: "no-store" }).then(
        (r) => r.json() as Promise<BillingStatusResponse>,
      ),
      fetch("/api/billing/usage", { cache: "no-store" }).then(
        (r) => r.json() as Promise<BillingUsageResponse>,
      ),
    ])
      .then(([status, usage]) => {
        setPlan(status.plan ?? "free");
        setSpansUsed(usage.spansUsed ?? 0);
        setSpansLimit(usage.spansLimit ?? 10_000);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load plan");
      })
      .finally(() => setLoading(false));
  }, []);

  const canReplay = plan === "pro" || plan === "enterprise";
  const canRunDiff = plan === "pro" || plan === "enterprise";

  return { plan, canReplay, canRunDiff, spansUsed, spansLimit, loading, error };
}
