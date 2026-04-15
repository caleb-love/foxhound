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
    <div className="space-y-2">
      {sortedSpans.map((span) => {
        const duration = span.endTimeMs ? span.endTimeMs - span.startTimeMs : 0;
        const offset = ((span.startTimeMs - minTime) / totalDuration) * 100;
        const width = (duration / totalDuration) * 100;

        return (
          <div key={span.spanId} className="flex items-center gap-3">
            <div className="w-48 shrink-0">
              <div className="truncate text-sm font-medium">{span.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {SPAN_KIND_LABELS[span.kind] || span.kind}
                </Badge>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="relative h-8">
                <button
                  onClick={() => handleSpanClick(span)}
                  className="absolute h-full rounded transition-all cursor-pointer hover:opacity-80"
                  style={{
                    left: `${offset}%`,
                    width: `${Math.max(width, 2)}%`,
                    background: SPAN_KIND_COLORS[span.kind] || 'var(--tenant-text-muted)',
                    boxShadow: span.status === 'error' ? '0 0 0 2px var(--tenant-danger), 0 0 0 3px color-mix(in srgb, white 85%, transparent)' : '0 0 0 1px color-mix(in srgb, white 55%, transparent)',
                  }}
                  title={`${span.name}\nDuration: ${(duration / 1000).toFixed(3)}s\nStatus: ${span.status}\nClick for details`}
                  aria-label={`View details for ${span.name}`}
                />
              </div>
            </div>
            <Badge variant="outline" className="w-24 justify-center text-xs shrink-0">
              {(duration / 1000).toFixed(2)}s
            </Badge>
          </div>
        );
      })}
      <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
        <div className="flex items-center gap-6 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
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
