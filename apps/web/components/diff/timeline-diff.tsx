import type { Trace, Span } from '@foxhound/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  llm_call: 'bg-blue-500',
  tool_call: 'bg-green-500',
  agent_step: 'bg-purple-500',
  workflow: 'bg-gray-400',
};

export function TimelineDiff({ traceA, traceB, spanDiff }: TimelineDiffProps) {
  if (traceA.spans.length === 0 && traceB.spans.length === 0) {
    return (
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="bg-gray-50 border-b p-4">
          <h3 className="text-lg font-semibold">Timeline Comparison</h3>
          <p className="text-sm text-gray-600 mt-1">Side-by-side span execution order</p>
        </div>
        <div className="p-8 text-center text-sm text-gray-500">No spans available to compare.</div>
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
        return <Badge className="bg-green-100 text-green-800 text-xs">Added</Badge>;
      case 'removed':
        return <Badge className="bg-red-100 text-red-800 text-xs">Removed</Badge>;
      case 'modified':
        return <Badge className="bg-blue-100 text-blue-800 text-xs">Modified</Badge>;
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
        <div key={span.spanId} className="h-16 bg-gray-50 border-b flex items-center justify-center">
          <span className="text-xs text-gray-400">—</span>
        </div>
      );
    }
    
    return (
      <div
        key={span.spanId}
        className={cn(
          'border-b p-3 hover:bg-gray-50 transition-colors',
          getDiffBorder(diffType)
        )}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className={cn('h-2 w-2 rounded-full', SPAN_KIND_COLORS[span.kind] || 'bg-gray-400')} />
            <span className="font-medium text-sm">{span.name}</span>
            {getDiffBadge(diffType)}
          </div>
          <span className="text-xs text-gray-500">{span.kind}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span>Duration: {duration}s</span>
          {cost > 0 && <span>Cost: ${cost.toFixed(4)}</span>}
          <span className={span.status === 'error' ? 'text-red-600 font-medium' : ''}>
            Status: {span.status}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="bg-gray-50 border-b p-4">
        <h3 className="text-lg font-semibold">Timeline Comparison</h3>
        <p className="text-sm text-gray-600 mt-1">
          Side-by-side span execution order
        </p>
      </div>
      
      <div className="grid grid-cols-2 divide-x">
        {/* Trace A */}
        <div>
          <div className="bg-gray-100 border-b px-4 py-2 sticky top-0">
            <div className="text-xs font-medium text-gray-600">Trace A (Baseline)</div>
            <div className="text-xs text-gray-500 mt-0.5">{spansA.length} spans</div>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {spansA.map(span => renderSpanRow(span, true))}
          </div>
        </div>
        
        {/* Trace B */}
        <div>
          <div className="bg-gray-100 border-b px-4 py-2 sticky top-0">
            <div className="text-xs font-medium text-gray-600">Trace B (Comparison)</div>
            <div className="text-xs text-gray-500 mt-0.5">{spansB.length} spans</div>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {spansB.map(span => renderSpanRow(span, false))}
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="border-t bg-gray-50 p-3">
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-1 bg-green-500" />
            <span className="text-gray-600">Added in B</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-1 bg-red-500" />
            <span className="text-gray-600">Removed from A</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-1 bg-blue-500" />
            <span className="text-gray-600">Modified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
