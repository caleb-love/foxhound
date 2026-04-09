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

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
