'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Trace, Span } from '@foxhound/types';
import { AlertCircle, ChevronDown, Filter } from 'lucide-react';

interface WaterfallDiffProps {
  traceA: Trace;
  traceB: Trace;
  spanDiff: {
    added: Span[];
    removed: Span[];
    modified: Span[];
    unchanged: Span[];
  };
  highlightedSpanName?: string | null;
  rowFilter?: RowFilter;
  onRowFilterChange?: (filter: RowFilter) => void;
  expandedFingerprint?: string | null;
  onExpandedFingerprintChange?: (fingerprint: string | null) => void;
  onClearInvestigation?: () => void;
}

type DiffKind = 'matched' | 'modified' | 'added' | 'removed';
type RowFilter = 'all' | 'changes' | 'errors';

interface AlignedRow {
  spanA: Span | null;
  spanB: Span | null;
  diffKind: DiffKind;
  fingerprint: string;
  hasError: boolean;
}

function getSpanCost(span: Span | null): number {
  return span && typeof span.attributes.cost === 'number' ? span.attributes.cost : 0;
}

function formatDurationDelta(ms: number): string {
  if (ms === 0) return '0ms';
  const prefix = ms > 0 ? '+' : '-';
  return `${prefix}${formatDuration(Math.abs(ms))}`;
}

function formatCostDelta(cost: number): string {
  if (cost === 0) return '$0.0000';
  const prefix = cost > 0 ? '+' : '-';
  return `${prefix}$${Math.abs(cost).toFixed(4)}`;
}

