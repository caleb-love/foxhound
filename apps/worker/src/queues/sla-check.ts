import { Worker } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import {
  updateAgentConfigStatus,
  getAlertRulesForOrg,
  listNotificationChannels,
  createNotificationLogEntry,
} from "@foxhound/db";
import { dispatchAlert } from "@foxhound/notifications";
import type { AlertEvent, NotificationChannel } from "@foxhound/notifications";
import { randomUUID } from "crypto";

export const SLA_CHECK_QUEUE = "sla-check";

interface SlaCheckJobData {
  configId: string;
  orgId: string;
  agentId: string;
  maxDurationMs: number | null;
  minSuccessRate: number | null;
  evaluationWindowMs: number | null;
  minSampleSize: number | null;
}

async function processSlaCheck(job: Job<SlaCheckJobData>, redis: Redis): Promise<void> {
  const { orgId, agentId, maxDurationMs, minSuccessRate, evaluationWindowMs, minSampleSize } = job.data;
  const windowMs = evaluationWindowMs ?? 86400000;
  const minSamples = minSampleSize ?? 10;
  const now = Date.now();
  const windowStart = Math.floor((now - windowMs) / 60000);
  const windowEnd = Math.floor(now / 60000);

  // Aggregate Redis counters across minute buckets
  let totalTraces = 0;
  let totalErrors = 0;
  const durations: number[] = [];

  for (let minute = windowStart; minute <= windowEnd; minute++) {
    const tracesKey = `sla:traces:${orgId}:${agentId}:${minute}`;
    const errorsKey = `sla:errors:${orgId}:${agentId}:${minute}`;
    const durKey = `sla:duration:${orgId}:${agentId}:${minute}`;

    const [tracesCount, errorsCount, durs] = await Promise.all([
      redis.get(tracesKey),
      redis.get(errorsKey),
      redis.zrange(durKey, 0, -1, "WITHSCORES"),
    ]);

    totalTraces += Number(tracesCount ?? 0);
    totalErrors += Number(errorsCount ?? 0);

    // Parse sorted set scores as durations
    for (let i = 1; i < durs.length; i += 2) {
      durations.push(Number(durs[i]));
    }
  }

  // Check minimum sample size
  if (totalTraces < minSamples) {
    await updateAgentConfigStatus(orgId, agentId, null, {
      status: totalTraces === 0 ? "no_data" : "insufficient_data",
      compliant: true,
      sampleSize: totalTraces,
      checkedAt: new Date().toISOString(),
    });
    return;
  }

  // Compute metrics
  const successRate = totalTraces > 0 ? 1 - totalErrors / totalTraces : 1;
  durations.sort((a, b) => a - b);
  const p95Index = Math.ceil(durations.length * 0.95) - 1;
  const durationP95 = durations.length > 0 ? durations[Math.max(0, p95Index)]! : 0;

  let compliant = true;
  const alerts: Array<{ type: "sla_duration_breach" | "sla_success_rate_breach"; message: string }> = [];

  if (maxDurationMs !== null && durationP95 > maxDurationMs) {
    compliant = false;
    alerts.push({
      type: "sla_duration_breach",
      message: `Agent "${agentId}" p95 duration ${durationP95}ms exceeds SLA of ${maxDurationMs}ms (${totalTraces} traces).`,
    });
  }

  if (minSuccessRate !== null && successRate < minSuccessRate) {
    compliant = false;
    alerts.push({
      type: "sla_success_rate_breach",
      message: `Agent "${agentId}" success rate ${(successRate * 100).toFixed(1)}% below SLA of ${(minSuccessRate * 100).toFixed(1)}% (${totalTraces} traces).`,
    });
  }

  await updateAgentConfigStatus(orgId, agentId, null, {
    status: compliant ? "compliant" : "breach",
    compliant,
    durationP95Ms: durationP95,
    successRate,
    sampleSize: totalTraces,
    checkedAt: new Date().toISOString(),
  });

  // Fire alerts
  for (const alert of alerts) {
    const event: AlertEvent = {
      type: alert.type,
      severity: "high",
      orgId,
      agentId,
      message: alert.message,
      metadata: { durationP95, successRate, sampleSize: totalTraces },
      occurredAt: new Date(),
    };

    const [rules, channels] = await Promise.all([
      getAlertRulesForOrg(orgId),
      listNotificationChannels(orgId),
    ]);

    const channelMap = new Map<string, NotificationChannel>(
      channels.map((c) => [c.id, c as unknown as NotificationChannel]),
    );
    const matchingRules = rules.filter((r) => r.eventType === alert.type);
    await dispatchAlert(event, matchingRules, channelMap, console);

    await Promise.allSettled(
      matchingRules
        .filter((r) => channelMap.has(r.channelId))
        .map((rule) =>
          createNotificationLogEntry({
            id: randomUUID(), orgId, ruleId: rule.id, channelId: rule.channelId,
            eventType: alert.type, severity: "high", agentId, status: "sent",
          }),
        ),
    );
  }
}

export function startSlaCheckWorker(connection: ConnectionOptions): Worker<SlaCheckJobData> {
  const redisUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";
  const redis = new Redis(redisUrl);

  const worker = new Worker<SlaCheckJobData>(SLA_CHECK_QUEUE, async (job) => {
    await processSlaCheck(job, redis);
  }, {
    connection,
    concurrency: 10,
    autorun: true,
  });

  worker.on("completed", (job) => console.log(`[sla-check] Job ${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`[sla-check] Job ${job?.id} failed:`, err.message));

  return worker;
}
