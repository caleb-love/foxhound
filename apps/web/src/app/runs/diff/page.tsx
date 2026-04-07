import { fetchRunDiff } from "@/lib/api";
import { RunDiffViewer } from "./RunDiffViewer";

export const dynamic = "force-dynamic";

export default async function RunDiffPage({
  searchParams,
}: {
  searchParams: Promise<{ runA?: string; runB?: string }>;
}) {
  const resolvedParams = await searchParams;
  const runA = resolvedParams?.runA?.trim() ?? "";
  const runB = resolvedParams?.runB?.trim() ?? "";

  if (!runA || !runB) {
    return <RunSelectionForm runA={runA} runB={runB} />;
  }

  let diff = null;
  let error: string | null = null;

  try {
    diff = await fetchRunDiff(runA, runB);
  } catch (e) {
    error = String(e);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <a
          href="/traces"
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ← Traces
        </a>
        <div style={{ width: 1, height: 14, background: "var(--border)" }} />
        <h1 style={{ fontSize: 14, fontWeight: 700 }}>Run Diff</h1>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
          <code
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--blue)",
              background: "rgba(96,165,250,0.1)",
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            {runA.slice(0, 12)}…
          </code>
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>vs</span>
          <code
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--purple)",
              background: "rgba(192,132,252,0.1)",
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            {runB.slice(0, 12)}…
          </code>
          <a
            href="/runs/diff"
            style={{
              marginLeft: 8,
              fontSize: 11,
              color: "var(--text-muted)",
              padding: "4px 10px",
              border: "1px solid var(--border)",
              borderRadius: 5,
            }}
          >
            New diff
          </a>
        </div>
      </div>

      {error ? (
        <div
          style={{
            margin: 32,
            background: "#1f0f0f",
            border: "1px solid var(--red)",
            borderRadius: 8,
            padding: "16px 20px",
            color: "var(--red)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : diff ? (
        <RunDiffViewer diff={diff} />
      ) : null}
    </div>
  );
}

function RunSelectionForm({ runA, runB }: { runA: string; runB: string }) {
  return (
    <div style={{ padding: "32px 24px", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <a
          href="/traces"
          style={{ fontSize: 12, color: "var(--text-muted)", display: "inline-block", marginBottom: 16 }}
        >
          ← Traces
        </a>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Compare Runs</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Enter two trace IDs to see a side-by-side diff of their spans.
        </p>
      </div>

      <form
        action="/runs/diff"
        method="get"
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: "var(--blue)",
            }}
          >
            Run A
          </span>
          <input
            name="runA"
            defaultValue={runA}
            placeholder="trace-id-1"
            autoFocus
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "10px 14px",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--text)",
              outline: "none",
              width: "100%",
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: "var(--purple)",
            }}
          >
            Run B
          </span>
          <input
            name="runB"
            defaultValue={runB}
            placeholder="trace-id-2"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "10px 14px",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--text)",
              outline: "none",
              width: "100%",
            }}
          />
        </label>

        <button
          type="submit"
          style={{
            marginTop: 4,
            padding: "10px 20px",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          Compare →
        </button>
      </form>
    </div>
  );
}
