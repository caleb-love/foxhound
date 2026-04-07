import { listTraces, traceDurationMs, type TraceRow } from "@/lib/api";

export const dynamic = "force-dynamic";

function formatTs(msStr: string): string {
  const d = new Date(Number(msStr));
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function statusBadge(row: TraceRow) {
  // A trace is "error" if any span has status "error"
  const spans = row.spans as Array<{ status: string }>;
  const hasError = spans.some((s) => s.status === "error");
  return hasError ? (
    <span style={{ color: "var(--red)", fontWeight: 600 }}>error</span>
  ) : (
    <span style={{ color: "var(--green)", fontWeight: 600 }}>ok</span>
  );
}

export default async function TracesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; agentId?: string }>;
}) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams?.page ?? "1");
  const agentId = resolvedParams?.agentId;

  let data: TraceRow[] = [];
  let error: string | null = null;

  try {
    const res = await listTraces({ page, ...(agentId ? { agentId } : {}), limit: 50 });
    data = res.data;
  } catch (e) {
    error = String(e);
  }

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Traces</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Execution traces from your instrumented LangGraph agents
          </p>
        </div>
        <a
          href="/runs/diff"
          style={{
            flexShrink: 0,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--accent)",
            padding: "7px 14px",
            border: "1px solid rgba(107,122,255,0.35)",
            borderRadius: 6,
            background: "rgba(107,122,255,0.06)",
            marginTop: 2,
          }}
        >
          Compare runs →
        </a>
      </div>

      {error && (
        <div
          style={{
            background: "#1f0f0f",
            border: "1px solid var(--red)",
            borderRadius: 8,
            padding: "16px 20px",
            marginBottom: 24,
            color: "var(--red)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
          }}
        >
          {error}
          <div style={{ marginTop: 8, color: "var(--text-muted)" }}>
            Make sure the Foxhound API is running and FOXHOUND_API_URL is set correctly.
          </div>
        </div>
      )}

      {data.length === 0 && !error ? (
        <EmptyState />
      ) : (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "var(--surface-2)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {["Trace ID", "Agent", "Started", "Duration", "Spans", "Status"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      letterSpacing: "0.4px",
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={row.id}
                  className="row-hover"
                  style={{
                    borderBottom:
                      i < data.length - 1 ? "1px solid var(--border)" : "none",
                    cursor: "pointer",
                  }}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <a
                      href={`/traces/${row.id}`}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "var(--accent)",
                      }}
                    >
                      {row.id.slice(0, 8)}…
                    </a>
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--text)",
                    }}
                  >
                    {row.agentId}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "var(--text-muted)",
                      fontSize: 12,
                    }}
                  >
                    {formatTs(row.startTimeMs)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "var(--text)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                  >
                    {formatDuration(traceDurationMs(row))}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "var(--text-muted)",
                      fontSize: 12,
                    }}
                  >
                    {(row.spans as unknown[]).length}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12 }}>
                    {statusBadge(row)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {page > 1 && (
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                gap: 8,
              }}
            >
              <a
                href={`/traces?page=${page - 1}${agentId ? `&agentId=${agentId}` : ""}`}
                style={{
                  padding: "6px 12px",
                  background: "var(--surface-2)",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "var(--text)",
                }}
              >
                ← Previous
              </a>
              {data.length === 50 && (
                <a
                  href={`/traces?page=${page + 1}${agentId ? `&agentId=${agentId}` : ""}`}
                  style={{
                    padding: "6px 12px",
                    background: "var(--surface-2)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "var(--text)",
                  }}
                >
                  Next →
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "80px 24px",
        color: "var(--text-muted)",
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>
        No traces yet
      </h2>
      <p style={{ fontSize: 13, maxWidth: 440, margin: "0 auto" }}>
        Instrument your LangGraph agent with the Fox SDK and run it to see traces here.
      </p>
      <pre
        style={{
          marginTop: 24,
          textAlign: "left",
          display: "inline-block",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "16px 20px",
          fontSize: 12,
          color: "var(--text)",
          lineHeight: 1.8,
        }}
      >
        {`from foxhound_sdk import FoxhoundClient
from foxhound_sdk.integrations.langgraph import FoxCallbackHandler

fox = FoxhoundClient(api_key="foxhound_...", endpoint="http://localhost:4000")
handler = FoxCallbackHandler.from_client(fox, agent_id="my-agent")
result = await graph.ainvoke(state, config={"callbacks": [handler]})
await handler.flush()`}
      </pre>
    </div>
  );
}
