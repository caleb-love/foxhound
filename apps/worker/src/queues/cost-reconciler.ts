import { Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import { getAllAgentConfigsWithSLA, sumSpanCosts } from "@foxhound/db";

export const COST_RECONCILER_QUEUE = "cost-reconciler";

function parsePeriodStart(periodKey: string): number {
  if (periodKey.includes("W")) {
    const [yearStr, weekStr] = periodKey.split("-W");
    const d = new Date(Number(yearStr), 0, 1);
    d.setDate(d.getDate() + (Number(weekStr) - 1) * 7);
    return d.getTime();
  }
  if (periodKey.length === 10) return new Date(periodKey + "T00:00:00Z").getTime();
  return new Date(periodKey + "-01T00:00:00Z").getTime();
}

export function startCostReconcilerWorker(connection: ConnectionOptions): Worker {
  const redisUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";
  const redis = new Redis(redisUrl);

  const worker = new Worker(COST_RECONCILER_QUEUE, async () => {
    const configs = await getAllAgentConfigsWithSLA();
    const now = Date.now();

    for (const config of configs) {
      if (!config.costBudgetUsd) continue;
      const period = config.budgetPeriod ?? "monthly";
      const d = new Date(now);
      const periodKey = period === "daily" ? d.toISOString().slice(0, 10)
        : period === "weekly" ? `${d.getUTCFullYear()}-W${String(Math.ceil((d.getTime() - new Date(d.getUTCFullYear(), 0, 1).getTime()) / 604800000)).padStart(2, "0")}`
        : d.toISOString().slice(0, 7);

      const redisKey = `cost:${config.orgId}:${config.agentId}:${periodKey}`;
      const periodStart = parsePeriodStart(periodKey);
      const costs = await sumSpanCosts(config.orgId, config.agentId, periodStart, now);
      await redis.set(redisKey, String(costs.totalCost));
      await redis.expire(redisKey, 35 * 24 * 3600);
    }
  }, {
    connection,
    concurrency: 1,
    autorun: true,
  });

  worker.on("failed", (job, err) => console.error(`[cost-reconciler] Failed:`, err.message));

  return worker;
}
