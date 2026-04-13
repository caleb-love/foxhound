import { Worker, Queue } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import {
  getTraceWithSpans,
  updateEvaluatorRunStatus,
  createScore,
  isLlmEvaluationEnabled,
} from "@foxhound/db";
import { getEvaluatorRun, getEvaluatorById } from "@foxhound/db/internal";
import { randomUUID } from "crypto";
import { logger } from "../logger.js";

const log = logger.child({ queue: "evaluator" });

export const EVALUATOR_QUEUE_NAME = "evaluator-runs";
export const EVALUATOR_DLQ_NAME = "evaluator-runs-dlq";

const MAX_ATTEMPTS = 3;

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

/** Default attributes to redact before sending trace data to third-party LLMs */
const DEFAULT_REDACTED_ATTRIBUTES = new Set([
  "api_key",
  "authorization",
  "password",
  "secret",
  "token",
  "cookie",
  "session_id",
  "credit_card",
  "ssn",
]);

/**
 * Redact sensitive attributes from span data before sending to LLM providers.
 */
function redactAttributes(
  attrs: Record<string, unknown>,
  redactKeys = DEFAULT_REDACTED_ATTRIBUTES,
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    const lowerKey = key.toLowerCase();
    if ([...redactKeys].some((rk) => lowerKey.includes(rk))) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Extract input/output from trace spans for template rendering.
 * Applies field-level redaction on sensitive attributes before they reach any LLM.
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

  const redactedSpans = spans.map((s) => ({
    name: s.name,
    kind: s.kind,
    attributes: redactAttributes(s.attributes),
  }));

  const firstRedacted = redactedSpans[0];
  const lastRedacted = redactedSpans[redactedSpans.length - 1];

  return {
    input: firstRedacted?.attributes?.["input"] ?? JSON.stringify(firstRedacted?.attributes ?? {}),
    output: lastRedacted?.attributes?.["output"] ?? JSON.stringify(lastRedacted?.attributes ?? {}),
    spans: JSON.stringify(redactedSpans, null, 2),
    metadata: JSON.stringify(redactAttributes(trace.metadata)),
    spanCount: String(spans.length),
  };
}

// ---------------------------------------------------------------------------
// Multi-provider LLM support
// ---------------------------------------------------------------------------

interface LlmProvider {
  name: string;
  getApiKey: () => string;
  endpoint: string;
  buildRequest: (
    model: string,
    systemPrompt: string,
    userPrompt: string,
  ) => { headers: Record<string, string>; body: string };
  extractContent: (data: unknown) => string;
}

const openaiProvider: LlmProvider = {
  name: "openai",
  getApiKey: () => {
    const key = process.env["OPENAI_API_KEY"];
    if (!key) throw new Error("OPENAI_API_KEY is required for OpenAI evaluations");
    return key;
  },
  endpoint: "https://api.openai.com/v1/chat/completions",
  buildRequest: (model, systemPrompt, userPrompt) => ({
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiProvider.getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 100,
    }),
  }),
  extractContent: (data) => {
    const typed = data as { choices: Array<{ message: { content: string } }> };
    return typed.choices[0]?.message?.content?.trim() ?? "";
  },
};

const anthropicProvider: LlmProvider = {
  name: "anthropic",
  getApiKey: () => {
    const key = process.env["ANTHROPIC_API_KEY"];
    if (!key) throw new Error("ANTHROPIC_API_KEY is required for Anthropic evaluations");
    return key;
  },
  endpoint: "https://api.anthropic.com/v1/messages",
  buildRequest: (model, systemPrompt, userPrompt) => ({
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicProvider.getApiKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0,
      max_tokens: 100,
    }),
  }),
  extractContent: (data) => {
    const typed = data as { content: Array<{ type: string; text: string }> };
    const textBlock = typed.content?.find((b) => b.type === "text");
    return textBlock?.text?.trim() ?? "";
  },
};

const PROVIDERS: Record<string, LlmProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
};

