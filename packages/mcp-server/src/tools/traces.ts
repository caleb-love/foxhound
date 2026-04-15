import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { toEpochMs, type FoxhoundApiClient } from "@foxhound/api-client";
import type { Span } from "@foxhound/types";
import { formatTrace, formatTraceList } from "../lib/formatters.js";

export function registerTraceTools(server: McpServer, api: FoxhoundApiClient): void {
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

  server.tool(
    "foxhound_get_trace",
    "Get the full trace with its complete span tree. Use this to inspect what happened during an agent run.",
    { trace_id: z.string().describe("The trace ID to retrieve") },
    async (params) => {
      const data = await api.getTrace(params.trace_id);
      return { content: [{ type: "text", text: formatTrace(data) }] };
    },
  );

  server.tool(
    "foxhound_replay_span",
    "Reconstruct the full agent state at the moment a specific span began — including LLM context, tool inputs, and memory. Requires Pro plan.",
    {
      trace_id: z.string().describe("The trace ID containing the span"),
      span_id: z.string().describe("The span ID to replay"),
    },
    async (params) => {
      const data = await api.replaySpan(params.trace_id, params.span_id);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "foxhound_diff_runs",
    "Compare two agent runs side-by-side and surface divergence points. Useful for debugging regressions. Requires Pro plan.",
    {
      trace_id_a: z.string().describe("First trace/run ID"),
      trace_id_b: z.string().describe("Second trace/run ID"),
    },
    async (params) => {
      const data = await api.diffRuns(params.trace_id_a, params.trace_id_b);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "foxhound_get_anomalies",
    "Surface abnormal behavior such as spikes in latency or unusual tool usage.",
    {
      agent_name: z.string().describe("Agent ID/name to analyze"),
      hours: z.number().int().min(1).max(168).optional().describe("Lookback window in hours (default 24)"),
    },
    async (params) => {
      const hours = params.hours ?? 24;
      const toMs = Date.now();
      const fromMs = toMs - hours * 60 * 60 * 1000;
      const data = await api.searchTraces({ agentId: params.agent_name, from: fromMs, to: toMs, limit: 100 });

      if (!data.data.length) {
        return {
          content: [{ type: "text", text: `No traces found for agent "${params.agent_name}" in the last ${hours} hours.` }],
        };
      }

      const allSpans = data.data.flatMap((t) => t.spans ?? []);
      const errorSpans = allSpans.filter((s) => s.status === "error");
      const spanDurations = allSpans
        .filter((s) => s.endTimeMs && s.startTimeMs)
        .map((s) => ({ name: s.name, kind: s.kind, durationMs: (s.endTimeMs ?? 0) - s.startTimeMs }));

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
        for (const e of errorSpans) errorNames.set(e.name, (errorNames.get(e.name) ?? 0) + 1);
        for (const [name, count] of [...errorNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
          lines.push(`- **${name}**: ${count} errors`);
        }
        lines.push("");
      } else {
        lines.push("### Errors: None", "");
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
        lines.push("### Slow Outliers: None detected", "");
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool(
    "foxhound_explain_failure",
    "Analyze a failed trace and provide a detailed explanation of what went wrong, including the error chain, affected spans, and timing information.",
    { trace_id: z.string().describe("The trace ID to analyze") },
    async (params) => {
      try {
        const trace = await api.getTrace(params.trace_id);
        const errorSpans = trace.spans.filter((s) => s.status === "error");
        if (!errorSpans.length) {
          return { content: [{ type: "text", text: `# Trace ${trace.id}\n\nNo errors detected in this trace. All ${trace.spans.length} spans completed successfully.` }] };
        }

        const spanMap = new Map<string, Span>();
        for (const span of trace.spans) spanMap.set(span.spanId, span);

        const getParentChain = (span: Span): Span[] => {
          const chain: Span[] = [span];
          let current = span;
          while (current.parentSpanId) {
            const parent = spanMap.get(current.parentSpanId);
            if (!parent) break;
            chain.unshift(parent);
            current = parent;
          }
          return chain;
        };

        const firstError = errorSpans.reduce((earliest, current) =>
          current.startTimeMs < earliest.startTimeMs ? current : earliest,
        );
        const errorEvents = firstError.events.filter((e) => e.name === "error");
        const errorMessage = errorEvents.length > 0
          ? String(errorEvents[0]?.attributes["error.message"] ?? errorEvents[0]?.attributes["message"] ?? "Unknown error")
          : "Unknown error";
        const parentChain = getParentChain(firstError);

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

        for (let i = 0; i < parentChain.length; i++) {
          const span = parentChain[i];
          if (!span) continue;
          const isError = span.spanId === firstError.spanId;
          const prefix = "  ".repeat(i);
          const status = isError ? " ❌ **ERROR**" : "";
          const duration = span.endTimeMs && span.startTimeMs ? `${span.endTimeMs - span.startTimeMs}ms` : "?";
          lines.push(`${prefix}${i + 1}. [${span.kind}] **${span.name}** (${duration})${status}`);

          if (isError && errorEvents.length > 0) {
            const event = errorEvents[0];
            if (event) {
              lines.push(`${prefix}   **Error Details**:`);
              for (const [key, value] of Object.entries(event.attributes ?? {})) {
                if (value !== null && value !== undefined) lines.push(`${prefix}   - ${key}: ${JSON.stringify(value)}`);
              }
            }
          }

          const attrs = Object.entries(span.attributes ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== "");
          if (attrs.length > 0 && i < 3) {
            const attrStr = attrs.slice(0, 3).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
            lines.push(`${prefix}   Attributes: ${attrStr}${attrs.length > 3 ? ", ..." : ""}`);
          }
        }

        if (errorSpans.length > 1) {
          lines.push("", `## Other Errors (${errorSpans.length - 1})`);
          for (const span of errorSpans.slice(1)) {
            const duration = span.endTimeMs && span.startTimeMs ? `${span.endTimeMs - span.startTimeMs}ms` : "?";
            const events = span.events.filter((e) => e.name === "error");
            const msg = events.length > 0
              ? String(events[0]?.attributes["error.message"] ?? events[0]?.attributes["message"] ?? "Unknown")
              : "Unknown";
            lines.push(`- [${span.kind}] **${span.name}** (${duration}): ${msg}`);
          }
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error fetching trace "${params.trace_id}": ${msg}` }] };
      }
    },
  );
}
