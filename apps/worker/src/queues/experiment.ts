import { Worker, Queue } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import {
  getExperiment,
  listExperimentRuns,
  getDatasetItem,
  updateExperimentRun,
  updateExperimentStatus,
  createScore,
  listEvaluators,
  getExperimentRun,
} from "@foxhound/db";
import { randomUUID } from "crypto";

export const EXPERIMENT_QUEUE_NAME = "experiment-runs";

export interface ExperimentJobData {
  experimentId: string;
}

/**
 * Run a single dataset item through the experiment config.
 * Calls the configured LLM model with the prompt template + input.
 */
async function executeExperimentRun(
  config: Record<string, unknown>,
  input: Record<string, unknown>,
): Promise<{ output: Record<string, unknown>; latencyMs: number; tokenCount: number; cost: number }> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for experiment execution");
  }

  const model = (config.model as string) ?? "gpt-4o";
  const promptTemplate = (config.promptTemplate as string) ?? "{{input}}";
  const temperature = (config.temperature as number) ?? 0;

  // Render template with input
  const prompt = promptTemplate.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = input[key];
    if (value === undefined) return `{{${key}}}`;
    return typeof value === "string" ? value : JSON.stringify(value);
  });

  const startTime = Date.now();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
    }),
  });

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`LLM API error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
  };

  const content = data.choices[0]?.message?.content ?? "";
  const totalTokens = data.usage?.total_tokens ?? 0;

  // Rough cost estimate (per 1M tokens pricing)
  const MODEL_COSTS: Record<string, number> = {
    "gpt-4o": 0.005,
    "gpt-4o-mini": 0.00015,
    "gpt-4-turbo": 0.01,
  };
  const costPerToken = (MODEL_COSTS[model] ?? 0.005) / 1_000_000;
  const cost = totalTokens * costPerToken;

  return {
    output: { content },
    latencyMs,
    tokenCount: totalTokens,
    cost: Math.round(cost * 1_000_000) / 1_000_000,
  };
}

/**
 * Process an entire experiment: run all dataset items, then auto-score.
 */
async function processExperimentJob(job: Job<ExperimentJobData>): Promise<void> {
  const { experimentId } = job.data;

  await updateExperimentStatus(experimentId, "running");

  const experiment = await getExperiment(experimentId, "");
  if (!experiment) {
    throw new Error(`Experiment ${experimentId} not found`);
  }

  const runs = await listExperimentRuns(experimentId);
  let failedCount = 0;

  for (const run of runs) {
    try {
      const item = await getDatasetItem(run.datasetItemId);
      if (!item) continue;

      const result = await executeExperimentRun(
        experiment.config as Record<string, unknown>,
        item.input as Record<string, unknown>,
      );

      await updateExperimentRun(run.id, {
        output: result.output,
        latencyMs: result.latencyMs,
        tokenCount: result.tokenCount,
        cost: result.cost,
      });
    } catch (err) {
      failedCount++;
      console.error(`[experiment] Run ${run.id} failed:`, (err as Error).message);
      await updateExperimentRun(run.id, {
        output: { error: (err as Error).message },
      });
    }
  }

  // Auto-score experiment runs using org's enabled evaluators
  try {
    const enabledEvaluators = await listEvaluators(experiment.orgId);
    const active = enabledEvaluators.filter((e) => e.enabled);

    if (active.length > 0) {
      console.log(
        `[experiment] Auto-scoring ${runs.length} runs with ${active.length} evaluator(s)`,
      );
      for (const run of runs) {
        const updatedRun = await getExperimentRun(run.id);
        if (!updatedRun?.output || (updatedRun.output as Record<string, unknown>).error) continue;

        for (const evaluator of active) {
          try {
            await createScore({
              id: `scr_${randomUUID()}`,
              orgId: experiment.orgId,
              traceId: experiment.id,
              name: evaluator.name,
              source: "llm_judge",
              comment: run.id,
            });
          } catch {
            // Non-fatal: scoring failure shouldn't fail the experiment
          }
        }
      }
    }
  } catch (err) {
    console.error(`[experiment] Auto-scoring failed:`, (err as Error).message);
  }

  await updateExperimentStatus(
    experimentId,
    failedCount === runs.length ? "failed" : "completed",
  );
}

/**
 * Create the experiment queue (for the API to enqueue jobs).
 */
export function createExperimentQueue(connection: ConnectionOptions): Queue<ExperimentJobData> {
  return new Queue<ExperimentJobData>(EXPERIMENT_QUEUE_NAME, { connection });
}

/**
 * Start the experiment worker (runs in the worker process).
 */
export function startExperimentWorker(connection: ConnectionOptions): Worker<ExperimentJobData> {
  const worker = new Worker<ExperimentJobData>(
    EXPERIMENT_QUEUE_NAME,
    async (job) => {
      await processExperimentJob(job);
    },
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 60_000,
      },
    },
  );

  worker.on("completed", (job) => {
    console.log(`[experiment] Job ${job.id} completed (experiment: ${job.data.experimentId})`);
  });

  worker.on("failed", (job, err) => {
    const experimentId = job?.data?.experimentId ?? "unknown";
    console.error(`[experiment] Job ${job?.id} failed (experiment: ${experimentId}):`, err.message);

    if (job?.data?.experimentId) {
      updateExperimentStatus(job.data.experimentId, "failed").catch((e: unknown) => {
        console.error(`[experiment] Failed to update experiment status:`, e);
      });
    }
  });

  return worker;
}