/**
 * Parse model string into provider + model name.
 * Formats: "provider:model" (e.g., "openai:gpt-4o", "anthropic:claude-sonnet-4-20250514")
 * If no prefix, defaults to "openai" for backwards compatibility.
 */
function parseModelSpec(modelSpec: string): { provider: LlmProvider; model: string } {
  const colonIdx = modelSpec.indexOf(":");
  if (colonIdx > 0) {
    const providerName = modelSpec.slice(0, colonIdx);
    const model = modelSpec.slice(colonIdx + 1);
    const provider = PROVIDERS[providerName];
    if (!provider) {
      throw new Error(
        `Unknown LLM provider: ${providerName}. Supported: ${Object.keys(PROVIDERS).join(", ")}`,
      );
    }
    return { provider, model };
  }
  // Default to OpenAI for backwards compatibility
  return { provider: openaiProvider, model: modelSpec };
}

/** Max error message length persisted to evaluatorRuns.error */
const MAX_ERROR_LENGTH = 500;

/**
 * Sanitize an LLM error response before persisting.
 * Raw upstream error bodies can contain account identifiers, rate-limit quotas,
 * and internal routing info. Truncate, strip non-printable chars, log full body internally.
 */
function sanitizeErrorForStorage(rawError: string): string {
  // Strip non-printable characters except newline/tab
  const cleaned = rawError.replace(/[^\x20-\x7E\n\t]/g, "");
  if (cleaned.length <= MAX_ERROR_LENGTH) return cleaned;
  return cleaned.slice(0, MAX_ERROR_LENGTH) + "... [truncated]";
}

/**
 * Call an LLM to evaluate a trace.
 * Supports multiple providers via "provider:model" format.
 * Defaults to OpenAI when no provider prefix is specified.
 */
async function callLlmJudge(
  prompt: string,
  modelSpec: string,
  scoringType: "numeric" | "categorical",
  labels: string[],
): Promise<{ value?: number; label?: string }> {
  const { provider, model } = parseModelSpec(modelSpec);

  const systemPrompt =
    scoringType === "numeric"
      ? 'You are an evaluator. Respond with ONLY a JSON object: {"score": <number between 0.0 and 1.0>}. No other text.'
      : `You are an evaluator. Respond with ONLY a JSON object: {"label": "<one of: ${labels.join(", ")}>"}. No other text.`;

  const { headers, body } = provider.buildRequest(model, systemPrompt, prompt);

  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const rawText = await response.text().catch(() => "");
    // Log sanitized error — don't include raw LLM provider response bodies
    log.error("LLM API error", {
      provider: provider.name,
      model,
      status: response.status,
      body: sanitizeErrorForStorage(rawText),
    });
    throw new Error(
      `LLM API error (${provider.name}): ${response.status} ${sanitizeErrorForStorage(rawText)}`,
    );
  }

  const data: unknown = await response.json();
  const content = provider.extractContent(data);

  // Parse the JSON response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`LLM returned non-JSON response: ${content}`);
  }

  let parsed: { score?: number; label?: string };
  try {
    parsed = JSON.parse(jsonMatch[0]) as { score?: number; label?: string };
  } catch {
    throw new Error(`LLM returned invalid JSON: ${jsonMatch[0]}`);
  }

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

  const run = await getEvaluatorRun(runId);
  if (!run) {
    throw new Error(`Evaluator run ${runId} not found`);
  }

  // Worker is trusted internal code — fetch evaluator by ID without org scoping
  const evaluator = await getEvaluatorById(run.evaluatorId);
  if (!evaluator) {
    throw new Error(`Evaluator ${run.evaluatorId} not found`);
  }

  const orgId = evaluator.orgId;

  // Consent gate: check BEFORE marking as running to avoid unnecessary retries
  const consentEnabled = await isLlmEvaluationEnabled(orgId);
  if (!consentEnabled) {
    await updateEvaluatorRunStatus(runId, orgId, "failed", {
      error: "LLM evaluation is not enabled for this organization",
    });
    return; // Don't throw — no point retrying a consent issue
  }

  // Mark as running only after preconditions pass
  await updateEvaluatorRunStatus(runId, orgId, "running");

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
  await updateEvaluatorRunStatus(runId, orgId, "completed", { scoreId: score.id });
}