function getSpanFingerprint(trace: Trace, span: Span): string {
  let occurrence = 0;
  for (const candidate of trace.spans) {
    if (candidate.kind === span.kind && candidate.name === span.name) {
      occurrence += 1;
    }
    if (candidate.spanId === span.spanId) {
      return `${span.kind}:${span.name}:${occurrence}`;
    }
  }
  return `${span.kind}:${span.name}:1`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getDeltaTone(value: number): 'positive' | 'negative' | 'neutral' {
  if (value === 0) return 'neutral';
  return value < 0 ? 'positive' : 'negative';
}

const DELTA_TONE_STYLES: Record<'positive' | 'negative' | 'neutral', { text: string; bg: string; border: string }> = {
  positive: {
    text: 'var(--tenant-success)',
    bg: 'color-mix(in srgb, var(--tenant-success) 10%, var(--card))',
    border: 'color-mix(in srgb, var(--tenant-success) 24%, var(--tenant-panel-stroke))',
  },
  negative: {
    text: 'var(--tenant-danger)',
    bg: 'color-mix(in srgb, var(--tenant-danger) 10%, var(--card))',
    border: 'color-mix(in srgb, var(--tenant-danger) 24%, var(--tenant-panel-stroke))',
  },
  neutral: {
    text: 'var(--tenant-text-secondary)',
    bg: 'color-mix(in srgb, var(--tenant-panel-stroke) 16%, var(--card))',
    border: 'color-mix(in srgb, var(--tenant-panel-stroke) 40%, transparent)',
  },
};

const SPAN_KIND_COLORS: Record<string, string> = {
  llm_call: 'var(--tenant-accent)',
  tool_call: 'var(--tenant-success)',
  agent_step: 'color-mix(in srgb, var(--tenant-accent) 72%, var(--tenant-text-secondary))',
  workflow: 'color-mix(in srgb, var(--tenant-accent) 50%, var(--tenant-text-muted))',
  custom: 'var(--tenant-text-muted)',
};

const DIFF_CONFIG: Record<DiffKind, { label: string; color: string; bg: string; border: string }> = {
  matched: {
    label: 'Matched',
    color: 'var(--tenant-text-muted)',
    bg: 'transparent',
    border: 'transparent',
  },
  modified: {
    label: 'Changed',
    color: 'var(--tenant-accent)',
    bg: 'color-mix(in srgb, var(--tenant-accent) 6%, transparent)',
    border: 'color-mix(in srgb, var(--tenant-accent) 20%, var(--tenant-panel-stroke))',
  },
  added: {
    label: 'Added',
    color: 'var(--tenant-success)',
    bg: 'color-mix(in srgb, var(--tenant-success) 6%, transparent)',
    border: 'color-mix(in srgb, var(--tenant-success) 20%, var(--tenant-panel-stroke))',
  },
  removed: {
    label: 'Removed',
    color: 'var(--tenant-danger)',
    bg: 'color-mix(in srgb, var(--tenant-danger) 6%, transparent)',
    border: 'color-mix(in srgb, var(--tenant-danger) 20%, var(--tenant-panel-stroke))',
  },
};

export function WaterfallDiff({
  traceA,
  traceB,
  spanDiff,
  highlightedSpanName = null,
  rowFilter = 'all',
  onRowFilterChange,
  expandedFingerprint = null,
  onExpandedFingerprintChange,
  onClearInvestigation,
}: WaterfallDiffProps) {
  // Build aligned rows
  const alignedRows = useMemo((): AlignedRow[] => {
    const spansAByFp = new Map<string, Span>();
    const spansBByFp = new Map<string, Span>();
    traceA.spans.forEach((span) => spansAByFp.set(getSpanFingerprint(traceA, span), span));
    traceB.spans.forEach((span) => spansBByFp.set(getSpanFingerprint(traceB, span), span));

    const seen = new Set<string>();
    const rows: AlignedRow[] = [];

    // Walk A spans in order, match with B
    const sortedA = [...traceA.spans].sort((a, b) => a.startTimeMs - b.startTimeMs);
    for (const spanA of sortedA) {
      const fp = getSpanFingerprint(traceA, spanA);
      seen.add(fp);
      const spanB = spansBByFp.get(fp) ?? null;

      const isModified = spanDiff.modified.some((s) => s.spanId === (spanB?.spanId ?? ''));
      const isRemoved = !spanB;

      rows.push({
        spanA,
        spanB,
        fingerprint: fp,
        diffKind: isRemoved ? 'removed' : isModified ? 'modified' : 'matched',
        hasError: (spanA?.status === 'error') || (spanB?.status === 'error'),
      });
    }

    // Add spans only in B (added)
    const sortedB = [...traceB.spans].sort((a, b) => a.startTimeMs - b.startTimeMs);
    for (const spanB of sortedB) {
      const fp = getSpanFingerprint(traceB, spanB);
      if (!seen.has(fp)) {
        rows.push({
          spanA: null,
          spanB,
          fingerprint: fp,
          diffKind: 'added',
          hasError: spanB.status === 'error',
        });
      }
    }

    return rows;
  }, [traceA, traceB, spanDiff]);

  const highlightedRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlightedSpanName && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedSpanName, rowFilter]);

  const visibleRows = useMemo(() => {
    if (rowFilter === 'changes') {
      return alignedRows.filter((row) => row.diffKind !== 'matched');
    }

    if (rowFilter === 'errors') {
      return alignedRows.filter((row) => row.hasError);
    }

    return alignedRows;
  }, [alignedRows, rowFilter]);

  const changedCount = alignedRows.filter((row) => row.diffKind !== 'matched').length;
  const errorCount = alignedRows.filter((row) => row.hasError).length;

  // Time bounds for bars (use union of both traces)
  const globalMin = Math.min(traceA.startTimeMs, traceB.startTimeMs);
  const globalMax = Math.max(
    traceA.endTimeMs ?? traceA.startTimeMs,
    traceB.endTimeMs ?? traceB.startTimeMs,
  );
  const totalDuration = globalMax - globalMin || 1;

  if (traceA.spans.length === 0 && traceB.spans.length === 0) {
    return (
      <div
        className="rounded-[var(--tenant-radius-panel)] border p-8 text-center text-sm text-tenant-text-muted"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}
      >
        No spans available to compare.
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-[var(--tenant-radius-panel)] border"
      style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}
    >
      {/* Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
      >
        <div>
          <h3 className="text-sm font-semibold text-tenant-text-primary">Waterfall diff</h3>
          <p className="text-xs text-tenant-text-muted">Aligned span timeline for baseline versus comparison.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-tenant-text-muted">
          <div className="mr-1 flex items-center gap-1.5 rounded-full border px-1.5 py-1" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
            <Filter className="h-3 w-3" />
            {([
              { key: 'all', label: 'All', count: alignedRows.length },
              { key: 'changes', label: 'Changed', count: changedCount },
              { key: 'errors', label: 'Errors', count: errorCount },
            ] as const).map((option) => (
              <button
                key={option.key}
                type="button"
                className="rounded-full px-2 py-0.5 transition-colors"
                style={{
                  background: rowFilter === option.key ? 'color-mix(in srgb, var(--tenant-accent) 14%, var(--card))' : 'transparent',
                  color: rowFilter === option.key ? 'var(--tenant-text-primary)' : 'var(--tenant-text-muted)',
                }}
                onClick={() => onRowFilterChange?.(option.key)}
              >
                {option.label} ({option.count})
              </button>
            ))}
          </div>
          {(highlightedSpanName || rowFilter !== 'all' || expandedFingerprint) && onClearInvestigation ? (
            <button
              type="button"
              className="rounded-full border px-2 py-1 text-[10px] font-medium transition-colors hover:bg-[color:color-mix(in_srgb,var(--tenant-accent)_8%,var(--card))]"
              style={{ borderColor: 'var(--tenant-panel-stroke)', color: 'var(--tenant-text-primary)' }}
              onClick={onClearInvestigation}
            >
              Reset view
            </button>
          ) : null}
          {(['added', 'removed', 'modified', 'matched'] as DiffKind[]).map((kind) => (
            <div key={kind} className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-sm" style={{ background: DIFF_CONFIG[kind].color }} />
              <span>{DIFF_CONFIG[kind].label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        {/* Column headers */}
        <div
          className="grid min-w-[840px] items-end border-b px-3 py-1.5"
          style={{
            gridTemplateColumns: 'minmax(180px, 220px) 72px minmax(220px,1fr) minmax(220px,1fr)',
            borderColor: 'var(--tenant-panel-stroke)',
            background: 'color-mix(in srgb, var(--card) 92%, var(--background))',
          }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Span</span>
          <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Status</span>
          <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">A (Baseline)</span>
          <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">B (Comparison)</span>
        </div>

        {/* Rows */}
        <div className="divide-y" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
          {visibleRows.map((row) => {
            const config = DIFF_CONFIG[row.diffKind];
            const span = row.spanB ?? row.spanA;
            if (!span) return null;

          const durationA = row.spanA?.endTimeMs ? row.spanA.endTimeMs - row.spanA.startTimeMs : 0;
          const durationB = row.spanB?.endTimeMs ? row.spanB.endTimeMs - row.spanB.startTimeMs : 0;
          const offsetA = row.spanA ? ((row.spanA.startTimeMs - globalMin) / totalDuration) * 100 : 0;
          const widthA = (durationA / totalDuration) * 100;
          const offsetB = row.spanB ? ((row.spanB.startTimeMs - globalMin) / totalDuration) * 100 : 0;
          const widthB = (durationB / totalDuration) * 100;
          const accentColor = SPAN_KIND_COLORS[span.kind] || SPAN_KIND_COLORS.custom;
          const isError = row.hasError;
          const isHighlighted = highlightedSpanName
            ? (row.spanA?.name === highlightedSpanName || row.spanB?.name === highlightedSpanName)
            : false;

          const isExpanded = expandedFingerprint === row.fingerprint;
          const costA = getSpanCost(row.spanA);
          const costB = getSpanCost(row.spanB);
          const durationDeltaMs = durationB - durationA;
          const costDelta = costB - costA;
          const durationTone = getDeltaTone(durationDeltaMs);
          const costTone = getDeltaTone(costDelta);

          return (
            <div
              key={row.fingerprint}
              ref={isHighlighted ? highlightedRowRef : null}
              className="min-w-[840px]"
            >
              <button
                type="button"
                className="grid w-full items-center px-3 py-1 text-left transition-colors"
                onClick={() => onExpandedFingerprintChange?.(isExpanded ? null : row.fingerprint)}
                style={{
                  gridTemplateColumns: 'minmax(180px, 220px) 72px minmax(220px,1fr) minmax(220px,1fr)',
                  background: isHighlighted
                    ? 'color-mix(in srgb, var(--tenant-accent) 10%, var(--card))'
                    : isExpanded
                      ? 'color-mix(in srgb, var(--tenant-accent) 6%, var(--card))'
                      : config.bg,
                  borderLeft: `3px solid ${isHighlighted ? 'var(--tenant-accent)' : config.color}`,
                  boxShadow: isHighlighted
                    ? 'inset 0 0 0 1px color-mix(in srgb, var(--tenant-accent) 28%, transparent)'
                    : isExpanded
                      ? 'inset 0 0 0 1px color-mix(in srgb, var(--tenant-accent) 18%, transparent)'
                      : 'none',
                }}
              >
                {/* Span name */}
                <div className="flex min-w-0 items-center gap-1.5 pr-2">
                  <ChevronDown
                    className="h-3 w-3 shrink-0 transition-transform"
                    style={{
                      color: 'var(--tenant-text-muted)',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                  <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: isError ? 'var(--tenant-danger)' : accentColor }} />
                  <span className="truncate text-[11px] font-medium leading-4 text-tenant-text-primary">{span.name}</span>
                </div>

                {/* Diff badge */}
                <div className="text-center">
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    {row.diffKind !== 'matched' ? (
                      <span
                        className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none"
                        style={{ background: `color-mix(in srgb, ${config.color} 14%, var(--card))`, color: config.color }}
                      >
                        {config.label}
                      </span>
                    ) : null}
                    {isError ? <AlertCircle className="h-3 w-3 text-[color:var(--tenant-danger)]" /> : null}
                    {row.diffKind !== 'matched' ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px] font-medium leading-none"
                          style={{
                            background: DELTA_TONE_STYLES[durationTone].bg,
                            color: DELTA_TONE_STYLES[durationTone].text,
                            border: `1px solid ${DELTA_TONE_STYLES[durationTone].border}`,
                          }}
                        >
                          {formatDurationDelta(durationDeltaMs)}
                        </span>
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px] font-medium leading-none"
                          style={{
                            background: DELTA_TONE_STYLES[costTone].bg,
                            color: DELTA_TONE_STYLES[costTone].text,
                            border: `1px solid ${DELTA_TONE_STYLES[costTone].border}`,
                          }}
                        >
                          {formatCostDelta(costDelta)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* A bar */}
                <div className="relative mx-1 h-4.5 min-w-0">
                  {row.spanA ? (
                    <div
                      className="absolute top-1/2 h-3 -translate-y-1/2 rounded"
                      style={{
                        left: `${offsetA}%`,
                        width: `max(${Math.max(widthA, 0.5)}%, 4px)`,
                        background: row.diffKind === 'removed'
                          ? `linear-gradient(90deg, ${config.color}, color-mix(in srgb, ${config.color} 60%, var(--card)))`
                          : `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 64%, var(--card)), color-mix(in srgb, ${accentColor} 40%, var(--card)))`,
                        borderRadius: 'var(--tenant-radius-control-tight, 3px)',
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-tenant-text-muted">--</div>
                  )}
                  {row.spanA ? (
                    <span
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-mono text-tenant-text-muted"
                    >
                      {formatDuration(durationA)}
                    </span>
                  ) : null}
                </div>

                {/* B bar */}
                <div className="relative mx-1 h-4.5 min-w-0">
                  {row.spanB ? (
                    <div
                      className="absolute top-1/2 h-3 -translate-y-1/2 rounded"
                      style={{
                        left: `${offsetB}%`,
                        width: `max(${Math.max(widthB, 0.5)}%, 4px)`,
                        background: row.diffKind === 'added'
                          ? `linear-gradient(90deg, ${config.color}, color-mix(in srgb, ${config.color} 60%, var(--card)))`
                          : row.diffKind === 'modified'
                            ? `linear-gradient(90deg, ${config.color}, color-mix(in srgb, ${config.color} 60%, var(--card)))`
                            : `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 64%, var(--card)), color-mix(in srgb, ${accentColor} 40%, var(--card)))`,
                        borderRadius: 'var(--tenant-radius-control-tight, 3px)',
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-tenant-text-muted">--</div>
                  )}
                  {row.spanB ? (
                    <span
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-mono text-tenant-text-muted"
                    >
                      {formatDuration(durationB)}
                    </span>
                  ) : null}
                </div>
              </button>

              {isExpanded ? (
                <div
                  className="grid gap-2 border-l px-4 py-3 text-xs"
                  style={{
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    borderColor: isHighlighted ? 'var(--tenant-accent)' : config.color,
                    background: 'color-mix(in srgb, var(--card) 94%, var(--background))',
                  }}
                >
                  <div
                    className="rounded-[var(--tenant-radius-panel-tight)] border px-3 py-2"
                    style={{
                      background: DELTA_TONE_STYLES[durationTone].bg,
                      borderColor: DELTA_TONE_STYLES[durationTone].border,
                    }}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Duration delta</div>
                    <div className="mt-1 text-sm font-medium" style={{ color: DELTA_TONE_STYLES[durationTone].text }}>
                      {durationDeltaMs === 0 ? 'No change' : `${durationDeltaMs > 0 ? '+' : '-'}${formatDuration(Math.abs(durationDeltaMs))}`}
                    </div>
                  </div>
                  <div
                    className="rounded-[var(--tenant-radius-panel-tight)] border px-3 py-2"
                    style={{
                      background: DELTA_TONE_STYLES[costTone].bg,
                      borderColor: DELTA_TONE_STYLES[costTone].border,
                    }}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Cost delta</div>
                    <div className="mt-1 text-sm font-medium" style={{ color: DELTA_TONE_STYLES[costTone].text }}>
                      {costDelta === 0 ? 'No change' : `${costDelta > 0 ? '+' : '-'}$${Math.abs(costDelta).toFixed(4)}`}
                    </div>
                  </div>
                  <div className="rounded-[var(--tenant-radius-panel-tight)] border px-3 py-2" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Status</div>
                    <div className="mt-1 text-sm font-medium text-tenant-text-primary">
                      {(row.spanA?.status ?? '--')} → {(row.spanB?.status ?? '--')}
                    </div>
                  </div>
                  <div className="rounded-[var(--tenant-radius-panel-tight)] border px-3 py-2" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Evidence</div>
                    <div className="mt-1 text-sm font-medium text-tenant-text-primary">
                      A: ${costA.toFixed(4)} · B: ${costB.toFixed(4)}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
          })}
          {visibleRows.length === 0 ? (
            <div className="flex min-w-[840px] items-center justify-center px-4 py-6 text-sm text-tenant-text-muted">
              No spans match the current filter.
            </div>
          ) : null}
        </div>
      </div>

      {/* Summary footer */}
      <div
        className="flex flex-wrap items-center gap-3 border-t px-4 py-1.5 text-[10px] text-tenant-text-muted"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
      >
        <span>{visibleRows.length} visible</span>
        <span>{spanDiff.unchanged.length + spanDiff.modified.length} matched</span>
        <span>{spanDiff.modified.length} changed</span>
        <span>{spanDiff.added.length} added in B</span>
        <span>{spanDiff.removed.length} removed from A</span>
      </div>
    </div>
  );
}
