'use client';

import { useState } from 'react';
import type { Span } from '@foxhound/types';
import { Badge } from '@/components/ui/badge';
import { SpanDetailPanel } from './span-detail-panel';

interface TraceTimelineProps {
  spans: Span[];
}

const SPAN_KIND_COLORS: Record<string, string> = {
  llm_call: 'bg-blue-500',
  tool_call: 'bg-green-500',
  agent_step: 'bg-purple-500',
  workflow: 'bg-indigo-500',
  custom: 'bg-gray-500',
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
      <div className="flex items-center justify-center py-12 text-gray-500">
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
                  className={`absolute h-full rounded ${
                    SPAN_KIND_COLORS[span.kind] || 'bg-gray-400'
                  } ${
                    span.status === 'error'
                      ? 'ring-2 ring-red-500 ring-offset-1'
                      : ''
                  } hover:opacity-80 hover:ring-2 hover:ring-offset-1 hover:ring-indigo-400 transition-all cursor-pointer`}
                  style={{
                    left: `${offset}%`,
                    width: `${Math.max(width, 2)}%`,
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
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span>LLM Call</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>Tool Call</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-500" />
            <span>Agent Step</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-indigo-500" />
            <span>Workflow</span>
          </div>
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
