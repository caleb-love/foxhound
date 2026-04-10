import { Worker, Queue } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import {
  getAgentConfig,
  getAlertRulesForOrg,
  listNotificationChannels,
  createNotificationLogEntry,
  updateAgentConfigStatus,
  sumSpanCosts,
} from "@foxhound/db";
import { dispatchAlert } from "@foxhound/notifications";
import type { AlertEvent, NotificationChannel } from "@foxhound/notifications";
import { randomUUID } from "crypto";

export const COST_MONITOR_QUEUE = "cost-monitor";

interface CostAlertJobData {
  orgId: string;
  agentId: string;
  periodKey: string;
  level: "high" | "critical";
}

async function processCostAlert(job: Job<CostAlertJobData>): Promise<void> {
  const { orgId, agentId, periodKey, level } = job.data;

  const config = await getAgentConfig(orgId, agentId);
  if (!config || !config.costBudgetUsd) return;

  const budget = Number(config.costBudgetUsd);
  const now = Date.now();
  const periodStart = parsePeriodStart(periodKey);
  const costs = await sumSpanCosts(orgId, agentId, periodStart, now);

  const status = costs.totalCost >= budget ? "exceeded"
    : costs.totalCost >= budget * ((config.costAlertThresholdPct ?? 80) / 100) ? "warning"
    : "under";

  const unknownPct = costs.totalSpans > 0 ? (costs.unknownCostSpans / costs.totalSpans) * 100 : 0;

  await updateAgentConfigStatus(orgId, agentId, {
    status,
    spend: costs.totalCost,
    budget,
    unknownCostPct: Math.round(unknownPct * 10) / 10,
    checkedAt: new Date().toISOString(),
  }, null);

  if (status === "under") return;

  const event: AlertEvent = {
    type: "cost_budget_exceeded",
    severity: level === "critical" ? "critical" : "high",
    orgId,
    agentId,
    message: `Agent "${agentId}" has ${status === "exceeded" ? "exceeded" : "reached " + (config.costAlertThresholdPct ?? 80) + "% of"} its $${budget} ${config.budgetPeriod} budget. Current spend: $${costs.totalCost.toFixed(2)}.`,
    metadata: { spend: costs.totalCost, budget, periodKey, unknownCostPct: unknownPct },
    occurredAt: new Date(),
  };

  const [rules, channels] = await Promise.all([
    getAlertRulesForOrg(orgId),
    listNotificationChannels(orgId),
  ]);

  const channelMap = new Map<string, NotificationChannel>(
    channels.map((c) => [c.id, c as unknown as NotificationChannel]),
  );
  const matchingRules = rules.filter((r) => r.eventType === "cost_budget_exceeded");
  await dispatchAlert(event, matchingRules, channelMap, console);

  await Promise.allSettled(
    matchingRules
      .filter((r) => channelMap.has(r.channelId))
      .map((rule) =>
        createNotificationLogEntry({
          id: randomUUID(),
          orgId,
          ruleId: rule.id,
          channelId: rule.channelId,
          eventType: "cost_budget_exceeded",
          severity: level,
          agentId,
          status: "sent",
        }),
      ),
  );
}

function parsePeriodStart(periodKey: string): number {
  if (periodKey.includes("W")) {
    const [yearStr, weekStr] = periodKey.split("-W");
    const year = Number(yearStr);
    const week = Number(weekStr);
    const jan1 = new Date(year, 0, 1);
    const d = new Date(jan1.getTime() + (week - 1) * 7 * 86400000);
    return d.getTime();
  }
  if (periodKey.length === 10) return new Date(periodKey + "T00:00:00Z").getTime();
  return new Date(periodKey + "-01T00:00:00Z").getTime();
}

export function startCostMonitorWorker(connection: ConnectionOptions): Worker<CostAlertJobData> {
  const worker = new Worker<CostAlertJobData>(COST_MONITOR_QUEUE, async (job) => {
    await processCostAlert(job);
  }, {
    connection,
    concurrency: 10,
    autorun: true,
  });

  worker.on("completed", (job) => console.log(`[cost-monitor] Job ${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`[cost-monitor] Job ${job?.id} failed:`, err.message));

  return worker;
}

export function createCostMonitorQueue(connection: ConnectionOptions): Queue<CostAlertJobData> {
  return new Queue<CostAlertJobData>(COST_MONITOR_QUEUE, { connection });
}
