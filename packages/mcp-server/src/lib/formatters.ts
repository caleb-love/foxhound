import type { Trace, Span } from "@foxhound/types";
import type { TraceListResponse } from "@foxhound/api-client";

export function formatTraceList(result: TraceListResponse): string {
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

export function formatTrace(trace: Trace): string {
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

export function extractTraceInput(trace: Trace): Record<string, unknown> {
  const rootSpans = trace.spans.filter((s) => !s.parentSpanId);
  if (rootSpans.length > 0) {
    const rootSpan = rootSpans[0];
    if (!rootSpan) return {};
    return (rootSpan.attributes ?? {}) as Record<string, unknown>;
  }
  return (trace.metadata ?? {}) as Record<string, unknown>;
}
