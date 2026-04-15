import type { Trace, Span } from '@foxhound/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { tenantStyles } from '@/components/sandbox/primitives';

interface TimelineDiffProps {
  traceA: Trace;
  traceB: Trace;
  spanDiff: {
    added: Span[];
    removed: Span[];
    modified: Span[];
    unchanged: Span[];
  };
}

function matchesSpan(left: Span, right: Span): boolean {
  return left.spanId === right.spanId;
}

const SPAN_KIND_COLORS: Record<string, string> = {
  llm_call: 'var(--tenant-accent)',
  tool_call: 'var(--tenant-success)',
  agent_step: 'color-mix(in srgb, var(--tenant-accent) 72%, var(--tenant-text-secondary))',
  workflow: 'var(--tenant-text-muted)',
};

export function TimelineDiff({ traceA, traceB, spanDiff }: TimelineDiffProps) {
  if (traceA.spans.length === 0 && traceB.spans.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg" style={tenantStyles.panel}>
        <div className="border-b p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>Timeline Comparison</h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>Side-by-side span execution order</p>
        </div>
        <div className="p-8 text-center text-sm" style={{ color: 'var(--tenant-text-muted)' }}>No spans available to compare.</div>
      </div>
    );
  }

  // Sort spans by start time
  const spansA = [...traceA.spans].sort((a, b) => a.startTimeMs - b.startTimeMs);
  const spansB = [...traceB.spans].sort((a, b) => a.startTimeMs - b.startTimeMs);
  
  const getDiffType = (span: Span): 'added' | 'removed' | 'modified' | 'unchanged' => {
    if (spanDiff.added.some((candidate) => matchesSpan(candidate, span))) return 'added';
    if (spanDiff.removed.some((candidate) => matchesSpan(candidate, span))) return 'removed';
    if (spanDiff.modified.some((candidate) => matchesSpan(candidate, span))) return 'modified';
    return 'unchanged';
  };
  
  const getDiffBadge = (type: string) => {
    switch (type) {
      case 'added':
        return <Badge className="text-xs" style={{ background: 'color-mix(in srgb, var(--tenant-success) 14%, white)', color: 'var(--tenant-success)' }}>Added</Badge>;
      case 'removed':
        return <Badge className="text-xs" style={{ background: 'color-mix(in srgb, var(--tenant-danger) 14%, white)', color: 'var(--tenant-danger)' }}>Removed</Badge>;
      case 'modified':
        return <Badge className="text-xs" style={{ background: 'color-mix(in srgb, var(--tenant-accent) 14%, white)', color: 'var(--tenant-accent)' }}>Modified</Badge>;
      default:
        return null;
    }
  };
  
  const getDiffBorder = (type: string) => {
    switch (type) {
      case 'added':
        return 'border-l-4 border-l-green-500';
      case 'removed':
        return 'border-l-4 border-l-red-500';
      case 'modified':
        return 'border-l-4 border-l-blue-500';
      default:
        return 'border-l-4 border-l-transparent';
    }
  };

  const renderSpanRow = (span: Span, isTraceA: boolean) => {
    const duration = span.endTimeMs
      ? ((span.endTimeMs - span.startTimeMs) / 1000).toFixed(2)
      : '-';
    
    const cost = (span.attributes.cost as number) || 0;
    const diffType = getDiffType(span);
    const shouldShow = isTraceA ? diffType !== 'added' : diffType !== 'removed';
    
    if (!shouldShow) {
      return (
        <div key={span.spanId} className="flex h-16 items-center justify-center border-b" style={{ background: 'var(--tenant-panel-alt)', borderColor: 'var(--tenant-panel-stroke)' }}>
          <span className="text-xs" style={{ color: 'var(--tenant-text-muted)' }}>—</span>
        </div>
      );
    }
    
    return (
      <div
        key={span.spanId}
        className={cn(
          'border-b p-3 transition-colors',
          getDiffBorder(diffType)
        )}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ background: SPAN_KIND_COLORS[span.kind] || 'var(--tenant-text-muted)' }} />
            <span className="font-medium text-sm">{span.name}</span>
            {getDiffBadge(diffType)}
          </div>
          <span className="text-xs" style={{ color: 'var(--tenant-text-muted)' }}>{span.kind}</span>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--tenant-text-secondary)' }}>
          <span>Duration: {duration}s</span>
          {cost > 0 && <span>Cost: ${cost.toFixed(4)}</span>}
          <span className={span.status === 'error' ? 'font-medium' : ''} style={span.status === 'error' ? { color: 'var(--tenant-danger)' } : undefined}>
            Status: {span.status}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg" style={tenantStyles.panel}>
      <div className="border-b p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>Timeline Comparison</h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>
          Side-by-side span execution order
        </p>
      </div>
      
      <div className="grid grid-cols-2 divide-x">
        {/* Trace A */}
        <div>
          <div className="sticky top-0 border-b px-4 py-2" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--tenant-text-secondary)' }}>Trace A (Baseline)</div>
            <div className="mt-0.5 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>{spansA.length} spans</div>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {spansA.map(span => renderSpanRow(span, true))}
          </div>
        </div>
        
        {/* Trace B */}
        <div>
          <div className="sticky top-0 border-b px-4 py-2" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--tenant-text-secondary)' }}>Trace B (Comparison)</div>
            <div className="mt-0.5 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>{spansB.length} spans</div>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {spansB.map(span => renderSpanRow(span, false))}
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="border-t p-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
        <div className="flex items-center gap-6 text-xs" style={{ color: 'var(--tenant-text-secondary)' }}>
          <div className="flex items-center gap-2">
            <div className="h-3 w-1" style={{ background: 'var(--tenant-success)' }} />
            <span>Added in B</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-1" style={{ background: 'var(--tenant-danger)' }} />
            <span>Removed from A</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-1" style={{ background: 'var(--tenant-accent)' }} />
            <span>Modified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
