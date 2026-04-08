"use client";

import { useState } from "react";
import type { Span } from "@foxhound/types";
import type { RunDiffResult, SpanDiff } from "@/lib/api";

// ---- Helpers ----------------------------------------------------------------

const KIND_COLORS: Record<string, string> = {
  workflow: "var(--purple)",
  agent_step: "var(--gray)",
  llm_call: "var(--blue)",
  tool_call: "var(--orange)",
  custom: "var(--text-muted)",
};

const KIND_LABELS: Record<string, string> = {
  workflow: "WORKFLOW",
  agent_step: "STEP",
  llm_call: "LLM",
  tool_call: "TOOL",
  custom: "CUSTOM",
};

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function spanDuration(span: Span): number {
  return span.endTimeMs ? span.endTimeMs - span.startTimeMs : 0;
}

// ---- Sub-components ---------------------------------------------------------

function KindBadge({ kind }: { kind: string }) {
  const color = KIND_COLORS[kind] ?? "var(--text-muted)";
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.6px",
        color,
        border: `1px solid ${color}`,
        borderRadius: 3,
        padding: "1px 5px",
        flexShrink: 0,
      }}
    >
      {KIND_LABELS[kind] ?? kind.toUpperCase()}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "ok" ? "var(--green)" : status === "error" ? "var(--red)" : "var(--text-muted)";
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

// ---- Row bg colours by diff kind -------------------------------------------

function rowBg(entry: SpanDiff, side: "A" | "B"): string {
  if (entry.kind === "added" && side === "B") return "rgba(61,214,140,0.07)";
  if (entry.kind === "removed" && side === "A") return "rgba(242,95,92,0.07)";
  if (entry.kind === "matched" && entry.diverged) return "rgba(245,158,11,0.07)";
  return "transparent";
}

function rowBorderLeft(entry: SpanDiff, side: "A" | "B"): string {
  if (entry.kind === "added" && side === "B") return "2px solid var(--green)";
  if (entry.kind === "removed" && side === "A") return "2px solid var(--red)";
  if (entry.kind === "matched" && entry.diverged) return "2px solid var(--orange)";
  return "2px solid transparent";
}

// ---- SpanCell ---------------------------------------------------------------

function SpanCell({
  span,
  entry,
  side,
  isSelected,
  onClick,
}: {
  span: Span | undefined;
  entry: SpanDiff;
  side: "A" | "B";
  isSelected: boolean;
  onClick: () => void;
}) {
  const bg = isSelected ? "rgba(107,122,255,0.1)" : rowBg(entry, side);
  const borderLeft = isSelected ? "2px solid var(--accent)" : rowBorderLeft(entry, side);

  if (!span) {
    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: 42,
          background: side === "A" ? "rgba(242,95,92,0.04)" : "rgba(61,214,140,0.04)",
          borderBottom: "1px solid rgba(42,42,58,0.5)",
          borderLeft,
        }}
      />
    );
  }

  const duration = spanDuration(span);

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        cursor: "pointer",
        background: bg,
        borderLeft,
        borderBottom: "1px solid rgba(42,42,58,0.5)",
        height: 42,
        overflow: "hidden",
      }}
    >
      <KindBadge kind={span.kind} />
      <span
        style={{
          flex: 1,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={span.name}
      >
        {span.name}
      </span>
      {duration > 0 && (
        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
          {fmtMs(duration)}
        </span>
      )}
      <StatusDot status={span.status} />
    </div>
  );
}

// ---- Tooltip / explanation --------------------------------------------------

function ExplanationBar({ entry }: { entry: SpanDiff | null }) {
  if (!entry || !entry.diverged || !entry.explanation) return null;

  return (
    <div
      style={{
        padding: "8px 16px",
        background: "rgba(245,158,11,0.08)",
        borderTop: "1px solid rgba(245,158,11,0.2)",
        fontSize: 12,
        color: "var(--orange)",
        fontFamily: "var(--font-mono)",
        flexShrink: 0,
      }}
    >
      <strong style={{ marginRight: 8 }}>Divergence:</strong>
      {entry.explanation}
      {entry.divergenceReasons.length > 0 && (
        <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
          [{entry.divergenceReasons.join(", ")}]
        </span>
      )}
    </div>
  );
}

// ---- Summary bar ------------------------------------------------------------

function SummaryBar({ diff }: { diff: RunDiffResult }) {
  return (
    <div
      style={{
        padding: "10px 20px",
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 20,
        fontSize: 12,
        flexShrink: 0,
        flexWrap: "wrap",
      }}
    >
      <span style={{ color: "var(--text-muted)" }}>{diff.summary}</span>
      <div style={{ display: "flex", gap: 16, marginLeft: "auto", flexShrink: 0 }}>
        <Stat label="Spans A" value={diff.totalSpansA} color="var(--blue)" />
        <Stat label="Spans B" value={diff.totalSpansB} color="var(--purple)" />
        <Stat
          label="Diverged"
          value={diff.divergenceCount}
          color={diff.divergenceCount > 0 ? "var(--orange)" : "var(--green)"}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

// ---- Column headers ---------------------------------------------------------

function PaneHeader({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        padding: "7px 12px",
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        color,
        position: "sticky",
        top: 0,
        zIndex: 1,
      }}
    >
      {label}
    </div>
  );
}

// ---- Main component ---------------------------------------------------------

export function RunDiffViewer({ diff }: { diff: RunDiffResult }) {
  const [selectedPos, setSelectedPos] = useState<number | null>(null);

  const selectedEntry = diff.alignedSpans.find((e) => e.position === selectedPos) ?? null;

  function select(pos: number) {
    setSelectedPos((prev) => (prev === pos ? null : pos));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <SummaryBar diff={diff} />

      {/* Split pane */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Run A column */}
        <div
          style={{
            flex: 1,
            borderRight: "1px solid var(--border)",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <PaneHeader label={`Run A — ${diff.traceIdA.slice(0, 12)}…`} color="var(--blue)" />
          {diff.alignedSpans.map((entry) => (
            <SpanCell
              key={entry.position}
              span={entry.spanA}
              entry={entry}
              side="A"
              isSelected={selectedPos === entry.position}
              onClick={() => select(entry.position)}
            />
          ))}
        </div>

        {/* Run B column */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <PaneHeader label={`Run B — ${diff.traceIdB.slice(0, 12)}…`} color="var(--purple)" />
          {diff.alignedSpans.map((entry) => (
            <SpanCell
              key={entry.position}
              span={entry.spanB}
              entry={entry}
              side="B"
              isSelected={selectedPos === entry.position}
              onClick={() => select(entry.position)}
            />
          ))}
        </div>
      </div>

      {/* Explanation bar pinned at bottom when a diverged row is selected */}
      <ExplanationBar entry={selectedEntry} />
    </div>
  );
}
