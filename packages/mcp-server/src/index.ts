#!/usr/bin/env node

/**
 * Foxhound MCP Server
 *
 * Exposes Foxhound trace querying tools via the Model Context Protocol,
 * allowing developers using Claude Code, Cursor, Windsurf, or any
 * MCP-connected client to query traces conversationally while debugging.
 *
 * Setup:
 *   FOXHOUND_API_KEY=fox_... FOXHOUND_ENDPOINT=https://api.foxhound.dev npx @foxhound/mcp-server
 *
 * Claude Code:
 *   claude mcp add foxhound -- npx @foxhound/mcp-server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FoxhoundApiClient, toEpochMs, type TraceListResponse } from "@foxhound/api-client";
import type { Trace, Span } from "@foxhound/types";

function getConfig(): { endpoint: string; apiKey: string } {
  const apiKey = process.env["FOXHOUND_API_KEY"];
  const endpoint = process.env["FOXHOUND_ENDPOINT"] ?? "http://localhost:3001";

  if (!apiKey) {
    console.error("Error: FOXHOUND_API_KEY environment variable is required.");
    console.error("Set it in your environment or MCP client config.");
    process.exit(1);
  }

  return { endpoint, apiKey };
}

function formatTraceList(result: TraceListResponse): string {
  if (!result.data.length) return "No traces found matching your criteria.";

  const lines = result.data.map((t) => {
    const spanCount = t.spans?.length ?? 0;
    const errors = t.spans?.filter((s) => s.status === "error").length ?? 0;
    const duration =
      t.endTimeMs && t.startTimeMs ? `${((t.endTimeMs - t.startTimeMs) / 1000).toFixed(1)}s` : "?";
    const time = new Date(t.startTimeMs).toISOString();
    const errorTag = errors > 0 ? ` [${errors} error(s)]` : "";
    return `- **${t.id}** | agent: ${t.agentId} | ${spanCount} spans | ${duration} | ${time}${errorTag}`;
  });

  return `Found ${result.pagination.count} trace(s) (page ${result.pagination.page}):\n\n${lines.join("\n")}`;
}

function formatTrace(trace: Trace): string {
  const duration =
    trace.endTimeMs && trace.startTimeMs
      ? `${((trace.endTimeMs - trace.startTimeMs) / 1000).toFixed(1)}s`
      : "in progress";

  const header = [
    `# Trace ${trace.id}`,
    `- Agent: ${trace.agentId}`,
    trace.sessionId ? `- Session: ${trace.sessionId}` : null,
    `- Duration: ${duration}`,
    `- Started: ${new Date(trace.startTimeMs).toISOString()}`,
    `- Spans: ${trace.spans.length}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Build span tree
  const rootSpans = trace.spans.filter((s) => !s.parentSpanId);
  const childMap = new Map<string, Span[]>();
  for (const span of trace.spans) {
    if (span.parentSpanId) {
      const siblings = childMap.get(span.parentSpanId) ?? [];
      siblings.push(span);
      childMap.set(span.parentSpanId, siblings);
    }
  }

  function renderSpan(span: Span, indent: number): string {
    const prefix = "  ".repeat(indent);
    const dur = span.endTimeMs && span.startTimeMs ? `${span.endTimeMs - span.startTimeMs}ms` : "?";
    const status = span.status === "error" ? " **ERROR**" : "";
    const errors = span.events?.filter((e) => e.name === "error") ?? [];
    const errorMsg = errors.length > 0 ? ` — ${JSON.stringify(errors[0]?.attributes)}` : "";

    let line = `${prefix}- [${span.kind}] **${span.name}** (${dur})${status}${errorMsg}`;

    const attrs = Object.entries(span.attributes ?? {}).filter(
      ([, v]) => v !== null && v !== undefined && v !== "",
    );
    if (attrs.length > 0) {
      line += `\n${prefix}  Attributes: ${attrs.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")}`;
    }

    const children = childMap.get(span.spanId) ?? [];
    const childLines = children.map((c) => renderSpan(c, indent + 1));
    return [line, ...childLines].join("\n");
  }

  const tree = rootSpans.map((s) => renderSpan(s, 0)).join("\n");

  return `${header}\n\n## Span Tree\n\n${tree}`;
}

async function main(): Promise<void> {
  const config = getConfig();
  const api = new FoxhoundApiClient(config);

  const server = new McpServer({
    name: "foxhound",
    version: "0.1.0",
  });

  // --- Tool: search traces ---
  server.tool(
    "foxhound_search_traces",
    "Search traces by agent name, time range, and pagination. Returns a summary list of matching traces.",
    {
      agent_name: z.string().optional().describe("Filter by agent ID/name"),
      from: z.string().optional().describe("Start time (ISO 8601 or epoch ms)"),
      to: z.string().optional().describe("End time (ISO 8601 or epoch ms)"),
      limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
    },
    async (params) => {
      const fromMs = params.from ? toEpochMs(params.from) : undefined;
      const toMs = params.to ? toEpochMs(params.to) : undefined;
      const data = await api.searchTraces({
        agentId: params.agent_name,
        from: fromMs,
        to: toMs,
        limit: params.limit ?? 20,
      });
      return { content: [{ type: "text", text: formatTraceList(data) }] };
    },
  );

  // --- Tool: get trace ---
  server.tool(
    "foxhound_get_trace",
    "Get the full trace with its complete span tree. Use this to inspect what happened during an agent run.",
    {
      trace_id: z.string().describe("The trace ID to retrieve"),
    },
    async (params) => {
      const data = await api.getTrace(params.trace_id);
      return { content: [{ type: "text", text: formatTrace(data) }] };
    },
  );

  // --- Tool: replay span ---
  server.tool(
    "foxhound_replay_span",
    "Reconstruct the full agent state at the moment a specific span began — including LLM context, tool inputs, and memory. Requires Pro plan.",
    {
      trace_id: z.string().describe("The trace ID containing the span"),
      span_id: z.string().describe("The span ID to replay"),
    },
    async (params) => {
      const data = await api.replaySpan(params.trace_id, params.span_id);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // --- Tool: diff runs ---
  server.tool(
    "foxhound_diff_runs",
    "Compare two agent runs side-by-side and surface divergence points. Useful for debugging regressions. Requires Pro plan.",
    {
      trace_id_a: z.string().describe("First trace/run ID"),
      trace_id_b: z.string().describe("Second trace/run ID"),
    },
    async (params) => {
      const data = await api.diffRuns(params.trace_id_a, params.trace_id_b);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // --- Tool: get anomalies ---
  server.tool(
    "foxhound_get_anomalies",
    "Surface behavioral anomalies in recent traces for an agent — unusually slow spans, error spikes, or unexpected tool usage patterns.",
    {
      agent_name: z.string().describe("Agent ID/name to analyze"),
      hours: z
        .number()
        .int()
        .min(1)
        .max(168)
        .optional()
        .describe("Lookback window in hours (default 24)"),
    },
    async (params) => {
      const hours = params.hours ?? 24;
      const toMs = Date.now();
      const fromMs = toMs - hours * 60 * 60 * 1000;

      const data = await api.searchTraces({
        agentId: params.agent_name,
        from: fromMs,
        to: toMs,
        limit: 100,
      });

      if (!data.data.length) {
        return {
          content: [
            {
              type: "text",
              text: `No traces found for agent "${params.agent_name}" in the last ${hours} hours.`,
            },
          ],
        };
      }

      // Analyze for anomalies
      const allSpans = data.data.flatMap((t) => t.spans ?? []);
      const errorSpans = allSpans.filter((s) => s.status === "error");
      const spanDurations = allSpans
        .filter((s) => s.endTimeMs && s.startTimeMs)
        .map((s) => ({
          name: s.name,
          kind: s.kind,
          durationMs: (s.endTimeMs ?? 0) - s.startTimeMs,
        }));

      // Find slow outliers (> 2x average for their kind)
      const kindAvg = new Map<string, { total: number; count: number }>();
      for (const s of spanDurations) {
        const entry = kindAvg.get(s.kind) ?? { total: 0, count: 0 };
        entry.total += s.durationMs;
        entry.count++;
        kindAvg.set(s.kind, entry);
      }

      const slowSpans = spanDurations.filter((s) => {
        const avg = kindAvg.get(s.kind);
        return avg && s.durationMs > (avg.total / avg.count) * 2;
      });

      const lines: string[] = [
        `## Anomaly Report: ${params.agent_name}`,
        `Period: last ${hours} hours (${data.data.length} traces, ${allSpans.length} spans)`,
        "",
      ];

      if (errorSpans.length > 0) {
        const errorRate = ((errorSpans.length / allSpans.length) * 100).toFixed(1);
        lines.push(`### Errors: ${errorSpans.length} (${errorRate}% of spans)`);
        const errorNames = new Map<string, number>();
        for (const e of errorSpans) {
          errorNames.set(e.name, (errorNames.get(e.name) ?? 0) + 1);
        }
        for (const [name, count] of [...errorNames.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)) {
          lines.push(`- **${name}**: ${count} errors`);
        }
        lines.push("");
      } else {
        lines.push("### Errors: None");
        lines.push("");
      }

      if (slowSpans.length > 0) {
        lines.push(`### Slow Outliers: ${slowSpans.length} spans (>2x average for their kind)`);
        for (const s of slowSpans.slice(0, 10)) {
          const avg = kindAvg.get(s.kind);
          const avgMs = avg ? Math.round(avg.total / avg.count) : 0;
          lines.push(`- **${s.name}** [${s.kind}]: ${s.durationMs}ms (avg: ${avgMs}ms)`);
        }
        lines.push("");
      } else {
        lines.push("### Slow Outliers: None detected");
        lines.push("");
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  // --- Tool: cost summary ---
  server.tool(
    "foxhound_get_cost_summary",
    "Get token usage and cost breakdown. Shows current billing period span usage and limits.",
    {},
    async () => {
      const data = await api.getUsage();

      const pct = data.spansLimit > 0 ? ((data.spansUsed / data.spansLimit) * 100).toFixed(1) : "∞";
      const lines = [
        `## Usage Summary`,
        `- Period: ${data.period}`,
        `- Spans used: ${data.spansUsed.toLocaleString()} / ${data.spansLimit > 0 ? data.spansLimit.toLocaleString() : "unlimited"}`,
        `- Usage: ${pct}%`,
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  // --- Tool: list alert rules ---
  server.tool(
    "foxhound_list_alert_rules",
    "List all alert rules configured for your organization.",
    {},
    async () => {
      const data = await api.listAlertRules();
      const rules = data.data;
      if (!rules.length) return { content: [{ type: "text", text: "No alert rules configured." }] };

      const lines = rules.map(
        (r) =>
          `- **${r.id}** | ${r.eventType} >= ${r.minSeverity} -> channel ${r.channelId} | ${r.enabled ? "enabled" : "disabled"}`,
      );
      return {
        content: [
          { type: "text", text: `## Alert Rules (${rules.length})\n\n${lines.join("\n")}` },
        ],
      };
    },
  );

  // --- Tool: create alert rule ---
  server.tool(
    "foxhound_create_alert_rule",
    "Create a new alert rule that routes events to a notification channel. This is a write operation.",
    {
      event_type: z
        .enum(["agent_failure", "anomaly_detected", "cost_spike", "compliance_violation"])
        .describe("The event type to trigger on"),
      min_severity: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("Minimum severity to trigger (default: high)"),
      channel_id: z.string().describe("The notification channel ID to route alerts to"),
    },
    async (params) => {
      const rule = await api.createAlertRule({
        eventType: params.event_type,
        minSeverity: params.min_severity ?? "high",
        channelId: params.channel_id,
      });
      return {
        content: [
          {
            type: "text",
            text: `Alert rule created: **${rule.id}**\n- Event: ${rule.eventType}\n- Severity >= ${rule.minSeverity}\n- Channel: ${rule.channelId}`,
          },
        ],
      };
    },
  );

  // --- Tool: delete alert rule ---
  server.tool(
    "foxhound_delete_alert_rule",
    "Delete an alert rule by ID. Set confirm=true to execute. Without confirmation, returns a preview of what will be deleted.",
    {
      rule_id: z.string().describe("The alert rule ID to delete"),
      confirm: z.boolean().optional().describe("Set to true to confirm deletion. Omit to preview."),
    },
    async (params) => {
      if (!params.confirm) {
        return {
          content: [
            {
              type: "text",
              text: `**Preview:** Will delete alert rule **${params.rule_id}**.\n\nCall again with \`confirm: true\` to execute.`,
            },
          ],
        };
      }

      await api.deleteAlertRule(params.rule_id);
      return {
        content: [{ type: "text", text: `Alert rule **${params.rule_id}** deleted.` }],
      };
    },
  );

  // --- Tool: list channels ---
  server.tool(
    "foxhound_list_channels",
    "List all notification channels (e.g. Slack webhooks) configured for your organization.",
    {},
    async () => {
      const data = await api.listChannels();
      const channels = data.data;
      if (!channels.length)
        return { content: [{ type: "text", text: "No notification channels configured." }] };

      const lines = channels.map(
        (c) => `- **${c.id}** | ${c.kind} | "${c.name}" | created ${c.createdAt}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `## Notification Channels (${channels.length})\n\n${lines.join("\n")}`,
          },
        ],
      };
    },
  );

  // --- Tool: create channel ---
  server.tool(
    "foxhound_create_channel",
    "Create a new Slack notification channel. This is a write operation.",
    {
      name: z.string().describe("A human-readable name for the channel"),
      webhook_url: z.string().describe("The Slack incoming webhook URL"),
      slack_channel: z.string().optional().describe("Optional Slack channel override"),
    },
    async (params) => {
      const channel = await api.createChannel({
        name: params.name,
        kind: "slack",
        config: {
          webhookUrl: params.webhook_url,
          channel: params.slack_channel,
        },
      });
      return {
        content: [
          {
            type: "text",
            text: `Channel created: **${channel.id}** ("${channel.name}", ${channel.kind})`,
          },
        ],
      };
    },
  );

  // --- Tool: test channel ---
  server.tool(
    "foxhound_test_channel",
    "Send a test alert through a notification channel to verify it works.",
    {
      channel_id: z.string().describe("The channel ID to test"),
    },
    async (params) => {
      await api.testChannel(params.channel_id);
      return {
        content: [{ type: "text", text: `Test alert sent to channel **${params.channel_id}**.` }],
      };
    },
  );

  // --- Tool: delete channel ---
  server.tool(
    "foxhound_delete_channel",
    "Delete a notification channel by ID. This may also delete associated alert rules. Set confirm=true to execute.",
    {
      channel_id: z.string().describe("The channel ID to delete"),
      confirm: z.boolean().optional().describe("Set to true to confirm deletion. Omit to preview."),
    },
    async (params) => {
      if (!params.confirm) {
        return {
          content: [
            {
              type: "text",
              text: `**Preview:** Will delete channel **${params.channel_id}** and any alert rules routing to it.\n\nCall again with \`confirm: true\` to execute.`,
            },
          ],
        };
      }

      await api.deleteChannel(params.channel_id);
      return {
        content: [{ type: "text", text: `Channel **${params.channel_id}** deleted.` }],
      };
    },
  );

  // --- Tool: list API keys ---
  server.tool(
    "foxhound_list_api_keys",
    "List active API keys for your organization. Keys are masked — only the prefix is shown.",
    {},
    async () => {
      const data = await api.listApiKeys();
      const keys = data.data;
      if (!keys.length) return { content: [{ type: "text", text: "No API keys found." }] };

      const lines = keys.map(
        (k) => `- **${k.id}** | "${k.name}" | prefix: ${k.prefix}... | created ${k.createdAt}`,
      );
      return {
        content: [{ type: "text", text: `## API Keys (${keys.length})\n\n${lines.join("\n")}` }],
      };
    },
  );

  // --- Tool: create API key ---
  server.tool(
    "foxhound_create_api_key",
    "Create a new API key. For security, the plaintext key is NOT returned through MCP — use the CLI (`foxhound keys create`) or dashboard to retrieve it.",
    {
      name: z.string().describe("A human-readable name for the key"),
    },
    async (params) => {
      const result = await api.createApiKey(params.name);
      return {
        content: [
          {
            type: "text",
            text:
              `API key created: **${result.id}** ("${result.name}", prefix: ${result.prefix}...)\n\n` +
              `The plaintext key is not shown in MCP for security reasons.\n` +
              `Retrieve it from the CLI output or dashboard. It cannot be shown again after creation.`,
          },
        ],
      };
    },
  );

  // --- Tool: revoke API key ---
  server.tool(
    "foxhound_revoke_api_key",
    "Revoke an API key by ID. The key will immediately stop working. Set confirm=true to execute.",
    {
      key_id: z.string().describe("The API key ID to revoke"),
      confirm: z
        .boolean()
        .optional()
        .describe("Set to true to confirm revocation. Omit to preview."),
    },
    async (params) => {
      if (!params.confirm) {
        return {
          content: [
            {
              type: "text",
              text: `**Preview:** Will revoke API key **${params.key_id}**. Any integrations using this key will immediately stop working.\n\nCall again with \`confirm: true\` to execute.`,
            },
          ],
        };
      }

      await api.revokeApiKey(params.key_id);
      return {
        content: [{ type: "text", text: `API key **${params.key_id}** revoked.` }],
      };
    },
  );

  // --- Tool: get agent budget ---
  server.tool(
    "foxhound_get_agent_budget",
    "Get the cost budget configuration and current spend status for a specific agent.",
    {
      agentId: z.string().describe("The agent ID to retrieve budget for"),
    },
    async (params) => {
      try {
        const data = await api.getBudget(params.agentId);
        const lines = [
          `## Budget: ${params.agentId}`,
          `- Budget amount: ${data.costBudgetUsd != null ? `$${data.costBudgetUsd}` : "not set"}`,
          `- Period: ${data.budgetPeriod ?? "not set"}`,
          `- Alert threshold: ${data.costAlertThresholdPct != null ? `${data.costAlertThresholdPct}%` : "not set"}`,
          `- Current spend status: ${data.lastCostStatus != null ? JSON.stringify(data.lastCostStatus) : "no data"}`,
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text", text: `Error fetching budget for agent "${params.agentId}": ${msg}` },
          ],
        };
      }
    },
  );

  // --- Tool: check SLA status ---
  server.tool(
    "foxhound_check_sla_status",
    "Check SLA targets and compliance status for a specific agent, including p95 duration and success rate.",
    {
      agentId: z.string().describe("The agent ID to check SLA status for"),
    },
    async (params) => {
      try {
        const data = await api.getSla(params.agentId);
        const slaStatus = data.lastSlaStatus;
        const lines = [
          `## SLA Status: ${params.agentId}`,
          `### Targets`,
          `- Max duration: ${data.maxDurationMs != null ? `${data.maxDurationMs}ms` : "not set"}`,
          `- Min success rate: ${data.minSuccessRate != null ? `${data.minSuccessRate}%` : "not set"}`,
          `- Evaluation window: ${data.evaluationWindowMs != null ? `${data.evaluationWindowMs}ms` : "not set"}`,
          `- Min sample size: ${data.minSampleSize ?? "not set"}`,
          `### Compliance`,
          `- Status: ${slaStatus != null ? JSON.stringify(slaStatus) : "no data"}`,
          slaStatus != null && typeof slaStatus["p95DurationMs"] !== "undefined"
            ? `- p95 duration: ${String(slaStatus["p95DurationMs"])}ms`
            : null,
          slaStatus != null && typeof slaStatus["successRate"] !== "undefined"
            ? `- Success rate: ${String(slaStatus["successRate"])}%`
            : null,
        ]
          .filter(Boolean)
          .join("\n");
        return { content: [{ type: "text", text: lines }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text", text: `Error fetching SLA for agent "${params.agentId}": ${msg}` },
          ],
        };
      }
    },
  );

  // --- Tool: detect regression ---
  server.tool(
    "foxhound_detect_regression",
    "Compare two versions of an agent and detect span-level regressions — missing or newly added spans between versions.",
    {
      agentId: z.string().describe("The agent ID to analyze"),
      versionA: z.string().describe("The baseline version (before)"),
      versionB: z.string().describe("The comparison version (after)"),
    },
    async (params) => {
      try {
        const data = await api.compareVersions(params.agentId, params.versionA, params.versionB);
        const lines = [
          `## Regression Report: ${params.agentId}`,
          `- Comparing: **${data.previousVersion}** → **${data.newVersion}**`,
          `- Sample sizes: before=${data.sampleSize.before}, after=${data.sampleSize.after}`,
          "",
        ];

        if (!data.regressions.length) {
          lines.push("No regressions detected between these versions.");
        } else {
          lines.push(`### Regressions (${data.regressions.length})`);
          for (const r of data.regressions) {
            if (r.type === "missing") {
              lines.push(
                `- **MISSING** \`${r.span}\` — was present in ${data.previousVersion} (freq: ${r.previousFrequency ?? "?"}) but absent in ${data.newVersion}`,
              );
            } else {
              lines.push(
                `- **NEW** \`${r.span}\` — appeared in ${data.newVersion} (freq: ${r.newFrequency ?? "?"}) but absent in ${data.previousVersion}`,
              );
            }
          }
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Error comparing versions for agent "${params.agentId}": ${msg}`,
            },
          ],
        };
      }
    },
  );

  // --- Tool: list baselines ---
  server.tool(
    "foxhound_list_baselines",
    "List all stored baseline snapshots for an agent, showing version, sample size, and creation date.",
    {
      agentId: z.string().describe("The agent ID to list baselines for"),
    },
    async (params) => {
      try {
        const data = await api.listBaselines(params.agentId);
        if (!data.data.length) {
          return {
            content: [{ type: "text", text: `No baselines found for agent "${params.agentId}".` }],
          };
        }

        const lines = [
          `## Baselines: ${params.agentId} (${data.data.length})`,
          "",
          ...data.data.map(
            (b) =>
              `- **v${b.agentVersion}** | sample size: ${b.sampleSize} | created: ${new Date(b.createdAt).toISOString()}`,
          ),
        ];

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Error fetching baselines for agent "${params.agentId}": ${msg}`,
            },
          ],
        };
      }
    },
  );

  // --- Tool: status ---
  server.tool(
    "foxhound_status",
    "Check the Foxhound API health and show usage summary for the current billing period.",
    {},
    async () => {
      const [health, usage] = await Promise.all([api.getHealth(), api.getUsage()]);

      const pct =
        usage.spansLimit > 0 ? ((usage.spansUsed / usage.spansLimit) * 100).toFixed(1) : "∞";
      const lines = [
        `## Foxhound Status`,
        `- API: ${health.status} (v${health.version})`,
        `- Period: ${usage.period}`,
        `- Spans: ${usage.spansUsed.toLocaleString()} / ${usage.spansLimit > 0 ? usage.spansLimit.toLocaleString() : "unlimited"} (${pct}%)`,
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  // --- Tool: explain failure ---
  server.tool(
    "foxhound_explain_failure",
    "Analyze a failed trace and provide a detailed explanation of what went wrong, including the error chain, affected spans, and timing information.",
    {
      trace_id: z.string().describe("The trace ID to analyze"),
    },
    async (params) => {
      try {
        const trace = await api.getTrace(params.trace_id);

        // Find all error spans
        const errorSpans = trace.spans.filter((s) => s.status === "error");

        if (!errorSpans.length) {
          return {
            content: [
              {
                type: "text",
                text: `# Trace ${trace.id}\n\nNo errors detected in this trace. All ${trace.spans.length} spans completed successfully.`,
              },
            ],
          };
        }

        // Build span lookup maps
        const spanMap = new Map<string, Span>();
        for (const span of trace.spans) {
          spanMap.set(span.spanId, span);
        }

        // Build parent chains for each error span
        function getParentChain(span: Span): Span[] {
          const chain: Span[] = [span];
          let current = span;
          while (current.parentSpanId) {
            const parent = spanMap.get(current.parentSpanId);
            if (!parent) break;
            chain.unshift(parent);
            current = parent;
          }
          return chain;
        }

        // Find the first error (earliest start time)
        const firstError = errorSpans.reduce((earliest, current) =>
          current.startTimeMs < earliest.startTimeMs ? current : earliest,
        );

        // Extract error details from events
        const errorEvents = firstError.events.filter((e) => e.name === "error");
        const errorMessage =
          errorEvents.length > 0
            ? String(errorEvents[0]?.attributes["error.message"] ?? errorEvents[0]?.attributes["message"] ?? "Unknown error")
            : "Unknown error";

        const parentChain = getParentChain(firstError);

        // Format output
        const lines: string[] = [
          `# Failure Analysis: ${trace.id}`,
          "",
          `## Summary`,
          `- **Error**: ${errorMessage}`,
          `- **Failed Span**: ${firstError.name} (${firstError.kind})`,
          `- **Error Count**: ${errorSpans.length} span(s) with errors`,
          `- **Trace Duration**: ${trace.endTimeMs && trace.startTimeMs ? `${((trace.endTimeMs - trace.startTimeMs) / 1000).toFixed(2)}s` : "incomplete"}`,
          "",
          `## Error Chain`,
          "",
        ];

        // Render parent chain
        for (let i = 0; i < parentChain.length; i++) {
          const span = parentChain[i];
          if (!span) continue;

          const isError = span.spanId === firstError.spanId;
          const prefix = "  ".repeat(i);
          const status = isError ? " ❌ **ERROR**" : "";
          const duration =
            span.endTimeMs && span.startTimeMs ? `${span.endTimeMs - span.startTimeMs}ms` : "?";

          lines.push(`${prefix}${i + 1}. [${span.kind}] **${span.name}** (${duration})${status}`);

          if (isError && errorEvents.length > 0) {
            const event = errorEvents[0];
            if (event) {
              lines.push(`${prefix}   **Error Details**:`);
              for (const [key, value] of Object.entries(event.attributes ?? {})) {
                if (value !== null && value !== undefined) {
                  lines.push(`${prefix}   - ${key}: ${JSON.stringify(value)}`);
                }
              }
            }
          }

          // Show key attributes
          const attrs = Object.entries(span.attributes ?? {}).filter(
            ([, v]) => v !== null && v !== undefined && v !== "",
          );
          if (attrs.length > 0 && i < 3) {
            // Only show attributes for top 3 levels to keep output compact
            const attrStr = attrs
              .slice(0, 3)
              .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
              .join(", ");
            lines.push(`${prefix}   Attributes: ${attrStr}${attrs.length > 3 ? ", ..." : ""}`);
          }
        }

        // List other error spans if any
        if (errorSpans.length > 1) {
          lines.push("", `## Other Errors (${errorSpans.length - 1})`);
          for (const span of errorSpans.slice(1)) {
            const duration = span.endTimeMs && span.startTimeMs ? `${span.endTimeMs - span.startTimeMs}ms` : "?";
            const events = span.events.filter((e) => e.name === "error");
            const msg =
              events.length > 0
                ? String(events[0]?.attributes["error.message"] ?? events[0]?.attributes["message"] ?? "Unknown")
                : "Unknown";
            lines.push(`- [${span.kind}] **${span.name}** (${duration}): ${msg}`);
          }
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Error fetching trace "${params.trace_id}": ${msg}`,
            },
          ],
        };
      }
    },
  );

  // --- Tool: suggest fix ---
  server.tool(
    "foxhound_suggest_fix",
    "Analyze a failed trace and suggest specific fixes based on error patterns, including timeout issues, auth failures, rate limits, and more.",
    {
      trace_id: z.string().describe("The trace ID to analyze"),
    },
    async (params) => {
      try {
        const trace = await api.getTrace(params.trace_id);

        // Find all error spans
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

        // Classify errors and collect suggestions
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
          // Extract error message
          const errorEvents = span.events.filter((e) => e.name === "error");
          const errorMsg =
            errorEvents.length > 0
              ? String(
                  errorEvents[0]?.attributes["error.message"] ??
                    errorEvents[0]?.attributes["message"] ??
                    "",
                ).toLowerCase()
              : "";

          // Classify by pattern matching
          let category: ErrorCategory = "unknown";

          // Check for timeout
          const duration = span.endTimeMs && span.startTimeMs ? span.endTimeMs - span.startTimeMs : 0;
          if (
            duration > 30000 ||
            errorMsg.includes("timeout") ||
            errorMsg.includes("timed out") ||
            errorMsg.includes("deadline")
          ) {
            category = "timeout";
          }
          // Check for auth
          else if (
            errorMsg.includes("unauthorized") ||
            errorMsg.includes("forbidden") ||
            errorMsg.includes("401") ||
            errorMsg.includes("403") ||
            errorMsg.includes("api key") ||
            errorMsg.includes("authentication")
          ) {
            category = "auth";
          }
          // Check for rate limit
          else if (
            errorMsg.includes("rate limit") ||
            errorMsg.includes("429") ||
            errorMsg.includes("too many requests") ||
            errorMsg.includes("quota")
          ) {
            category = "rate_limit";
          }
          // Check for tool error
          else if (span.kind === "tool_call") {
            category = "tool_error";
          }
          // Check for LLM error
          else if (
            span.kind === "llm_call" ||
            errorMsg.includes("model") ||
            errorMsg.includes("openai") ||
            errorMsg.includes("anthropic")
          ) {
            category = "llm_error";
          }
          // Check for validation
          else if (
            errorMsg.includes("validation") ||
            errorMsg.includes("invalid") ||
            errorMsg.includes("required") ||
            errorMsg.includes("schema")
          ) {
            category = "validation";
          }

          categorized.push({ category, span, message: errorMsg });
        }

        // Group by category
        const byCategory = new Map<ErrorCategory, CategorizedError[]>();
        for (const item of categorized) {
          const existing = byCategory.get(item.category) ?? [];
          existing.push(item);
          byCategory.set(item.category, existing);
        }

        // Generate suggestions
        const lines: string[] = [`# Fix Suggestions: ${trace.id}`, ""];

        // Timeout
        if (byCategory.has("timeout")) {
          const errors = byCategory.get("timeout")!;
          lines.push(`## Timeout Issues (${errors.length})`);
          lines.push("");
          for (const e of errors) {
            const duration =
              e.span.endTimeMs && e.span.startTimeMs ? e.span.endTimeMs - e.span.startTimeMs : 0;
            lines.push(`**${e.span.name}** (${duration}ms)`);
          }
          lines.push("");
          lines.push("**Suggested Fixes:**");
          lines.push("- Increase timeout threshold in your client configuration");
          lines.push("- Optimize the underlying query or operation to reduce latency");
          lines.push("- Add retry logic with exponential backoff");
          lines.push("- Consider breaking the operation into smaller chunks");
          lines.push("");
        }

        // Auth
        if (byCategory.has("auth")) {
          const errors = byCategory.get("auth")!;
          lines.push(`## Authentication Failures (${errors.length})`);
          lines.push("");
          for (const e of errors) {
            lines.push(`**${e.span.name}**`);
          }
          lines.push("");
          lines.push("**Suggested Fixes:**");
          lines.push("- Verify API key is set correctly in environment variables");
          lines.push("- Check that credentials haven't expired or been revoked");
          lines.push("- Ensure you have the necessary permissions for this operation");
          lines.push("- Confirm the API endpoint is correct for your key");
          lines.push("");
        }

        // Rate limit
        if (byCategory.has("rate_limit")) {
          const errors = byCategory.get("rate_limit")!;
          lines.push(`## Rate Limit Exceeded (${errors.length})`);
          lines.push("");
          for (const e of errors) {
            lines.push(`**${e.span.name}**`);
          }
          lines.push("");
          lines.push("**Suggested Fixes:**");
          lines.push("- Implement exponential backoff with jitter");
          lines.push("- Reduce request rate or batch operations");
          lines.push("- Upgrade your API plan for higher rate limits");
          lines.push("- Add request queuing to smooth traffic");
          lines.push("");
        }

        // Tool error
        if (byCategory.has("tool_error")) {
          const errors = byCategory.get("tool_error")!;
          lines.push(`## Tool Execution Errors (${errors.length})`);
          lines.push("");
          for (const e of errors) {
            lines.push(`**${e.span.name}**`);
          }
          lines.push("");
          lines.push("**Suggested Fixes:**");
          lines.push("- Verify tool configuration and parameters are correct");
          lines.push("- Check that the tool service is available and responsive");
          lines.push("- Inspect tool-specific logs for detailed error messages");
          lines.push("- Validate tool input schema and required fields");
          lines.push("");
        }

        // LLM error
        if (byCategory.has("llm_error")) {
          const errors = byCategory.get("llm_error")!;
          lines.push(`## LLM Call Failures (${errors.length})`);
          lines.push("");
          for (const e of errors) {
            lines.push(`**${e.span.name}**`);
          }
          lines.push("");
          lines.push("**Suggested Fixes:**");
          lines.push("- Check prompt length against model context window limits");
          lines.push("- Verify model name/identifier is correct and available");
          lines.push("- Confirm API quota hasn't been exceeded");
          lines.push("- Review model-specific error codes in LLM provider docs");
          lines.push("");
        }

        // Validation
        if (byCategory.has("validation")) {
          const errors = byCategory.get("validation")!;
          lines.push(`## Validation Errors (${errors.length})`);
          lines.push("");
          for (const e of errors) {
            lines.push(`**${e.span.name}**`);
          }
          lines.push("");
          lines.push("**Suggested Fixes:**");
          lines.push("- Review input schema and ensure all required fields are provided");
          lines.push("- Verify data types match the expected schema");
          lines.push("- Check for null/undefined values in required fields");
          lines.push("- Inspect detailed error messages for specific validation failures");
          lines.push("");
        }

        // Unknown
        if (byCategory.has("unknown")) {
          const errors = byCategory.get("unknown")!;
          lines.push(`## Other Errors (${errors.length})`);
          lines.push("");
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
          lines.push("");
          lines.push("**Suggested Fixes:**");
          lines.push("- Inspect error events and attributes for more context");
          lines.push("- Check application logs for additional error details");
          lines.push("- Use `foxhound_explain_failure` for detailed error chain analysis");
          lines.push("");
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Error fetching trace "${params.trace_id}": ${msg}`,
            },
          ],
        };
      }
    },
  );

  // --- Tool: score trace ---
  server.tool(
    "foxhound_score_trace",
    "Create a score for a trace or specific span. Scores can be numeric values (0-1) or categorical labels. Preview mode shows what will be created; set confirm=true to execute.",
    {
      trace_id: z.string().describe("The trace ID to score"),
      span_id: z.string().optional().describe("Optional span ID to score (if omitted, scores the entire trace)"),
      name: z.string().describe("Score name (e.g., 'quality', 'accuracy', 'latency')"),
      value: z.number().min(0).max(1).optional().describe("Numeric score value between 0 and 1 (mutually exclusive with label)"),
      label: z.string().optional().describe("Categorical label (e.g., 'good', 'bad', 'excellent') (mutually exclusive with value)"),
      comment: z.string().optional().describe("Optional comment explaining the score"),
      confirm: z.boolean().optional().describe("Set to true to execute the score creation; omit or set to false for preview"),
    },
    async (params) => {
      try {
        // Preview mode
        if (params.confirm !== true) {
          const lines: string[] = [
            `# Score Preview`,
            "",
            `**This will create the following score:**`,
            "",
            `- Trace ID: ${params.trace_id}`,
          ];

          if (params.span_id) {
            lines.push(`- Span ID: ${params.span_id}`);
          }

          lines.push(`- Name: ${params.name}`);

          if (params.value !== undefined) {
            lines.push(`- Value: ${params.value}`);
          }

          if (params.label !== undefined) {
            lines.push(`- Label: ${params.label}`);
          }

          if (params.comment) {
            lines.push(`- Comment: ${params.comment}`);
          }

          lines.push(`- Source: manual`);
          lines.push("");
          lines.push("**To execute, re-run with `confirm: true`**");

          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        // Execute mode
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

        if (score.spanId) {
          lines.push(`- Span: ${score.spanId}`);
        }

        lines.push(`- Name: ${score.name}`);

        if (score.value !== undefined) {
          lines.push(`- Value: ${score.value}`);
        }

        if (score.label !== undefined) {
          lines.push(`- Label: ${score.label}`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Error creating score for trace "${params.trace_id}": ${msg}`,
            },
          ],
        };
      }
    },
  );

  // --- Tool: get trace scores ---
  server.tool(
    "foxhound_get_trace_scores",
    "Retrieve all scores attached to a trace, including both trace-level and span-level scores.",
    {
      trace_id: z.string().describe("The trace ID to fetch scores for"),
    },
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
          const valueLabel = score.value !== undefined ? score.value.toString() : (score.label ?? "—");
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
            {
              type: "text",
              text: `Error fetching scores for trace "${params.trace_id}": ${msg}`,
            },
          ],
        };
      }
    },
  );

  // --- Tool: list evaluators ---
  server.tool(
    "foxhound_list_evaluators",
    "List all configured LLM-as-a-Judge evaluators with their settings.",
    {},
    async () => {
      try {
        const response = await api.listEvaluators();

        if (!response.data.length) {
          return {
            content: [
              {
                type: "text",
                text: "No evaluators configured.",
              },
            ],
          };
        }

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
        return {
          content: [
            {
              type: "text",
              text: `Error listing evaluators: ${msg}`,
            },
          ],
        };
      }
    },
  );

  // --- Tool: run evaluator ---
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

        for (const run of response.runs) {
          lines.push(`- **${run.id}** → trace: ${run.traceId} | status: ${run.status}`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Error triggering evaluator runs: ${msg}`,
            },
          ],
        };
      }
    },
  );

  // --- Tool: get evaluator run ---
  server.tool(
    "foxhound_get_evaluator_run",
    "Check the status and results of an async evaluator run.",
    {
      run_id: z.string().describe("The evaluator run ID to retrieve"),
    },
    async (params) => {
      try {
        const run = await api.getEvaluatorRun(params.run_id);

        const lines: string[] = [
          `## Evaluator Run: ${run.id}`,
          "",
          `- **Evaluator ID**: ${run.evaluatorId}`,
          `- **Trace ID**: ${run.traceId}`,
        ];

        // Format status with emoji
        let statusLine = "- **Status**: ";
        if (run.status === "pending" || run.status === "running") {
          statusLine += `⏳ ${run.status}`;
        } else if (run.status === "completed") {
          statusLine += "✅ completed";
        } else if (run.status === "failed") {
          statusLine += "❌ failed";
        } else {
          statusLine += run.status;
        }
        lines.push(statusLine);

        if (run.scoreId) {
          lines.push(`- **Score ID**: ${run.scoreId}`);
        }

        if (run.error) {
          lines.push(`- **Error**: ${run.error}`);
        }

        lines.push(`- **Created At**: ${run.createdAt}`);

        if (run.completedAt) {
          lines.push(`- **Completed At**: ${run.completedAt}`);
        }

        // Add score details if completed
        if (run.status === "completed" && run.scoreId) {
          lines.push("");
          lines.push("ℹ️ Use `foxhound_get_trace_scores` to view the score details.");
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Error fetching evaluator run "${params.run_id}": ${msg}`,
            },
          ],
        };
      }
    },
  );

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
