import { Worker } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import {
  countTracesForVersion,
  getBaseline,
  getRecentBaselines,
  getSpanStructureForVersion,
  upsertBaseline,
  getAlertRulesForOrg,
  listNotificationChannels,
  createNotificationLogEntry,
} from "@foxhound/db";
import { dispatchAlert } from "@foxhound/notifications";
import type { AlertEvent, NotificationChannel } from "@foxhound/notifications";
import { randomUUID } from "crypto";

export const REGRESSION_DETECTOR_QUEUE = "regression-detector";

const BASELINE_SAMPLE_SIZE = 100;
const STRUCTURAL_THRESHOLD = 0.1; // 10% frequency

interface RegressionJobData {
  orgId: string;
  agentId: string;
  agentVersion: string;
}

async function processRegressionCheck(job: Job<RegressionJobData>): Promise<void> {
  const { orgId, agentId, agentVersion } = job.data;

  // Check if baseline already exists
  const existing = await getBaseline(orgId, agentId, agentVersion);
  if (existing) return; // Already baselined

  // Check if enough traces
  const count = await countTracesForVersion(orgId, agentId, agentVersion);
  if (count < BASELINE_SAMPLE_SIZE) return; // Not enough data yet

  // Compute span structure
  const structure = await getSpanStructureForVersion(orgId, agentId, agentVersion, BASELINE_SAMPLE_SIZE);

  // Save baseline
  await upsertBaseline({
    id: `bl_${randomUUID()}`,
    orgId,
    agentId,
    agentVersion,
    sampleSize: Math.min(count, BASELINE_SAMPLE_SIZE),
    spanStructure: structure,
  });

  console.log(`[regression] Created baseline for ${agentId}@${agentVersion} (${count} traces)`);

  // Compare against previous version
  const baselines = await getRecentBaselines(orgId, agentId, 2);
  if (baselines.length < 2) return; // First version, nothing to compare

  const [newer, older] = baselines;
  const regressions = detectStructuralDrift(
    older!.spanStructure as Record<string, number>,
    newer!.spanStructure as Record<string, number>,
  );

  if (regressions.length === 0) return; // No regressions

  // Fire behavior_regression alert
  const event: AlertEvent = {
    type: "behavior_regression",
    severity: "high",
    orgId,
    agentId,
    message: `Agent "${agentId}" behavior changed between ${older!.agentVersion} and ${newer!.agentVersion}: ${regressions.length} structural change(s) detected.`,
    metadata: {
      previousVersion: older!.agentVersion,
      newVersion: newer!.agentVersion,
      regressions,
      sampleSize: { before: older!.sampleSize, after: newer!.sampleSize },
    },
    occurredAt: new Date(),
  };

  const [rules, channels] = await Promise.all([
    getAlertRulesForOrg(orgId),
    listNotificationChannels(orgId),
  ]);

  const channelMap = new Map<string, NotificationChannel>(
    channels.map((c) => [c.id, c as unknown as NotificationChannel]),
  );
  const matchingRules = rules.filter((r) => r.eventType === "behavior_regression");
  await dispatchAlert(event, matchingRules, channelMap, console);

  await Promise.allSettled(
    matchingRules
      .filter((r) => channelMap.has(r.channelId))
      .map((rule) =>
        createNotificationLogEntry({
          id: randomUUID(), orgId, ruleId: rule.id, channelId: rule.channelId,
          eventType: "behavior_regression", severity: "high", agentId, status: "sent",
        }),
      ),
  );
}

function detectStructuralDrift(
  baseA: Record<string, number>,
  baseB: Record<string, number>,
): Array<{ type: string; span: string; previousFrequency?: number; newFrequency?: number }> {
  const drifts: Array<{ type: string; span: string; previousFrequency?: number; newFrequency?: number }> = [];

  for (const [span, freq] of Object.entries(baseA)) {
    if (freq >= STRUCTURAL_THRESHOLD && (baseB[span] === undefined || baseB[span]! < STRUCTURAL_THRESHOLD)) {
      drifts.push({ type: "missing", span, previousFrequency: freq });
    }
  }

  for (const [span, freq] of Object.entries(baseB)) {
    if (freq >= STRUCTURAL_THRESHOLD && (baseA[span] === undefined || baseA[span]! < STRUCTURAL_THRESHOLD)) {
      drifts.push({ type: "new", span, newFrequency: freq });
    }
  }

  return drifts;
}

export function startRegressionDetectorWorker(connection: ConnectionOptions): Worker<RegressionJobData> {
  const worker = new Worker<RegressionJobData>(REGRESSION_DETECTOR_QUEUE, async (job) => {
    await processRegressionCheck(job);
  }, {
    connection,
    concurrency: 3,
    autorun: true,
  });

  worker.on("completed", (job) => console.log(`[regression] Job ${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`[regression] Job ${job?.id} failed:`, err.message));

  return worker;
}
