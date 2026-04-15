'use client';

import { useMemo, useState } from 'react';
import type { Span } from '@foxhound/types';
import { Badge } from '@/components/ui/badge';
import { SpanDetailPanel } from './span-detail-panel';

interface TraceTimelineProps {
  spans: Span[];
}

const SPAN_KIND_COLORS: Record<string, string> = {
  llm_call: 'var(--tenant-accent)',
  tool_call: 'var(--tenant-success)',
  agent_step: 'color-mix(in srgb, var(--tenant-accent) 72%, var(--tenant-text-secondary))',
  workflow: 'color-mix(in srgb, var(--tenant-accent) 58%, var(--tenant-text-muted))',
  custom: 'var(--tenant-text-muted)',
};

const SPAN_KIND_LABELS: Record<string, string> = {
  llm_call: 'LLM',
  tool_call: 'Tool',
  agent_step: 'Agent',
  workflow: 'Workflow',
  custom: 'Custom',
};

function formatSpanDuration(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(2)}s`;
}

function formatOffsetLabel(offsetMs: number): string {
  if (offsetMs <= 0) return 'Start';
  return `+${(offsetMs / 1000).toFixed(2)}s`;
}

export function TraceTimeline({ spans }: TraceTimelineProps) {
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const handleSpanClick = (span: Span) => {
    setSelectedSpan(span);
    setIsPanelOpen(true);
  };

  const selectedSpanId = selectedSpan?.spanId;

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    // Keep selectedSpan so it doesn't flash when closing
    setTimeout(() => setSelectedSpan(null), 300);
  };

  if (!spans || spans.length === 0) {
    return (
      <div className="flex items-center justify-center py-12" style={{ color: 'var(--tenant-text-muted)' }}>
        No spans in this trace
      </div>
    );
  }

  const sortedSpans = [...spans].sort((a, b) => a.startTimeMs - b.startTimeMs);
  const minTime = sortedSpans[0]?.startTimeMs || 0;
  const maxTime = sortedSpans[sortedSpans.length - 1]?.endTimeMs || minTime;
  const totalDuration = maxTime - minTime || 1;

  const spanStats = useMemo(
    () => ({
      llm: sortedSpans.filter((span) => span.kind === 'llm_call').length,
      tool: sortedSpans.filter((span) => span.kind === 'tool_call').length,
      errors: sortedSpans.filter((span) => span.status === 'error').length,
    }),
    [sortedSpans],
  );

  return (
    <div className="space-y-4">
      <div
        className="rounded-[var(--tenant-radius-panel)] border px-4 py-4"
        style={{
          borderColor: 'var(--tenant-panel-stroke)',
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--tenant-panel-strong) 94%, white), color-mix(in srgb, var(--tenant-panel) 96%, white))',
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
              Investigate execution path
            </div>
            <p className="max-w-2xl text-sm leading-6" style={{ color: 'var(--tenant-text-secondary)' }}>
              Each row shows when a span entered the trace, how long it ran, and where to open deeper evidence. Use the rail to spot handoffs, bottlenecks, and suspicious late-stage drift.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:min-w-[320px]">
            {[
              ['LLM calls', String(spanStats.llm)],
              ['Tool calls', String(spanStats.tool)],
              ['Errors', String(spanStats.errors)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[var(--tenant-radius-panel-tight)] border px-3 py-2.5"
                style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--tenant-text-muted)' }}>{label}</div>
                <div className="mt-1 text-base font-semibold tracking-[-0.02em]" style={{ color: 'var(--tenant-text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {sortedSpans.map((span, index) => {
          const duration = span.endTimeMs ? span.endTimeMs - span.startTimeMs : 0;
          const offset = ((span.startTimeMs - minTime) / totalDuration) * 100;
          const width = (duration / totalDuration) * 100;
          const isSelected = selectedSpanId === span.spanId && isPanelOpen;
          const accent = SPAN_KIND_COLORS[span.kind] || 'var(--tenant-text-muted)';
          const offsetLabel = formatOffsetLabel(span.startTimeMs - minTime);

          return (
            <div
              key={span.spanId}
              className="grid gap-4 rounded-[var(--tenant-radius-panel)] border p-4 transition-[border-color,background-color,box-shadow,transform] duration-200 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)_128px] md:items-center"
              style={{
                borderColor: isSelected ? 'color-mix(in srgb, var(--tenant-accent) 42%, var(--tenant-panel-stroke))' : 'var(--tenant-panel-stroke)',
                background: isSelected
                  ? 'linear-gradient(180deg, color-mix(in srgb, var(--tenant-accent-soft) 72%, white), color-mix(in srgb, var(--tenant-panel-strong) 96%, white))'
                  : 'linear-gradient(180deg, color-mix(in srgb, var(--tenant-panel-strong) 94%, white), color-mix(in srgb, var(--tenant-panel) 96%, white))',
                boxShadow: isSelected
                  ? '0 0 0 1px color-mix(in srgb, var(--tenant-accent) 16%, transparent), 0 18px 42px color-mix(in srgb, var(--tenant-accent) 10%, transparent)'
                  : '0 8px 24px color-mix(in srgb, black 3%, transparent)',
              }}
            >
              <div className="min-w-0 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--tenant-radius-control-tight)] border text-[11px] font-semibold"
                    style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)', color: 'var(--tenant-text-muted)' }}
                  >
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold tracking-[-0.02em]" style={{ color: 'var(--tenant-text-primary)' }}>{span.name}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
                        {SPAN_KIND_LABELS[span.kind] || span.kind}
                      </Badge>
                      <Badge variant="outline" className="rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-panel) 60%, white)' }}>
                        {offsetLabel}
                      </Badge>
                      {span.status === 'error' ? (
                        <Badge variant="destructive" className="rounded-[var(--tenant-radius-control-tight)] text-[10px] uppercase tracking-[0.14em]">Error</Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: 'color-mix(in srgb, var(--tenant-success) 24%, var(--tenant-panel-stroke))', background: 'color-mix(in srgb, var(--tenant-success) 8%, white)', color: 'color-mix(in srgb, var(--tenant-success) 75%, var(--tenant-text-primary))' }}>
                          Stable
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-3 px-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
                    Execution rail
                  </div>
                  <div className="text-xs" style={{ color: 'var(--tenant-text-secondary)' }}>{formatSpanDuration(duration)}</div>
                </div>
                <div className="relative h-14 overflow-hidden rounded-[var(--tenant-radius-panel-tight)] border px-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'linear-gradient(180deg, color-mix(in srgb, var(--tenant-panel-inset) 92%, white), color-mix(in srgb, var(--tenant-panel-alt) 90%, white))' }}>
                  <div className="absolute inset-y-0 left-0 right-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--tenant-panel-stroke)_65%,transparent)_1px,transparent_1px)] bg-[length:12.5%_100%] opacity-50" />
                  <div className="absolute inset-y-3 left-3 right-3 rounded-full" style={{ background: 'color-mix(in srgb, var(--tenant-panel-stroke) 18%, transparent)' }} />
                  <button
                    onClick={() => handleSpanClick(span)}
                    className="absolute top-1/2 h-8 -translate-y-1/2 rounded-full transition-all duration-200 cursor-pointer hover:-translate-y-[55%] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2"
                    style={{
                      left: `max(${offset}%, 12px)`,
                      width: `max(${Math.max(width, 3)}%, 44px)`,
                      background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 82%, white))`,
                      boxShadow: span.status === 'error'
                        ? '0 0 0 2px color-mix(in srgb, white 92%, transparent), 0 0 0 5px color-mix(in srgb, var(--tenant-danger) 18%, transparent), 0 16px 32px color-mix(in srgb, var(--tenant-danger) 18%, transparent)'
                        : isSelected
                          ? '0 0 0 2px color-mix(in srgb, white 92%, transparent), 0 0 0 5px color-mix(in srgb, var(--tenant-accent) 18%, transparent), 0 16px 32px color-mix(in srgb, var(--tenant-accent) 16%, transparent)'
                          : '0 0 0 1px color-mix(in srgb, white 68%, transparent), 0 10px 24px color-mix(in srgb, black 10%, transparent)',
                      color: 'white',
                    }}
                    title={`${span.name}\nDuration: ${(duration / 1000).toFixed(3)}s\nStatus: ${span.status}\nClick for details`}
                    aria-label={`View details for ${span.name}`}
                  >
                    <span className="sr-only">Open span details</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-start gap-2 md:items-end">
                <div className="rounded-[var(--tenant-radius-panel-tight)] border px-3 py-2 text-right"
                  style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--tenant-text-muted)' }}>Duration</div>
                  <div className="mt-1 text-base font-semibold tracking-[-0.02em]" style={{ color: 'var(--tenant-text-primary)' }}>{formatSpanDuration(duration)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSpanClick(span)}
                  className="text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors"
                  style={{ color: isSelected ? 'var(--tenant-accent-strong)' : 'var(--tenant-text-muted)' }}
                >
                  {isSelected ? 'Inspector open' : 'Open inspector'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
        <div className="flex flex-wrap items-center gap-6 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
          {[
            ['LLM Call', SPAN_KIND_COLORS.llm_call],
            ['Tool Call', SPAN_KIND_COLORS.tool_call],
            ['Agent Step', SPAN_KIND_COLORS.agent_step],
            ['Workflow', SPAN_KIND_COLORS.workflow],
          ].map(([label, color]) => (
            <div key={label} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ background: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <SpanDetailPanel
        span={selectedSpan}
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
      />
    </div>
  );
}
