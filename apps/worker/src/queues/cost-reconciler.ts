import { Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import { getAllAgentConfigs, sumSpanCosts } from "@foxhound/db";
import { getBudgetPeriodKey, parsePeriodStart } from "@foxhound/types";
import { logger } from "../logger.js";

const log = logger.child({ queue: "cost-reconciler" });

export const COST_RECONCILER_QUEUE = "cost-reconciler";

export function startCostReconcilerWorker(connection: ConnectionOptions): Worker {
  const redisUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";
  const redis = new Redis(redisUrl);

  const worker = new Worker(
    COST_RECONCILER_QUEUE,
    async () => {
      const configs = await getAllAgentConfigs();
      const now = Date.now();

      for (const config of configs) {
        if (!config.costBudgetUsd) continue;
        const period = config.budgetPeriod ?? "monthly";
        const periodKey = getBudgetPeriodKey(period, now);

        const redisKey = `cost:${config.orgId}:${config.agentId}:${periodKey}`;
        const periodStart = parsePeriodStart(periodKey);
        const costs = await sumSpanCosts(config.orgId, config.agentId, periodStart, now);
        await redis.set(redisKey, String(costs.totalCost));
        await redis.expire(redisKey, 35 * 24 * 3600);
      }
    },
    {
      connection,
      concurrency: 1,
      autorun: true,
    },
  );

  worker.on("failed", (job, err) => log.error("Job failed", { jobId: job?.id, error: err.message }));

  return worker;
}
