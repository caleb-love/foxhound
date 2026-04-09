import { Worker, Queue } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import {
  getEvaluatorRun,
  getEvaluator,
  getTraceWithSpans,
  updateEvaluatorRunStatus,
  createScore,
} from "@foxhound/db";
import { randomUUID } from "crypto";

export const EVALUATOR_QUEUE_NAME = "evaluator-runs";

export interface EvaluatorJobData {
  runId: string;
}

/**
 * Render a Mustache-style template with trace data.
 * Supports {{input}}, {{output}}, {{spans}}, {{metadata}}.
 */
function renderTemplate(template: string, traceData: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = traceData[key];
    if (value === undefined) return `{{${key}}}`;
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

/**
 * Extract input/output from trace spans for template rendering.
 */
function extractTraceContext(trace: {
  spans: Array<{
    name: string;
    kind: string;
    attributes: Record<string, unknown>;
    events: unknown[];
  }>;
  metadata: Record<string, unknown>;
}): Record<string, unknown> {
  const spans = trace.spans;
  const firstSpan = spans[0];
  const lastSpan = spans[spans.length - 1];

  return {
    input: firstSpan?.attributes?.["input"] ?? JSON.stringify(firstSpan?.attributes ?? {}),
    output: lastSpan?.attributes?.["output"] ?? JSON.stringify(lastSpan?.attributes ?? {}),
    spans: JSON.stringify(
      spans.map((s) => ({ name: s.name, kind: s.kind, attributes: s.attributes })),
      null,
      2,
    ),
    metadata: JSON.stringify(trace.metadata),
    spanCount: String(spans.length),
  };
}

/**
 * Call an LLM to evaluate a trace.
 * Supports OpenAI-compatible API format (works with OpenAI, Anthropic via proxy, etc.)
 *
 * For now, uses OpenAI's chat completions API since it's the most common.
 * The model field in the evaluator config determines which model to use.
 */
async function callLlmJudge(
  prompt: string,
  model: string,
  scoringType: "numeric" | "categorical",
  labels: string[],
): Promise<{ value?: number; label?: string }> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for LLM-as-a-Judge evaluations");
  }

  const systemPrompt =
    scoringType === "numeric"
      ? 'You are an evaluator. Respond with ONLY a JSON object: {"score": <number between 0.0 and 1.0>}. No other text.'
      : `You are an evaluator. Respond with ONLY a JSON object: {"label": "<one of: ${labels.join(", ")}>"}. No other text.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`LLM API error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data.choices[0]?.message?.content?.trim() ?? "";

  // Parse the JSON response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`LLM returned non-JSON response: ${content}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as { score?: number; label?: string };

  if (scoringType === "numeric") {
    const score = parsed.score;
    if (typeof score !== "number" || score < 0 || score > 1) {
      throw new Error(`LLM returned invalid score: ${score}`);
    }
    return { value: score };
  } else {
    const label = parsed.label;
    if (typeof label !== "string" || !labels.includes(label)) {
      throw new Error(
        `LLM returned invalid label: ${label} (expected one of: ${labels.join(", ")})`,
      );
    }
    return { label };
  }
}

/**
 * Process a single evaluator run job.
 */
async function processEvaluatorJob(job: Job<EvaluatorJobData>): Promise<void> {
  const { runId } = job.data;

  // Mark as running
  await updateEvaluatorRunStatus(runId, "running");

  const run = await getEvaluatorRun(runId);
  if (!run) {
    throw new Error(`Evaluator run ${runId} not found`);
  }

  const evaluator = await getEvaluator(run.evaluatorId, "");
  if (!evaluator) {
    throw new Error(`Evaluator ${run.evaluatorId} not found`);
  }

  // Get trace data — we need the orgId from the evaluator
  const trace = await getTraceWithSpans(run.traceId, evaluator.orgId);
  if (!trace) {
    throw new Error(`Trace ${run.traceId} not found`);
  }

  // Render the prompt template with trace context
  const context = extractTraceContext(trace);
  const renderedPrompt = renderTemplate(evaluator.promptTemplate, context);

  // Call the LLM judge
  const result = await callLlmJudge(
    renderedPrompt,
    evaluator.model,
    evaluator.scoringType,
    evaluator.labels ?? [],
  );

  // Create the resulting score
  const score = await createScore({
    id: `scr_${randomUUID()}`,
    orgId: evaluator.orgId,
    traceId: run.traceId,
    name: evaluator.name,
    value: result.value,
    label: result.label,
    source: "llm_judge",
  });

  // Mark run as completed with the score reference
  await updateEvaluatorRunStatus(runId, "completed", { scoreId: score.id });
}

/**
 * Create the evaluator queue (for the API to enqueue jobs).
 */
export function createEvaluatorQueue(connection: ConnectionOptions): Queue<EvaluatorJobData> {
  return new Queue<EvaluatorJobData>(EVALUATOR_QUEUE_NAME, { connection });
}

/**
 * Start the evaluator worker (runs in the worker process).
 */
export function startEvaluatorWorker(connection: ConnectionOptions): Worker<EvaluatorJobData> {
  const worker = new Worker<EvaluatorJobData>(
    EVALUATOR_QUEUE_NAME,
    async (job) => {
      await processEvaluatorJob(job);
    },
    {
      connection,
      concurrency: 10,
      limiter: {
        max: 20,
        duration: 60_000, // 20 jobs per minute rate limit
      },
    },
  );

  worker.on("completed", (job) => {
    console.log(`[evaluator] Job ${job.id} completed (run: ${job.data.runId})`);
  });

  worker.on("failed", (job, err) => {
    const runId = job?.data?.runId ?? "unknown";
    console.error(`[evaluator] Job ${job?.id} failed (run: ${runId}):`, err.message);

    // Update the run status to failed
    if (job?.data?.runId) {
      updateEvaluatorRunStatus(job.data.runId, "failed", { error: err.message }).catch((e) => {
        console.error(`[evaluator] Failed to update run status:`, e);
      });
    }
  });

  return worker;
}
