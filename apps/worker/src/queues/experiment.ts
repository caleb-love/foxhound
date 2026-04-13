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
import { logger } from "../logger.js";

const log = logger.child({ queue: "experiment" });

/** Truncate and sanitize LLM error text before logging or DB persistence. */
function sanitizeErrorForStorage(text: string): string {
  return text.slice(0, 500).replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
}

export const EXPERIMENT_QUEUE_NAME = "experiment-runs";

export interface ExperimentJobData {
  experimentId: string;
  orgId: string;
}

/**
 * Run a single dataset item through the experiment config.
 * Calls the configured LLM model with the prompt template + input.
 */
async function executeExperimentRun(
  config: Record<string, unknown>,
  input: Record<string, unknown>,
): Promise<{
  output: Record<string, unknown>;
  latencyMs: number;
  tokenCount: number;
  cost: number;
}> {
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
    throw new Error(`LLM API error: ${response.status} ${sanitizeErrorForStorage(text)}`);
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
 * Call an LLM to evaluate a run output using the evaluator's prompt template.
 * Returns a numeric score (0-1) or a categorical label depending on scoringType.
 */
async function invokeEvaluator(
  evaluator: { promptTemplate: string; model: string; scoringType: string },
  input: Record<string, unknown>,
  output: Record<string, unknown>,
): Promise<{ value?: number; label?: string }> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for evaluator invocation");
  }

  const prompt = evaluator.promptTemplate
    .replace(/\{\{input\}\}/g, JSON.stringify(input))
    .replace(/\{\{output\}\}/g, JSON.stringify(output));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: evaluator.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Evaluator LLM error: ${response.status} ${sanitizeErrorForStorage(text)}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = (data.choices[0]?.message?.content ?? "").trim();

  if (evaluator.scoringType === "numeric") {
    const match = content.match(/(\d+(?:\.\d+)?)/);
    const raw = match ? parseFloat(match[1]) : undefined;
    // Clamp to 0-1 range
    const value = raw != null ? Math.max(0, Math.min(1, raw)) : undefined;
    return { value };
  }

  return { label: content };
}

/**
 * Process an entire experiment: run all dataset items, then auto-score.
 */
async function processExperimentJob(job: Job<ExperimentJobData>): Promise<void> {
  const { experimentId, orgId } = job.data;

  await updateExperimentStatus(experimentId, orgId, "running");

  const experiment = await getExperiment(experimentId, orgId);
  if (!experiment) {
    throw new Error(`Experiment ${experimentId} not found`);
  }

  const runs = await listExperimentRuns(experimentId, orgId);
  let failedCount = 0;

  for (const run of runs) {
    try {
      const item = await getDatasetItem(run.datasetItemId, orgId);
      if (!item) {
        failedCount++;
        log.error("Dataset item not found or inaccessible", {
          runId: run.id,
          datasetItemId: run.datasetItemId,
          orgId,
        });
        await updateExperimentRun(run.id, orgId, {
          output: { error: "dataset_item_not_found" },
        });
        continue;
      }

      const result = await executeExperimentRun(experiment.config, item.input);

      await updateExperimentRun(run.id, orgId, {
        output: result.output,
        latencyMs: result.latencyMs,
        tokenCount: result.tokenCount,
        cost: result.cost,
      });
    } catch (err) {
      failedCount++;
      const sanitizedError = sanitizeErrorForStorage((err as Error).message);
      log.error("Run failed", { runId: run.id, error: sanitizedError });
      await updateExperimentRun(run.id, orgId, {
        output: { error: sanitizedError },
      });
    }
  }

  // Auto-score experiment runs using org's enabled evaluators
  try {
    const enabledEvaluators = await listEvaluators(orgId);
    const active = enabledEvaluators.filter((e) => e.enabled);

    if (active.length > 0) {
      log.info("Auto-scoring experiment runs", {
        runCount: runs.length,
        evaluatorCount: active.length,
      });
      for (const run of runs) {
        const updatedRun = await getExperimentRun(run.id, orgId);
        if (!updatedRun?.output || updatedRun.output.error) continue;

        const item = await getDatasetItem(run.datasetItemId, orgId);
        if (!item?.sourceTraceId) continue;

        for (const evaluator of active) {
          try {
            const result = await invokeEvaluator(evaluator, item.input, updatedRun.output);

            await createScore({
              id: `scr_${randomUUID()}`,
              orgId,
              traceId: item.sourceTraceId,
              name: evaluator.name,
              source: "llm_judge",
              value: result.value,
              label: result.label,
              comment: `experiment:${experiment.id} run:${run.id}`,
            });
          } catch (err) {
            log.warn("Evaluator scoring failed", {
              runId: run.id,
              evaluator: evaluator.name,
              error: (err as Error).message,
            });
          }
        }
      }
    }
  } catch (err) {
    log.error("Auto-scoring failed", { error: (err as Error).message });
  }

  await updateExperimentStatus(
    experimentId,
    orgId,
    runs.length > 0 && failedCount === runs.length ? "failed" : "completed",
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
    log.info("Job completed", { jobId: job.id, experimentId: job.data.experimentId });
  });

  worker.on("failed", (job, err) => {
    const experimentId = job?.data?.experimentId ?? "unknown";
    log.error("Job failed", { jobId: job?.id, experimentId, error: err.message });

    if (job?.data?.experimentId && job?.data?.orgId) {
      updateExperimentStatus(job.data.experimentId, job.data.orgId, "failed").catch(
        (e: unknown) => {
          log.error("Failed to update experiment status", {
            experimentId: job?.data?.experimentId,
            error: String(e),
          });
        },
      );
    }
  });

  return worker;
}
