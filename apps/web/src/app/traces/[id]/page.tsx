import { notFound } from "next/navigation";
import { getTrace, buildSpanTree, traceDurationMs } from "@/lib/api";
import { TraceExplorer } from "./TraceExplorer";

export default async function TraceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trace = await getTrace(id);
  if (!trace) notFound();

  const tree = buildSpanTree(trace.spans);
  const durationMs = traceDurationMs(trace);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 48px)" }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <a href="/traces" style={{ color: "var(--text-muted)", fontSize: 13 }}>
          ← Traces
        </a>
        <div style={{ height: 16, width: 1, background: "var(--border)" }} />
        <code
          style={{
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)",
          }}
        >
          {trace.id}
        </code>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 12 }}>
          <span style={{ color: "var(--text-muted)" }}>
            Agent: <strong style={{ color: "var(--text)" }}>{trace.agentId}</strong>
          </span>
          <span style={{ color: "var(--text-muted)" }}>
            Duration:{" "}
            <strong style={{ color: "var(--text)" }}>
              {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(2)}s`}
            </strong>
          </span>
          <span style={{ color: "var(--text-muted)" }}>
            Spans: <strong style={{ color: "var(--text)" }}>{trace.spans.length}</strong>
          </span>
        </div>
      </div>

      <TraceExplorer trace={trace} tree={tree} totalMs={durationMs} />
    </div>
  );
}
