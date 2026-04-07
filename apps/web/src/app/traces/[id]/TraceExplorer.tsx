"use client";

import { useState } from "react";
import type { Span, SpanEvent } from "@foxhound/types";
import type { TraceRow } from "@/lib/api";
import { usePlan } from "@/hooks/usePlan";
import { UpgradeBanner } from "@/components/UpgradeBanner";

interface TreeNode {
  span: Span;
  depth: number;
}

interface Props {
  trace: TraceRow;
  tree: TreeNode[];
  totalMs: number;
}

// ---- Span kind helpers -----------------------------------------------------

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

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function spanDuration(span: Span): number {
  return span.endTimeMs ? span.endTimeMs - span.startTimeMs : 0;
}

// ---- Timeline row ----------------------------------------------------------

function TimelineRow({
  node,
  isSelected,
  traceStartMs,
  totalMs,
  onClick,
}: {
  node: TreeNode;
  isSelected: boolean;
  traceStartMs: number;
  totalMs: number;
  onClick: () => void;
}) {
  const { span, depth } = node;
  const duration = spanDuration(span);
  const offsetPct = totalMs > 0 ? ((span.startTimeMs - traceStartMs) / totalMs) * 100 : 0;
  const widthPct = totalMs > 0 ? Math.max((duration / totalMs) * 100, 0.5) : 0;
  const kindColor = KIND_COLORS[span.kind] ?? "var(--text-muted)";

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 16px",
        cursor: "pointer",
        background: isSelected ? "rgba(107, 122, 255, 0.08)" : "transparent",
        borderLeft: isSelected ? "2px solid var(--accent)" : "2px solid transparent",
        borderBottom: "1px solid rgba(42, 42, 58, 0.5)",
        minWidth: 0,
      }}
    >
      {/* Indent + kind indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
          paddingLeft: depth * 16,
        }}
      >
        <div
          style={{
            width: 2,
            height: 14,
            background: kindColor,
            borderRadius: 1,
            flexShrink: 0,
          }}
        />
        <KindBadge kind={span.kind} />
      </div>

      {/* Name */}
      <span
        style={{
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          color: "var(--text)",
          flexShrink: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: "0 0 200px",
          maxWidth: 200,
        }}
        title={span.name}
      >
        {span.name}
      </span>

      {/* Gantt bar */}
      <div
        style={{
          flex: 1,
          height: 6,
          background: "var(--surface-2)",
          borderRadius: 3,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${offsetPct}%`,
            width: `${widthPct}%`,
            height: "100%",
            background: span.status === "error" ? "var(--red)" : kindColor,
            borderRadius: 3,
            opacity: 0.7,
          }}
        />
      </div>

      {/* Duration + status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          color: "var(--text-muted)",
          width: 80,
          justifyContent: "flex-end",
        }}
      >
        {duration > 0 && <span>{fmtMs(duration)}</span>}
        <StatusDot status={span.status} />
      </div>
    </div>
  );
}

// ---- Span detail panel -----------------------------------------------------

function AttributeTable({ attributes }: { attributes: Record<string, unknown> }) {
  const entries = Object.entries(attributes);
  if (entries.length === 0)
    return <p style={{ color: "var(--text-muted)", fontSize: 12 }}>No attributes</p>;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key} style={{ borderBottom: "1px solid var(--border)" }}>
            <td
              style={{
                padding: "6px 0",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-muted)",
                width: "40%",
                verticalAlign: "top",
                paddingRight: 12,
              }}
            >
              {key}
            </td>
            <td
              style={{
                padding: "6px 0",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text)",
                wordBreak: "break-all",
              }}
            >
              {String(value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SpanDetail({ span, traceStartMs }: { span: Span; traceStartMs: number }) {
  const duration = spanDuration(span);
  const relativeStart = span.startTimeMs - traceStartMs;

  // "Why did it do that?" — for LLM calls, reconstruct the call context
  const isLlmCall = span.kind === "llm_call";
  const attrs = span.attributes as Record<string, unknown>;

  return (
    <div style={{ padding: "20px 20px", overflowY: "auto", height: "100%" }}>
      {/* Span header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <KindBadge kind={span.kind} />
          <StatusDot status={span.status} />
        </div>
        <h2
          style={{
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            marginBottom: 8,
            wordBreak: "break-all",
          }}
        >
          {span.name}
        </h2>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
          <span>+{fmtMs(relativeStart)} from start</span>
          {duration > 0 && <span>took {fmtMs(duration)}</span>}
        </div>
        <code
          style={{
            display: "block",
            marginTop: 6,
            fontSize: 10,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {span.spanId}
        </code>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", marginBottom: 16 }} />

      {/* Attributes */}
      <section style={{ marginBottom: 20 }}>
        <h3
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Attributes
        </h3>
        <AttributeTable attributes={attrs} />
      </section>

      {/* Events */}
      {span.events.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h3
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-muted)",
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Events ({span.events.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {span.events.map((evt: SpanEvent, i: number) => (
              <div
                key={i}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      fontWeight: 600,
                      color: evt.name === "error" ? "var(--red)" : "var(--text)",
                    }}
                  >
                    {evt.name}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    +{fmtMs(evt.timeMs - traceStartMs)}
                  </span>
                </div>
                {Object.keys(evt.attributes).length > 0 && (
                  <AttributeTable attributes={evt.attributes as Record<string, unknown>} />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* "Why did it do that?" — context reconstruction for LLM calls */}
      {isLlmCall && (
        <section>
          <h3
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--accent)",
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>⟳</span> Why did it do that?
          </h3>
          <div
            style={{
              background: "rgba(107, 122, 255, 0.06)",
              border: "1px solid rgba(107, 122, 255, 0.2)",
              borderRadius: 8,
              padding: "14px 16px",
              fontSize: 12,
              color: "var(--text-muted)",
              lineHeight: 1.7,
            }}
          >
            <p style={{ marginBottom: 10 }}>
              This LLM call was made by{" "}
              <strong style={{ color: "var(--text)" }}>{span.name}</strong> at{" "}
              <strong style={{ color: "var(--text)" }}>+{fmtMs(relativeStart)}</strong> into the
              trace.
            </p>
            {"llm.model" in attrs && (
              <p style={{ marginBottom: 6 }}>
                Model:{" "}
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--blue)",
                    background: "rgba(96, 165, 250, 0.1)",
                    padding: "1px 4px",
                    borderRadius: 3,
                  }}
                >
                  {String(attrs["llm.model"])}
                </code>
              </p>
            )}
            {"llm.prompt_tokens" in attrs && (
              <p style={{ marginBottom: 6 }}>
                Tokens: {String(attrs["llm.prompt_tokens"])} prompt +{" "}
                {String(attrs["llm.completion_tokens"] ?? "?")} completion ={" "}
                {String(attrs["llm.total_tokens"] ?? "?")} total
              </p>
            )}
            {"llm.prompt_count" in attrs && (
              <p>
                Prompt messages:{" "}
                <strong style={{ color: "var(--text)" }}>
                  {String(attrs["llm.prompt_count"])}
                </strong>
              </p>
            )}
            {span.status === "error" && (
              <p style={{ color: "var(--red)", marginTop: 8 }}>
                This call failed. Check the error event above for details.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ---- Main component --------------------------------------------------------

export function TraceExplorer({ trace, tree, totalMs }: Props) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(tree[0]?.span.spanId ?? null);
  const [showReplayBanner, setShowReplayBanner] = useState(false);
  const { canReplay, loading: planLoading } = usePlan();

  const traceStartMs = Number(trace.startTimeMs);
  const selectedNode = tree.find((n) => n.span.spanId === selectedSpanId);

  function handleReplayClick() {
    if (canReplay) {
      // Replay not yet implemented — placeholder for future
      alert("Replay coming soon.");
    } else {
      setShowReplayBanner(true);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Replay banner (shown on demand for free users) */}
      {showReplayBanner && !planLoading && !canReplay && (
        <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)" }}>
          <UpgradeBanner
            feature="Replay"
            description="Replay is a Pro feature — step through agent execution frame-by-frame."
          />
        </div>
      )}

      {/* Replay toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "6px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleReplayClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            background: canReplay ? "rgba(107,122,255,0.1)" : "var(--surface-2)",
            border: `1px solid ${canReplay ? "rgba(107,122,255,0.35)" : "var(--border)"}`,
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            color: canReplay ? "var(--accent)" : "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <span>▶</span>
          Replay
          {!canReplay && !planLoading && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.5px",
                background: "rgba(107,122,255,0.15)",
                color: "var(--accent)",
                border: "1px solid rgba(107,122,255,0.3)",
                borderRadius: 3,
                padding: "1px 5px",
              }}
            >
              PRO
            </span>
          )}
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Timeline */}
        <div
          style={{
            width: "55%",
            borderRight: "1px solid var(--border)",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {/* Column headers */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              background: "var(--surface-2)",
              borderBottom: "1px solid var(--border)",
              fontSize: 10,
              fontWeight: 700,
              color: "var(--text-muted)",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              position: "sticky",
              top: 0,
              zIndex: 1,
            }}
          >
            <span style={{ flex: "0 0 220px" }}>Span</span>
            <span style={{ flex: 1 }}>
              Timeline ({totalMs < 1000 ? `${totalMs}ms` : `${(totalMs / 1000).toFixed(2)}s`})
            </span>
            <span style={{ width: 80, textAlign: "right" }}>Duration</span>
          </div>

          {tree.map((node) => (
            <TimelineRow
              key={node.span.spanId}
              node={node}
              isSelected={node.span.spanId === selectedSpanId}
              traceStartMs={traceStartMs}
              totalMs={totalMs}
              onClick={() => setSelectedSpanId(node.span.spanId)}
            />
          ))}
        </div>

        {/* Right: Span detail */}
        <div style={{ flex: 1, overflowY: "auto", background: "var(--surface)" }}>
          {selectedNode ? (
            <SpanDetail span={selectedNode.span} traceStartMs={traceStartMs} />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              Select a span to inspect it
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
