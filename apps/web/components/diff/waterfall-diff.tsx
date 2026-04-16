'use client';

import { useMemo } from 'react';
import type { Trace, Span } from '@foxhound/types';

interface WaterfallDiffProps {
  traceA: Trace;
  traceB: Trace;
  spanDiff: {
    added: Span[];
    removed: Span[];
    modified: Span[];
    unchanged: Span[];
  };
}

type DiffKind = 'matched' | 'modified' | 'added' | 'removed';

interface AlignedRow {
  spanA: Span | null;
  spanB: Span | null;
  diffKind: DiffKind;
  fingerprint: string;
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

export function WaterfallDiff({ traceA, traceB, spanDiff }: WaterfallDiffProps) {
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
        });
      }
    }

    return rows;
  }, [traceA, traceB, spanDiff]);

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
        className="flex items-center justify-between border-b px-4 py-2.5"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
      >
        <h3 className="text-sm font-semibold text-tenant-text-primary">Waterfall diff</h3>
        <div className="flex items-center gap-3 text-[10px] text-tenant-text-muted">
          {(['added', 'removed', 'modified', 'matched'] as DiffKind[]).map((kind) => (
            <div key={kind} className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-sm" style={{ background: DIFF_CONFIG[kind].color }} />
              <span>{DIFF_CONFIG[kind].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div
        className="grid items-end border-b px-3 py-1.5"
        style={{
          gridTemplateColumns: 'minmax(160px, 200px) 60px 1fr 1fr',
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
        {alignedRows.map((row) => {
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
          const isError = (row.spanA?.status === 'error') || (row.spanB?.status === 'error');

          return (
            <div
              key={row.fingerprint}
              className="grid items-center px-3 py-1.5"
              style={{
                gridTemplateColumns: 'minmax(160px, 200px) 60px 1fr 1fr',
                background: config.bg,
                borderLeft: `3px solid ${config.color}`,
              }}
            >
              {/* Span name */}
              <div className="flex min-w-0 items-center gap-1.5">
                <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: isError ? 'var(--tenant-danger)' : accentColor }} />
                <span className="truncate text-[12px] font-medium text-tenant-text-primary">{span.name}</span>
              </div>

              {/* Diff badge */}
              <div className="text-center">
                {row.diffKind !== 'matched' ? (
                  <span
                    className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                    style={{ background: `color-mix(in srgb, ${config.color} 14%, var(--card))`, color: config.color }}
                  >
                    {config.label}
                  </span>
                ) : null}
              </div>

              {/* A bar */}
              <div className="relative mx-1 h-5">
                {row.spanA ? (
                  <div
                    className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded"
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
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-mono text-tenant-text-muted"
                  >
                    {formatDuration(durationA)}
                  </span>
                ) : null}
              </div>

              {/* B bar */}
              <div className="relative mx-1 h-5">
                {row.spanB ? (
                  <div
                    className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded"
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
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-mono text-tenant-text-muted"
                  >
                    {formatDuration(durationB)}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div
        className="flex flex-wrap items-center gap-4 border-t px-4 py-2 text-[11px] text-tenant-text-muted"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
      >
        <span>{spanDiff.unchanged.length + spanDiff.modified.length} matched</span>
        <span>{spanDiff.modified.length} changed</span>
        <span>{spanDiff.added.length} added in B</span>
        <span>{spanDiff.removed.length} removed from A</span>
      </div>
    </div>
  );
}
