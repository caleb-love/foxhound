import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FoxhoundApiClient } from "@foxhound/api-client";
import type { Span } from "@foxhound/types";
import { extractTraceInput } from "../lib/formatters.js";

export function registerWorkflowTools(server: McpServer, api: FoxhoundApiClient): void {
  server.tool(
    "foxhound_score_trace",
    "Create a score for a trace or specific span. Scores can be numeric values (0-1) or categorical labels. Preview mode shows what will be created; set confirm=true to execute.",
    {
      trace_id: z.string().describe("The trace ID to score"),
      span_id: z
        .string()
        .optional()
        .describe("Optional span ID to score (if omitted, scores the entire trace)"),
      name: z.string().describe("Score name (e.g., 'quality', 'accuracy', 'latency')"),
      value: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Numeric score value between 0 and 1 (mutually exclusive with label)"),
      label: z
        .string()
        .optional()
        .describe(
          "Categorical label (e.g., 'good', 'bad', 'excellent') (mutually exclusive with value)",
        ),
      comment: z.string().optional().describe("Optional comment explaining the score"),
      confirm: z
        .boolean()
        .optional()
        .describe("Set to true to execute the score creation; omit or set to false for preview"),
    },
    async (params) => {
      try {
        if (params.confirm !== true) {
          const lines: string[] = [
            `# Score Preview`,
            "",
            `**This will create the following score:**`,
            "",
            `- Trace ID: ${params.trace_id}`,
          ];
          if (params.span_id) lines.push(`- Span ID: ${params.span_id}`);
          lines.push(`- Name: ${params.name}`);
          if (params.value !== undefined) lines.push(`- Value: ${params.value}`);
          if (params.label !== undefined) lines.push(`- Label: ${params.label}`);
          if (params.comment) lines.push(`- Comment: ${params.comment}`);
          lines.push(`- Source: manual`, "", "**To execute, re-run with `confirm: true`**");
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        const score = await api.createScore({
          traceId: params.trace_id,
          spanId: params.span_id,
          name: params.name,
          value: params.value,
          label: params.label,
          source: "manual",
          comment: params.comment,
        });

        const lines: string[] = [
          `# Score Created`,
          "",
          `✅ Successfully created score **${score.id}**`,
          "",
          `- Trace: ${score.traceId}`,
        ];
        if (score.spanId) lines.push(`- Span: ${score.spanId}`);
        lines.push(`- Name: ${score.name}`);
        if (score.value !== undefined) lines.push(`- Value: ${score.value}`);
        if (score.label !== undefined) lines.push(`- Label: ${score.label}`);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text", text: `Error creating score for trace "${params.trace_id}": ${msg}` },
          ],
        };
      }
    },
  );

  server.tool(
    "foxhound_get_trace_scores",
    "Retrieve all scores attached to a trace, including both trace-level and span-level scores.",
    { trace_id: z.string().describe("The trace ID to fetch scores for") },
    async (params) => {
      try {
        const response = await api.getTraceScores(params.trace_id);
        if (!response.data.length) {
          return {
            content: [
              {
                type: "text",
                text: `# Scores for ${params.trace_id}\n\nNo scores found for this trace.`,
              },
            ],
          };
        }

        const lines: string[] = [
          `# Scores for ${params.trace_id}`,
          "",
          `Found ${response.data.length} score(s):`,
          "",
          "| Score Name | Value/Label | Source | Comment |",
          "|------------|-------------|--------|---------|",
        ];
        for (const score of response.data) {
          const valueLabel =
            score.value !== undefined ? score.value.toString() : (score.label ?? "—");
          const source = score.source ?? "—";
          const comment = score.comment ?? "—";
          const spanIndicator = score.spanId ? ` (span: ${score.spanId})` : "";
          lines.push(`| ${score.name}${spanIndicator} | ${valueLabel} | ${source} | ${comment} |`);
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text", text: `Error fetching scores for trace "${params.trace_id}": ${msg}` },
          ],
        };
      }
    },
  );

  server.tool(
    "foxhound_list_evaluators",
    "List all configured LLM-as-a-Judge evaluators with their settings.",
    {},
    async () => {
      try {
        const response = await api.listEvaluators();
        if (!response.data.length)
          return { content: [{ type: "text", text: "No evaluators configured." }] };

        const lines: string[] = [
          `## Evaluators (${response.data.length})`,
          "",
          "| ID | Name | Model | Scoring Type | Enabled |",
          "|-----|------|-------|--------------|---------|",
        ];
        for (const evaluator of response.data) {
          const enabled = evaluator.enabled ? "✅" : "❌";
          lines.push(
            `| ${evaluator.id} | ${evaluator.name} | ${evaluator.model} | ${evaluator.scoringType} | ${enabled} |`,
          );
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error listing evaluators: ${msg}` }] };
      }
    },
  );

  server.tool(
    "foxhound_run_evaluator",
    "Trigger async evaluator runs for one or more traces. Evaluator runs are async — use foxhound_get_evaluator_run to check status and results.",
    {
      evaluator_id: z.string().describe("The evaluator ID to run"),
      trace_ids: z
        .array(z.string())
        .min(1)
        .max(50)
        .describe("Array of trace IDs to evaluate (1-50)"),
    },
    async (params) => {
      try {
        const response = await api.triggerEvaluatorRuns({
          evaluatorId: params.evaluator_id,
          traceIds: params.trace_ids,
        });
        const lines: string[] = [
          `## Evaluator Runs Queued`,
          "",
          `✅ ${response.runs.length} evaluator run(s) started for evaluator **${params.evaluator_id}**`,
          "",
          "**⏳ Evaluator runs are async.** Use `foxhound_get_evaluator_run` with a run ID to check status and results.",
          "",
          "### Runs:",
        ];
        for (const run of response.runs)
          lines.push(`- **${run.id}** → trace: ${run.traceId} | status: ${run.status}`);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error triggering evaluator runs: ${msg}` }] };
      }
    },
  );

  server.tool(
    "foxhound_get_evaluator_run",
    "Check the status and results of an async evaluator run.",
    { run_id: z.string().describe("The evaluator run ID to retrieve") },
    async (params) => {
      try {
        const run = await api.getEvaluatorRun(params.run_id);
        const lines: string[] = [
          `## Evaluator Run: ${run.id}`,
          "",
          `- **Evaluator ID**: ${run.evaluatorId}`,
          `- **Trace ID**: ${run.traceId}`,
        ];
        let statusLine = "- **Status**: ";
        if (run.status === "pending" || run.status === "running") statusLine += `⏳ ${run.status}`;
        else if (run.status === "completed") statusLine += "✅ completed";
        else if (run.status === "failed") statusLine += "❌ failed";
        else statusLine += String(run.status);
        lines.push(statusLine);
        if (run.scoreId) lines.push(`- **Score ID**: ${run.scoreId}`);
        if (run.error) lines.push(`- **Error**: ${run.error}`);
        lines.push(`- **Created At**: ${run.createdAt}`);
        if (run.completedAt) lines.push(`- **Completed At**: ${run.completedAt}`);
        if (run.status === "completed" && run.scoreId) {
          lines.push("", "ℹ️ Use `foxhound_get_trace_scores` to view the score details.");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text", text: `Error fetching evaluator run "${params.run_id}": ${msg}` },
          ],
        };
      }
    },
  );

  server.tool(
    "foxhound_list_datasets",
    "List all datasets with their IDs, names, descriptions, and item counts.",
    {},
    async () => {
      try {
        const response = await api.listDatasets();
        if (!response.data.length)
          return { content: [{ type: "text", text: "No datasets found." }] };

        const datasetsWithCounts = await Promise.all(
          response.data.map(async (dataset) => {
            try {
              const details = await api.getDataset(dataset.id);
              return { ...dataset, itemCount: details.itemCount };
            } catch {
              return { ...dataset, itemCount: 0 };
            }
          }),
        );

        const lines: string[] = [
          `## Datasets (${datasetsWithCounts.length})`,
          "",
          "| ID | Name | Description | Item Count |",
          "|-----|------|-------------|------------|",
        ];
        for (const dataset of datasetsWithCounts) {
          const description = dataset.description ?? "—";
          lines.push(`| ${dataset.id} | ${dataset.name} | ${description} | ${dataset.itemCount} |`);
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error listing datasets: ${msg}` }] };
      }
    },
  );

  server.tool(
    "foxhound_add_trace_to_dataset",
    "Add a trace to a dataset by extracting its input from root span attributes. Preview mode shows what will be added; set confirm=true to execute.",
    {
      dataset_id: z.string().describe("The dataset ID to add the trace to"),
      trace_id: z.string().describe("The trace ID to extract and add"),
      expected_output: z
        .record(z.unknown())
        .optional()
        .describe("Optional expected output for this dataset item"),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("Optional metadata to attach to the dataset item"),
      confirm: z
        .boolean()
        .optional()
        .describe("Set to true to execute; omit or set to false for preview"),
    },
    async (params) => {
      try {
        const trace = await api.getTrace(params.trace_id);
        const input = extractTraceInput(trace);

        if (params.confirm !== true) {
          const lines: string[] = [
            `# Add Trace to Dataset - Preview`,
            "",
            `**This will add the following item to dataset \`${params.dataset_id}\`:**`,
            "",
            `### Trace: ${params.trace_id}`,
            "",
            `**Extracted Input:**`,
            "```json",
            JSON.stringify(input, null, 2),
            "```",
            "",
          ];
          if (params.expected_output) {
            lines.push(
              `**Expected Output:**`,
              "```json",
              JSON.stringify(params.expected_output, null, 2),
              "```",
              "",
            );
          }
          if (params.metadata) {
            lines.push(
              `**Metadata:**`,
              "```json",
              JSON.stringify(params.metadata, null, 2),
              "```",
              "",
            );
          }
          lines.push("**To execute, re-run with `confirm: true`**");
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        const item = await api.createDatasetItem(params.dataset_id, {
          input,
          expectedOutput: params.expected_output,
          metadata: params.metadata,
          sourceTraceId: params.trace_id,
        });
        const lines: string[] = [
          `# Trace Added to Dataset`,
          "",
          `✅ Successfully added trace **${params.trace_id}** to dataset **${params.dataset_id}**`,
          "",
          `- Item ID: ${item.id}`,
          `- Input fields: ${Object.keys(input).length}`,
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error adding trace to dataset: ${msg}` }] };
      }
    },
  );

  server.tool(
    "foxhound_curate_dataset",
    "Automatically add traces to a dataset based on score criteria. Filter traces where a specific score matches a threshold condition.",
    {
      dataset_id: z.string().describe("The dataset ID to add traces to"),
      score_name: z.string().describe("The score name to filter by (e.g., 'quality', 'accuracy')"),
      operator: z
        .enum(["lt", "gt", "lte", "gte"])
        .describe("Score comparison operator: lt (<), gt (>), lte (<=), gte (>=)"),
      threshold: z.number().describe("The score threshold value to compare against"),
      since_days: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Only consider traces from the last N days (optional)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .optional()
        .describe("Maximum number of traces to add (optional, default: API default)"),
    },
    async (params) => {
      try {
        const response = await api.createDatasetItemsFromTraces(params.dataset_id, {
          scoreName: params.score_name,
          scoreOperator: params.operator,
          scoreThreshold: params.threshold,
          sinceDays: params.since_days,
          limit: params.limit,
        });

        const operatorSymbol = { lt: "<", gt: ">", lte: "<=", gte: ">=" }[params.operator];
        const lines: string[] = [
          `# Dataset Curated`,
          "",
          `✅ Added **${response.added}** trace(s) to dataset **${params.dataset_id}**`,
          "",
          `**Filter Criteria:**`,
          `- Score: \`${params.score_name}\` ${operatorSymbol} ${params.threshold}`,
        ];
        if (params.since_days) lines.push(`- Time range: last ${params.since_days} day(s)`);
        if (params.limit) lines.push(`- Limit: ${params.limit} traces max`);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error curating dataset: ${msg}` }] };
      }
    },
  );

  server.tool(
    "foxhound_list_prompts",
    "List all prompt templates in the registry. Shows prompt names, IDs, and timestamps. Requires Pro plan.",
    {},
    async () => {
      try {
        const data = await api.listPrompts();
        const prompts = data.data;
        if (!prompts.length) {
          return {
            content: [
              { type: "text", text: "No prompts found. Create one with `foxhound_create_prompt`." },
            ],
          };
        }

        const lines = [
          `## Prompts (${prompts.length})`,
          "",
          ...prompts.map(
            (p) => `- **${p.name}** (${p.id}) | updated ${new Date(p.updatedAt).toISOString()}`,
          ),
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error listing prompts: ${msg}` }] };
      }
    },
  );

  server.tool(
    "foxhound_get_prompt",
    "Resolve a prompt by name and label (defaults to 'production'). Returns the prompt content, model, config, and version number. Use this to inspect what prompt version is currently active.",
    {
      name: z.string().describe("The prompt name (e.g. 'support-agent')"),
      label: z
        .string()
        .optional()
        .describe(
          "The label to resolve (default: 'production'). Common labels: production, staging, canary",
        ),
    },
    async (params) => {
      try {
        const data = await api.resolvePrompt(params.name, params.label);
        const lines = [
          `## Prompt: ${data.name}`,
          `- Label: ${data.label}`,
          `- Version: ${data.version}`,
          `- Model: ${data.model ?? "not specified"}`,
          "",
          "### Content",
          "```",
          data.content,
          "```",
        ];
        if (data.config && Object.keys(data.config).length > 0) {
          lines.push("", "### Config", "```json", JSON.stringify(data.config, null, 2), "```");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Error resolving prompt "${params.name}": ${msg}` }],
        };
      }
    },
  );

  server.tool(
    "foxhound_list_prompt_versions",
    "List all versions of a prompt, including their labels. Use the prompt ID (not name) from `foxhound_list_prompts`.",
    { prompt_id: z.string().describe("The prompt ID (e.g. 'pmt_...')") },
    async (params) => {
      try {
        const data = await api.listPromptVersions(params.prompt_id);
        const versions = data.data;
        if (!versions.length)
          return {
            content: [{ type: "text", text: `No versions found for prompt ${params.prompt_id}.` }],
          };

        const lines = [
          `## Versions for ${params.prompt_id} (${versions.length})`,
          "",
          ...versions.map((v) => {
            const labels = v.labels?.length ? ` [${v.labels.join(", ")}]` : "";
            const model = v.model ? ` | model: ${v.model}` : "";
            return `- **v${v.version}**${labels}${model} | ${v.content.length} chars | ${new Date(v.createdAt).toISOString()}`;
          }),
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text", text: `Error listing versions for "${params.prompt_id}": ${msg}` },
          ],
        };
      }
    },
  );

  server.tool(
    "foxhound_create_prompt",
    "Create a new prompt in the registry. The name must be alphanumeric with hyphens/underscores (no spaces). Requires Pro plan. This is a write operation.",
    {
      name: z
        .string()
        .describe("Prompt name (alphanumeric, hyphens, underscores only — e.g. 'support-agent')"),
    },
    async (params) => {
      try {
        const prompt = await api.createPrompt(params.name);
        return {
          content: [
            {
              type: "text",
              text: `Prompt created: **${prompt.name}** (${prompt.id})\n\nNext: add a version with \`foxhound_create_prompt_version\`.`,
            },
          ],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error creating prompt: ${msg}` }] };
      }
    },
  );

  server.tool(
    "foxhound_create_prompt_version",
    "Add a new version to an existing prompt. The version number auto-increments. Requires Pro plan. This is a write operation.",
    {
      prompt_id: z.string().describe("The prompt ID (e.g. 'pmt_...')"),
      content: z.string().describe("The prompt template content"),
      model: z
        .string()
        .optional()
        .describe("Optional model recommendation (e.g. 'gpt-4o', 'claude-sonnet-4-20250514')"),
    },
    async (params) => {
      try {
        const version = await api.createPromptVersion(params.prompt_id, {
          content: params.content,
          model: params.model,
        });
        return {
          content: [
            {
              type: "text",
              text: `Version **v${version.version}** created for prompt ${params.prompt_id} (${version.id})\n\nNext: label it with \`foxhound_set_prompt_label\` (e.g. label "staging" or "production").`,
            },
          ],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error creating prompt version: ${msg}` }] };
      }
    },
  );

  server.tool(
    "foxhound_set_prompt_label",
    "Set a label (e.g. 'production', 'staging') on a specific prompt version. If the label already exists on another version of the same prompt, it is moved. This is a write operation.",
    {
      prompt_id: z.string().describe("The prompt ID (e.g. 'pmt_...')"),
      version_number: z.number().int().positive().describe("The version number to label"),
      label: z
        .string()
        .describe("Label name (alphanumeric, hyphens, underscores — e.g. 'production', 'staging')"),
    },
    async (params) => {
      try {
        const result = await api.setPromptLabel(params.prompt_id, {
          label: params.label,
          versionNumber: params.version_number,
        });
        return { content: [{ type: "text", text: result.message }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error setting label: ${msg}` }] };
      }
    },
  );

  server.tool(
    "foxhound_suggest_fix",
    "Analyze a failed trace and suggest specific fixes based on error patterns, including timeout issues, auth failures, rate limits, and more.",
    { trace_id: z.string().describe("The trace ID to analyze") },
    async (params) => {
      try {
        const trace = await api.getTrace(params.trace_id);
        const errorSpans = trace.spans.filter((s) => s.status === "error");
        if (!errorSpans.length) {
          return {
            content: [
              {
                type: "text",
                text: `# Fix Suggestions: ${trace.id}\n\nNo errors detected in this trace. No fixes needed.`,
              },
            ],
          };
        }

        type ErrorCategory =
          | "timeout"
          | "auth"
          | "rate_limit"
          | "tool_error"
          | "llm_error"
          | "validation"
          | "unknown";
        interface CategorizedError {
          category: ErrorCategory;
          span: Span;
          message: string;
        }
        const categorized: CategorizedError[] = [];

        for (const span of errorSpans) {
          const errorEvents = span.events.filter((e) => e.name === "error");
          const errorMsg =
            errorEvents.length > 0
              ? String(
                  errorEvents[0]?.attributes["error.message"] ??
                    errorEvents[0]?.attributes["message"] ??
                    "",
                ).toLowerCase()
              : "";
          let category: ErrorCategory = "unknown";
          const duration =
            span.endTimeMs && span.startTimeMs ? span.endTimeMs - span.startTimeMs : 0;
          if (
            duration > 30000 ||
            errorMsg.includes("timeout") ||
            errorMsg.includes("timed out") ||
            errorMsg.includes("deadline")
          )
            category = "timeout";
          else if (
            errorMsg.includes("unauthorized") ||
            errorMsg.includes("forbidden") ||
            errorMsg.includes("401") ||
            errorMsg.includes("403") ||
            errorMsg.includes("api key") ||
            errorMsg.includes("authentication")
          )
            category = "auth";
          else if (
            errorMsg.includes("rate limit") ||
            errorMsg.includes("429") ||
            errorMsg.includes("too many requests") ||
            errorMsg.includes("quota")
          )
            category = "rate_limit";
          else if (span.kind === "tool_call") category = "tool_error";
          else if (
            span.kind === "llm_call" ||
            errorMsg.includes("model") ||
            errorMsg.includes("openai") ||
            errorMsg.includes("anthropic")
          )
            category = "llm_error";
          else if (
            errorMsg.includes("validation") ||
            errorMsg.includes("invalid") ||
            errorMsg.includes("required") ||
            errorMsg.includes("schema")
          )
            category = "validation";
          categorized.push({ category, span, message: errorMsg });
        }

        const byCategory = new Map<ErrorCategory, CategorizedError[]>();
        for (const item of categorized) {
          const existing = byCategory.get(item.category) ?? [];
          existing.push(item);
          byCategory.set(item.category, existing);
        }

        const lines: string[] = [`# Fix Suggestions: ${trace.id}`, ""];
        if (byCategory.has("timeout")) {
          const errors = byCategory.get("timeout")!;
          lines.push(`## Timeout Issues (${errors.length})`, "");
          for (const e of errors) {
            const duration =
              e.span.endTimeMs && e.span.startTimeMs ? e.span.endTimeMs - e.span.startTimeMs : 0;
            lines.push(`**${e.span.name}** (${duration}ms)`);
          }
          lines.push(
            "",
            "**Suggested Fixes:**",
            "- Increase timeout threshold in your client configuration",
            "- Optimize the underlying query or operation to reduce latency",
            "- Add retry logic with exponential backoff",
            "- Consider breaking the operation into smaller chunks",
            "",
          );
        }
        if (byCategory.has("auth")) {
          const errors = byCategory.get("auth")!;
          lines.push(`## Authentication Failures (${errors.length})`, "");
          for (const e of errors) lines.push(`**${e.span.name}**`);
          lines.push(
            "",
            "**Suggested Fixes:**",
            "- Verify API key is set correctly in environment variables",
            "- Check that credentials haven't expired or been revoked",
            "- Ensure you have the necessary permissions for this operation",
            "- Confirm the API endpoint is correct for your key",
            "",
          );
        }
        if (byCategory.has("rate_limit")) {
          const errors = byCategory.get("rate_limit")!;
          lines.push(`## Rate Limit Exceeded (${errors.length})`, "");
          for (const e of errors) lines.push(`**${e.span.name}**`);
          lines.push(
            "",
            "**Suggested Fixes:**",
            "- Implement exponential backoff with jitter",
            "- Reduce request rate or batch operations",
            "- Upgrade your API plan for higher rate limits",
            "- Add request queuing to smooth traffic",
            "",
          );
        }
        if (byCategory.has("tool_error")) {
          const errors = byCategory.get("tool_error")!;
          lines.push(`## Tool Execution Errors (${errors.length})`, "");
          for (const e of errors) lines.push(`**${e.span.name}**`);
          lines.push(
            "",
            "**Suggested Fixes:**",
            "- Verify tool configuration and parameters are correct",
            "- Check that the tool service is available and responsive",
            "- Inspect tool-specific logs for detailed error messages",
            "- Validate tool input schema and required fields",
            "",
          );
        }
        if (byCategory.has("llm_error")) {
          const errors = byCategory.get("llm_error")!;
          lines.push(`## LLM Call Failures (${errors.length})`, "");
          for (const e of errors) lines.push(`**${e.span.name}**`);
          lines.push(
            "",
            "**Suggested Fixes:**",
            "- Check prompt length against model context window limits",
            "- Verify model name/identifier is correct and available",
            "- Confirm API quota hasn't been exceeded",
            "- Review model-specific error codes in LLM provider docs",
            "",
          );
        }
        if (byCategory.has("validation")) {
          const errors = byCategory.get("validation")!;
          lines.push(`## Validation Errors (${errors.length})`, "");
          for (const e of errors) lines.push(`**${e.span.name}**`);
          lines.push(
            "",
            "**Suggested Fixes:**",
            "- Review input schema and ensure all required fields are provided",
            "- Verify data types match the expected schema",
            "- Check for null/undefined values in required fields",
            "- Inspect detailed error messages for specific validation failures",
            "",
          );
        }
        if (byCategory.has("unknown")) {
          const errors = byCategory.get("unknown")!;
          lines.push(`## Other Errors (${errors.length})`, "");
          for (const e of errors) {
            const errorEvents = e.span.events.filter((ev) => ev.name === "error");
            const msg =
              errorEvents.length > 0
                ? String(
                    errorEvents[0]?.attributes["error.message"] ??
                      errorEvents[0]?.attributes["message"] ??
                      "Unknown error",
                  )
                : "Unknown error";
            lines.push(`**${e.span.name}**: ${msg}`);
          }
          lines.push(
            "",
            "**Suggested Fixes:**",
            "- Inspect error events and attributes for more context",
            "- Check application logs for additional error details",
            "- Use `foxhound_explain_failure` for detailed error chain analysis",
            "",
          );
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Error fetching trace "${params.trace_id}": ${msg}` }],
        };
      }
    },
  );
}
