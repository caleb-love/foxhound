import { getAllAgentConfigs } from "@foxhound/db";

interface CachedConfig {
  costBudgetUsd: number | null;
  costAlertThresholdPct: number | null;
  budgetPeriod: string | null;
  maxDurationMs: number | null;
  minSuccessRate: number | null;
  evaluationWindowMs: number | null;
}

// Map<"orgId:agentId", config>
let cache: Map<string, CachedConfig> = new Map();
let lastRefresh = 0;
const REFRESH_INTERVAL_MS = 60_000;

export async function refreshConfigCache(): Promise<void> {
  // Load configs for all orgs (this is a small table)
  // In production, this would be scoped or paginated
  // For now, load all — same pattern as pricing cache
  const rows = await getAllAgentConfigs();
  cache = new Map();
  for (const row of rows) {
    cache.set(`${row.orgId}:${row.agentId}`, {
      costBudgetUsd: row.costBudgetUsd !== null ? Number(row.costBudgetUsd) : null,
      costAlertThresholdPct: row.costAlertThresholdPct ?? null,
      budgetPeriod: row.budgetPeriod ?? null,
      maxDurationMs: row.maxDurationMs ?? null,
      minSuccessRate: row.minSuccessRate !== null ? Number(row.minSuccessRate) : null,
      evaluationWindowMs: row.evaluationWindowMs ?? null,
    });
  }
  lastRefresh = Date.now();
}

export async function getConfigFromCache(
  orgId: string,
  agentId: string,
): Promise<CachedConfig | null> {
  if (Date.now() - lastRefresh > REFRESH_INTERVAL_MS) {
    await refreshConfigCache();
  }
  return cache.get(`${orgId}:${agentId}`) ?? null;
}

export function setCacheEntry(orgId: string, agentId: string, config: CachedConfig): void {
  cache.set(`${orgId}:${agentId}`, config);
}

export function deleteCacheEntry(orgId: string, agentId: string): void {
  cache.delete(`${orgId}:${agentId}`);
}
