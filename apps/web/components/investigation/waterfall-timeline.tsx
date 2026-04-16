'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Span } from '@foxhound/types';
import { cn } from '@/lib/utils';

interface WaterfallTimelineProps {
  spans: Span[];
  selectedSpanId?: string | null;
  onSelectSpan?: (span: Span) => void;
  className?: string;
}

const SPAN_KIND_COLORS: Record<string, string> = {
  llm_call: 'var(--tenant-accent)',
  tool_call: 'var(--tenant-success)',
  agent_step: 'color-mix(in srgb, var(--tenant-accent) 72%, var(--tenant-text-secondary))',
  workflow: 'color-mix(in srgb, var(--tenant-accent) 50%, var(--tenant-text-muted))',
  custom: 'var(--tenant-text-muted)',
};

const SPAN_KIND_LABELS: Record<string, string> = {
  llm_call: 'LLM',
  tool_call: 'Tool',
  agent_step: 'Agent',
  workflow: 'Flow',
  custom: 'Custom',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function WaterfallTimeline({ spans, selectedSpanId, onSelectSpan, className }: WaterfallTimelineProps) {
  const [hoveredSpanId, setHoveredSpanId] = useState<string | null>(null);

  // Build parent lookup and compute tree depth
  const parentMap = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const span of spans) {
      map.set(span.spanId, span.parentSpanId);
    }
    return map;
  }, [spans]);

  const getDepth = useCallback((spanId: string): number => {
    let depth = 0;
    let current = parentMap.get(spanId);
    while (current) {
      depth++;
      current = parentMap.get(current);
      if (depth > 10) break;
    }
    return depth;
  }, [parentMap]);

  // Tree-order sort
  const sortedSpans = useMemo(() => {
    const childrenOf = new Map<string | undefined, Span[]>();
    for (const span of spans) {
      const key = span.parentSpanId ?? '__root__';
      const list = childrenOf.get(key) ?? [];
      list.push(span);
      childrenOf.set(key, list);
    }
    for (const list of childrenOf.values()) {
      list.sort((a, b) => a.startTimeMs - b.startTimeMs);
    }
    function walkTree(parentId: string | undefined): Span[] {
      const children = childrenOf.get(parentId ?? '__root__') ?? [];
      const result: Span[] = [];
      for (const child of children) {
        result.push(child);
        result.push(...walkTree(child.spanId));
      }
      return result;
    }
    return walkTree(undefined);
  }, [spans]);

  // Time bounds
  const minTime = useMemo(() => Math.min(...spans.map((s) => s.startTimeMs)), [spans]);
  const maxTime = useMemo(() => Math.max(...spans.map((s) => s.endTimeMs ?? s.startTimeMs)), [spans]);
  const totalDuration = maxTime - minTime || 1;

  // Critical path: the chain of spans that determines overall trace duration.
  // Walk from the span ending last, back through the parent that ended latest.
  const criticalPathIds = useMemo(() => {
    if (spans.length === 0) return new Set<string>();
    const ids = new Set<string>();
    // Find the span that ends latest
    let current: Span | undefined = spans.reduce((latest, s) =>
      (s.endTimeMs ?? 0) > (latest.endTimeMs ?? 0) ? s : latest
    , spans[0]!);
    while (current) {
      ids.add(current.spanId);
      const parentId: string | undefined = current.parentSpanId;
      if (!parentId) break;
      // Among siblings under the same parent, the critical path goes through
      // the one that ends latest (it's the bottleneck).
      current = spans.find((s: Span) => s.spanId === parentId);
    }
    return ids;
  }, [spans]);

  // Time axis ticks
  const tickCount = 5;
  const ticks = useMemo(() => {
    return Array.from({ length: tickCount + 1 }, (_, i) => {
      const ms = (totalDuration / tickCount) * i;
      return { label: formatDuration(ms), pct: (i / tickCount) * 100 };
    });
  }, [totalDuration]);

  if (spans.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-tenant-text-muted">
        No spans in this trace
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-[var(--tenant-radius-panel)] border', className)} style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
      {/* Column headers */}
      <div
        className="grid items-end border-b px-3 py-2"
        style={{
          gridTemplateColumns: 'minmax(180px, 260px) 1fr',
          borderColor: 'var(--tenant-panel-stroke)',
          background: 'color-mix(in srgb, var(--card) 88%, var(--background))',
        }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">
          Span
        </div>
        <div className="relative h-5">
          {ticks.map((tick) => (
            <span
              key={tick.pct}
              className="absolute top-0 text-[10px] font-mono text-tenant-text-muted"
              style={{ left: `${tick.pct}%`, transform: tick.pct === 100 ? 'translateX(-100%)' : tick.pct === 0 ? 'none' : 'translateX(-50%)' }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>

      {/* Span rows */}
      <div className="divide-y" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
        {sortedSpans.map((span) => {
          const depth = getDepth(span.spanId);
          const duration = span.endTimeMs ? span.endTimeMs - span.startTimeMs : 0;
          const offset = ((span.startTimeMs - minTime) / totalDuration) * 100;
          const width = (duration / totalDuration) * 100;
          const accentColor = SPAN_KIND_COLORS[span.kind] || SPAN_KIND_COLORS.custom;
          const isError = span.status === 'error';
          const isSelected = selectedSpanId === span.spanId;
          const isHovered = hoveredSpanId === span.spanId;
          const isCriticalPath = criticalPathIds.has(span.spanId);

          return (
            <button
              key={span.spanId}
              type="button"
              onClick={() => onSelectSpan?.(span)}
              onMouseEnter={() => setHoveredSpanId(span.spanId)}
              onMouseLeave={() => setHoveredSpanId(null)}
              className="grid w-full items-center text-left transition-colors duration-100"
              style={{
                gridTemplateColumns: 'minmax(180px, 260px) 1fr',
                padding: '6px 12px',
                background: isSelected
                  ? 'color-mix(in srgb, var(--tenant-accent) 10%, var(--card))'
                  : isHovered
                    ? 'color-mix(in srgb, var(--tenant-accent) 4%, var(--card))'
                    : 'transparent',
                borderLeft: isSelected ? `3px solid var(--tenant-accent)` : '3px solid transparent',
              }}
            >
              {/* Span label column */}
              <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: `${depth * 16}px` }}>
                {depth > 0 ? (
                  <svg width="12" height="16" viewBox="0 0 12 16" className="shrink-0" style={{ color: 'var(--tenant-panel-stroke)' }}>
                    <path d="M6 0 V8 H12" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                  </svg>
                ) : null}
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: isError ? 'var(--tenant-danger)' : accentColor,
                    boxShadow: isError ? '0 0 0 3px color-mix(in srgb, var(--tenant-danger) 18%, transparent)' : 'none',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium text-tenant-text-primary">{span.name}</span>
                    {isError ? (
                      <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase" style={{ background: 'color-mix(in srgb, var(--tenant-danger) 14%, var(--card))', color: 'var(--tenant-danger)' }}>err</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-tenant-text-muted">
                    <span>{SPAN_KIND_LABELS[span.kind] || span.kind}</span>
                    <span>·</span>
                    <span className="font-mono">{formatDuration(duration)}</span>
                  </div>
                </div>
              </div>

              {/* Waterfall bar column */}
              <div className="relative h-7">
                {/* Grid lines */}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--tenant-panel-stroke)_32%,transparent)_1px,transparent_1px)] bg-[length:20%_100%] opacity-40" />

                {/* The bar */}
                <div
                  className="absolute top-1/2 h-5 -translate-y-1/2 rounded transition-all duration-200"
                  style={{
                    left: `${offset}%`,
                    width: `max(${Math.max(width, 0.5)}%, 6px)`,
                    background: isError
                      ? `linear-gradient(90deg, var(--tenant-danger), color-mix(in srgb, var(--tenant-danger) 72%, var(--card)))`
                      : `linear-gradient(90deg, ${accentColor}, color-mix(in srgb, ${accentColor} 72%, var(--card)))`,
                    boxShadow: isSelected
                      ? `0 0 0 2px color-mix(in srgb, var(--tenant-accent) 32%, transparent), 0 4px 12px color-mix(in srgb, ${accentColor} 24%, transparent)`
                      : isError
                        ? `0 2px 8px color-mix(in srgb, var(--tenant-danger) 20%, transparent)`
                        : isCriticalPath
                          ? `0 0 0 1px color-mix(in srgb, var(--tenant-warning) 40%, transparent), 0 3px 10px color-mix(in srgb, var(--tenant-warning) 16%, transparent)`
                          : `0 2px 6px color-mix(in srgb, ${accentColor} 14%, transparent)`,
                    outline: isCriticalPath && !isSelected && !isError ? '1px dashed color-mix(in srgb, var(--tenant-warning) 48%, transparent)' : 'none',
                    borderRadius: 'var(--tenant-radius-control-tight, 4px)',
                  }}
                />

                {/* Cost chip on LLM bars */}
                {span.kind === 'llm_call' && typeof span.attributes.cost === 'number' ? (
                  <span
                    className="absolute top-1/2 -translate-y-1/2 rounded px-1 py-0.5 text-[9px] font-semibold"
                    style={{
                      left: `calc(${offset + width}% + 6px)`,
                      background: 'color-mix(in srgb, var(--tenant-warning) 14%, transparent)',
                      color: 'var(--tenant-warning)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ${(span.attributes.cost as number).toFixed(4)}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div
        className="flex flex-wrap items-center gap-4 border-t px-3 py-2 text-[10px] text-tenant-text-muted"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
      >
        {Object.entries(SPAN_KIND_LABELS).map(([kind, label]) => (
          <div key={kind} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ background: SPAN_KIND_COLORS[kind] }} />
            <span>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ background: 'var(--tenant-danger)' }} />
          <span>Error</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-sm" style={{ border: '1px dashed color-mix(in srgb, var(--tenant-warning) 64%, transparent)', background: 'color-mix(in srgb, var(--tenant-warning) 12%, transparent)' }} />
          <span>Critical path</span>
        </div>
      </div>
    </div>
  );
}
