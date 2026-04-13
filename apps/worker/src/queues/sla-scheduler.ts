import { Worker, Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { getAllAgentConfigs } from "@foxhound/db";
import { logger } from "../logger.js";

const log = logger.child({ queue: "sla-scheduler" });

export const SLA_SCHEDULER_QUEUE = "sla-scheduler";
export const SLA_CHECK_QUEUE = "sla-check";

export function startSlaSchedulerWorker(connection: ConnectionOptions): Worker {
  const checkQueue = new Queue(SLA_CHECK_QUEUE, { connection });

  const worker = new Worker(
    SLA_SCHEDULER_QUEUE,
    async () => {
      const configs = await getAllAgentConfigs();
      const minute = Math.floor(Date.now() / 60000);

      await Promise.all(
        configs.map((config) =>
          checkQueue.add(
            "sla-check",
            {
              configId: config.id,
              orgId: config.orgId,
              agentId: config.agentId,
              maxDurationMs: config.maxDurationMs,
              minSuccessRate: config.minSuccessRate ? Number(config.minSuccessRate) : null,
              evaluationWindowMs: config.evaluationWindowMs,
              minSampleSize: config.minSampleSize,
            },
            {
              jobId: `sla-check:${config.id}:${minute}`,
              attempts: 3,
              backoff: { type: "exponential", delay: 1000 },
            },
          ),
        ),
      );
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
