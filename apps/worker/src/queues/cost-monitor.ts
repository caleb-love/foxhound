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
import { createAlertFiringService } from "@foxhound/notifications";
import type { AlertEvent, AlertRule, NotificationChannel } from "@foxhound/notifications";
import { parsePeriodStart } from "@foxhound/types";
import { logger } from "../logger.js";

const log = logger.child({ queue: "cost-monitor" });

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

  const status =
    costs.totalCost >= budget
      ? "exceeded"
      : costs.totalCost >= budget * ((config.costAlertThresholdPct ?? 80) / 100)
        ? "warning"
        : "under";

  const unknownPct = costs.totalSpans > 0 ? (costs.unknownCostSpans / costs.totalSpans) * 100 : 0;

  await updateAgentConfigStatus(
    orgId,
    agentId,
    {
      status,
      spend: costs.totalCost,
      budget,
      unknownCostPct: Math.round(unknownPct * 10) / 10,
      checkedAt: new Date().toISOString(),
    },
    null,
  );

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

  const alertLogger = {
    error: (obj: unknown, msg: string) => log.error(msg, obj as Record<string, unknown>),
  };
  const service = createAlertFiringService({
    getAlertRulesForOrg: async (oid) => (await getAlertRulesForOrg(oid)) as unknown as AlertRule[],
    listNotificationChannels: async (filter) => {
      const rows = await listNotificationChannels(filter);
      return rows.map((c) => c as unknown as NotificationChannel);
    },
    createNotificationLogEntry: async (entry) => {
      const result = await createNotificationLogEntry({
        id: entry.id,
        orgId: entry.orgId,
        ruleId: entry.ruleId,
        channelId: entry.channelId,
        eventType: entry.eventType,
        severity: entry.severity,
        agentId: entry.agentId,
        ...(entry.traceId !== undefined ? { traceId: entry.traceId } : {}),
        status: entry.status,
        ...(entry.dedupeKey !== undefined ? { dedupeKey: entry.dedupeKey } : {}),
      });
      return result ? { id: result.id } : null;
    },
    logger: alertLogger,
  });
  await service.fireEvent(event, {
    dedupeKey: `cost:${orgId}:${agentId}:${periodKey}:${level}`,
  });
}

export function startCostMonitorWorker(connection: ConnectionOptions): Worker<CostAlertJobData> {
  const worker = new Worker<CostAlertJobData>(
    COST_MONITOR_QUEUE,
    async (job) => {
      await processCostAlert(job);
    },
    {
      connection,
      concurrency: 10,
      autorun: true,
    },
  );

  worker.on("completed", (job) => log.info("Job completed", { jobId: job.id }));
  worker.on("failed", (job, err) =>
    log.error("Job failed", { jobId: job?.id, error: err.message }),
  );

  return worker;
}

export function createCostMonitorQueue(connection: ConnectionOptions): Queue<CostAlertJobData> {
  return new Queue<CostAlertJobData>(COST_MONITOR_QUEUE, { connection });
}