/**
 * Create the evaluator queue (for the API to enqueue jobs).
 */
export function createEvaluatorQueue(connection: ConnectionOptions): Queue<EvaluatorJobData> {
  return new Queue<EvaluatorJobData>(EVALUATOR_QUEUE_NAME, { connection });
}

/**
 * Process a dead-letter job — mark the run as permanently failed and fire an alert.
 */
async function processDlqJob(
  job: Job<EvaluatorJobData & { originalError?: string }>,
): Promise<void> {
  const { runId, originalError } = job.data;
  log.warn("DLQ: permanently failed evaluator run", { runId, originalError });

  // Look up orgId from the evaluator run chain
  const run = await getEvaluatorRun(runId);
  const evaluator = run ? await getEvaluatorById(run.evaluatorId) : null;
  const dlqOrgId = evaluator?.orgId;
  if (!dlqOrgId) {
    log.error("DLQ: could not resolve orgId for run", { runId });
    return;
  }

  await updateEvaluatorRunStatus(runId, dlqOrgId, "failed", {
    error: `Permanently failed after ${MAX_ATTEMPTS} attempts: ${sanitizeErrorForStorage(originalError ?? "unknown error")}`,
  });

  // TODO: Hook into notification system to alert on DLQ events
  // For now, the structured log above is queryable by ops teams.
}

/**
 * Start the evaluator worker (runs in the worker process).
 * Failed jobs that exhaust all retries are moved to a dead-letter queue.
 */
export function startEvaluatorWorker(connection: ConnectionOptions): Worker<EvaluatorJobData> {
  // Create DLQ for permanently failed jobs
  const dlq = new Queue<EvaluatorJobData & { originalError?: string }>(EVALUATOR_DLQ_NAME, {
    connection,
  });

  const dlqWorker = new Worker<EvaluatorJobData & { originalError?: string }>(
    EVALUATOR_DLQ_NAME,
    async (job) => {
      await processDlqJob(job);
    },
    { connection, concurrency: 5 },
  );
  dlqWorker.on("failed", (job, err) => {
    log.error("DLQ processing failed", {
      jobId: job?.id,
      runId: job?.data?.runId,
      error: err.message,
    });
  });

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
    log.info("Job completed", { jobId: job.id, runId: job.data.runId });
  });

  worker.on("failed", (job, err) => {
    const runId = job?.data?.runId ?? "unknown";
    const attempts = job?.attemptsMade ?? 0;
    log.error("Job failed", {
      jobId: job?.id,
      runId,
      error: err.message,
      attempt: attempts,
      maxAttempts: MAX_ATTEMPTS,
    });

    if (attempts >= MAX_ATTEMPTS && job?.data?.runId) {
      // Move to DLQ after exhausting all retries
      dlq
        .add(
          "dlq",
          { runId: job.data.runId, originalError: err.message },
          {
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        )
        .catch((e) => {
          log.error("Failed to enqueue DLQ job", { runId: job?.data?.runId, error: String(e) });
        });
    } else if (job?.data?.runId) {
      // Intermediate failure — resolve orgId and update status to allow retry
      (async () => {
        const failedRun = await getEvaluatorRun(job.data.runId);
        const failedEval = failedRun ? await getEvaluatorById(failedRun.evaluatorId) : null;
        if (failedEval?.orgId) {
          await updateEvaluatorRunStatus(job.data.runId, failedEval.orgId, "failed", {
            error: sanitizeErrorForStorage(err.message),
          });
        }
      })().catch((e) => {
        log.error("Failed to update run status", { runId: job?.data?.runId, error: String(e) });
      });
    }
  });

  return worker;
}
