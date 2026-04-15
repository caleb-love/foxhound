'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import type { Trace } from '@foxhound/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useFilterStore } from '@/lib/stores/filter-store';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { useCompareStore } from '@/lib/stores/compare-store';
import { WorkbenchPanel, SelectionSummaryBar, TableShell } from '@/components/system/workbench';
import { getSandboxRootHref, getSandboxSessionHref, isSandboxPath } from '@/lib/sandbox-routes';

interface TraceTableProps {
  initialData: Trace[];
}

export function TraceTable({ initialData }: TraceTableProps) {
  const legacyFilters = useFilterStore();
  const segmentFilters = useSegmentStore((state) => state.currentFilters);
  const { status, agentIds, dateRange, searchQuery } = segmentFilters ?? legacyFilters;
  const { selectedTraceIds, toggleTrace, clearSelection, canCompare } = useCompareStore();
  const pathname = usePathname();
  const router = useRouter();
  
  const isSandbox = isSandboxPath(pathname);
  const baseHref = isSandbox ? getSandboxRootHref() : '';
  
  const handleCompare = () => {
    if (canCompare()) {
      const [traceA, traceB] = selectedTraceIds;
      router.push(`${baseHref}/diff?a=${traceA}&b=${traceB}`);
    }
  };

  // Apply filters
  const traces = useMemo(() => {
    let filtered = initialData;

    // Status filter
    if (status !== 'all') {
      filtered = filtered.filter((trace) => {
        const hasError = trace.spans.some((s) => s.status === 'error');
        return status === 'error' ? hasError : !hasError;
      });
    }

    // Agent filter
    if (agentIds.length > 0) {
      filtered = filtered.filter((trace) => agentIds.includes(trace.agentId));
    }

    // Date range filter
    filtered = filtered.filter((trace) => {
      const traceDate = new Date(trace.startTimeMs);
      return traceDate >= dateRange.start && traceDate <= dateRange.end;
    });

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((trace) => {
        const metadata = trace.metadata as { workflow?: string; [key: string]: unknown } | undefined;
        return (
          trace.id.toLowerCase().includes(query) ||
          trace.agentId.toLowerCase().includes(query) ||
          trace.sessionId?.toLowerCase().includes(query) ||
          metadata?.workflow?.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [initialData, status, agentIds, dateRange, searchQuery]);

  const hasFilters = status !== 'all' || agentIds.length > 0 || searchQuery;

  if (traces.length === 0) {
    return (
      <WorkbenchPanel
        title="Trace workbench"
        description="Use this table to scan recent executions, isolate unhealthy runs, and launch a run comparison from two selected traces."
      >
        <div className="rounded-lg p-12 text-center" style={{ border: '1px solid var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
          <p className="text-lg font-medium" style={{ color: 'var(--tenant-text-primary)' }}>
            {hasFilters ? 'No traces match your filters' : 'No traces yet'}
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--tenant-text-muted)' }}>
            {hasFilters
              ? 'Try adjusting your filters or clearing them to see more results.'
              : 'Traces will appear here once your agents start sending data.'}
          </p>
        </div>
      </WorkbenchPanel>
    );
  }

  return (
    <WorkbenchPanel
      title="Trace workbench"
      description="Select two runs to compare, inspect recent failures, and move from evidence to investigation without leaving this surface."
    >
      <div className="flex items-center justify-between">
        <div className="text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>
          Showing <span className="font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{traces.length}</span> trace{traces.length !== 1 ? 's' : ''}
          {traces.length !== initialData.length && (
            <span style={{ color: 'var(--tenant-text-muted)' }}> (filtered from {initialData.length})</span>
          )}
        </div>
      </div>

      <SelectionSummaryBar
        selectedCount={selectedTraceIds.length}
        canCompare={canCompare()}
        onClear={clearSelection}
        onCompare={handleCompare}
      />

      <TableShell
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Tip: select the failing run first, then the healthy or newer run second, to preserve the clearest comparison story.
            </span>
            {selectedTraceIds.length === 0 ? <span>No traces selected yet.</span> : <span>{selectedTraceIds.length} selected for compare flow.</span>}
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <span className="sr-only">Select</span>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Spans</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {traces.map((trace) => {
              const duration = trace.endTimeMs
                ? ((trace.endTimeMs - trace.startTimeMs) / 1000).toFixed(2)
                : '-';
              const hasError = trace.spans.some((s) => s.status === 'error');
              const isSelected = selectedTraceIds.includes(trace.id);

              return (
                <TableRow
                  key={trace.id}
                  data-state={isSelected ? 'selected' : undefined}
                  style={isSelected ? { background: 'var(--tenant-accent-soft)' } : undefined}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleTrace(trace.id)}
                      className="h-4 w-4 cursor-pointer rounded"
                      style={{ borderColor: 'var(--tenant-panel-stroke)', accentColor: 'var(--tenant-accent)' }}
                      aria-label={`Select trace ${trace.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={hasError ? 'destructive' : 'default'}>
                      {hasError ? 'Error' : 'Success'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] font-mono text-sm truncate">
                    {trace.agentId}
                  </TableCell>
                  <TableCell>
                    {trace.sessionId ? (
                      isSandbox ? (
                        <Link
                          href={getSandboxSessionHref(trace.sessionId)}
                          className="font-mono text-sm text-indigo-300 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {trace.sessionId.slice(0, 8)}
                        </Link>
                      ) : (
                        <Link
                          href={`${baseHref}/sessions/${trace.sessionId}`}
                          className="font-mono text-sm text-indigo-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {trace.sessionId.slice(0, 8)}
                        </Link>
                      )
                    ) : (
                      <span style={{ color: 'var(--tenant-text-muted)' }}>-</span>
                    )}
                  </TableCell>
                  <TableCell>{duration}s</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{trace.spans.length}</span>
                      <span className="text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
                        ({trace.spans.filter((s) => s.kind === 'llm_call').length} LLM)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell style={{ color: 'var(--tenant-text-muted)' }}>
                    {formatDistanceToNow(new Date(trace.startTimeMs), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`${baseHref}/traces/${trace.id}`}
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableShell>
    </WorkbenchPanel>
  );
}
