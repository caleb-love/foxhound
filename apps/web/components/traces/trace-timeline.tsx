'use client';

import { useState } from 'react';
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

  return (
    <div className="space-y-3">
      {sortedSpans.map((span) => {
        const duration = span.endTimeMs ? span.endTimeMs - span.startTimeMs : 0;
        const offset = ((span.startTimeMs - minTime) / totalDuration) * 100;
        const width = (duration / totalDuration) * 100;

        const isSelected = selectedSpanId === span.spanId && isPanelOpen;

        return (
          <div
            key={span.spanId}
            className="grid gap-3 rounded-[var(--tenant-radius-panel-tight)] border px-3 py-3 transition-[border-color,background-color,box-shadow] duration-200 md:grid-cols-[220px_minmax(0,1fr)_110px] md:items-center"
            style={{
              borderColor: isSelected ? 'color-mix(in srgb, var(--tenant-accent) 45%, var(--tenant-panel-stroke))' : 'var(--tenant-panel-stroke)',
              background: isSelected ? 'linear-gradient(180deg, color-mix(in srgb, var(--tenant-accent-soft) 88%, var(--tenant-panel-strong)), var(--tenant-panel-strong))' : 'var(--tenant-panel-strong)',
              boxShadow: isSelected ? '0 0 0 1px color-mix(in srgb, var(--tenant-accent) 18%, transparent), 0 12px 30px color-mix(in srgb, var(--tenant-accent) 10%, transparent)' : 'none',
            }}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{span.name}</div>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="rounded-[var(--tenant-radius-control-tight)] text-[10px] uppercase tracking-[0.14em]">
                  {SPAN_KIND_LABELS[span.kind] || span.kind}
                </Badge>
                {span.status === 'error' ? (
                  <Badge variant="destructive" className="rounded-[var(--tenant-radius-control-tight)] text-[10px] uppercase tracking-[0.14em]">Error</Badge>
                ) : null}
              </div>
            </div>
            <div className="min-w-0">
              <div className="relative h-10 rounded-[var(--tenant-radius-control-tight)] border px-2" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-inset)' }}>
                <div className="absolute inset-y-0 left-0 w-px" style={{ background: 'color-mix(in srgb, var(--tenant-panel-stroke) 80%, transparent)' }} />
                <button
                  onClick={() => handleSpanClick(span)}
                  className="absolute top-1/2 h-6 -translate-y-1/2 rounded-[var(--tenant-radius-control-tight)] transition-all duration-200 cursor-pointer hover:opacity-90 hover:brightness-105"
                  style={{
                    left: `${offset}%`,
                    width: `${Math.max(width, 2)}%`,
                    background: SPAN_KIND_COLORS[span.kind] || 'var(--tenant-text-muted)',
                    boxShadow: span.status === 'error'
                      ? '0 0 0 2px var(--tenant-danger), 0 0 0 4px color-mix(in srgb, white 85%, transparent), 0 8px 24px color-mix(in srgb, var(--tenant-danger) 16%, transparent)'
                      : isSelected
                        ? '0 0 0 2px color-mix(in srgb, white 92%, transparent), 0 0 0 4px color-mix(in srgb, var(--tenant-accent) 22%, transparent), 0 8px 24px color-mix(in srgb, var(--tenant-accent) 14%, transparent)'
                        : '0 0 0 1px color-mix(in srgb, white 55%, transparent)',
                  }}
                  title={`${span.name}\nDuration: ${(duration / 1000).toFixed(3)}s\nStatus: ${span.status}\nClick for details`}
                  aria-label={`View details for ${span.name}`}
                />
              </div>
            </div>
            <div className="flex flex-col items-start gap-1 md:items-end">
              <Badge variant="outline" className="w-24 justify-center rounded-[var(--tenant-radius-control-tight)] text-[10px] uppercase tracking-[0.14em] shrink-0 md:justify-self-end">
                {(duration / 1000).toFixed(2)}s
              </Badge>
              <span className="text-[11px] uppercase tracking-[0.14em]" style={{ color: isSelected ? 'var(--tenant-accent-strong)' : 'var(--tenant-text-muted)' }}>
                {isSelected ? 'Open in inspector' : 'Inspect span'}
              </span>
            </div>
          </div>
        );
      })}
      <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
        <div className="flex flex-wrap items-center gap-6 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
          {[
            ['LLM Call', SPAN_KIND_COLORS.llm_call],
            ['Tool Call', SPAN_KIND_COLORS.tool_call],
            ['Agent Step', SPAN_KIND_COLORS.agent_step],
            ['Workflow', SPAN_KIND_COLORS.workflow],
          ].map(([label, color]) => (
            <div key={label} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ background: color }} />
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
