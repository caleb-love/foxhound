'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import type { Trace } from '@foxhound/types';
import { createDateRangeFromHours } from '@/lib/stores/dashboard-filter-presets';
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
    const allTracesAreFutureDated =
      initialData.length > 0 && initialData.every((trace) => Number(trace.startTimeMs) > dateRange.end.getTime());

    if (!(isSandbox && allTracesAreFutureDated)) {
      filtered = filtered.filter((trace) => {
        const traceDate = new Date(trace.startTimeMs);
        return traceDate >= dateRange.start && traceDate <= dateRange.end;
      });
    }

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

  const defaultDateRange = createDateRangeFromHours(24);
  const hasDateFilter =
    Math.abs(dateRange.start.getTime() - defaultDateRange.start.getTime()) > 5 * 60 * 1000 ||
    Math.abs(dateRange.end.getTime() - defaultDateRange.end.getTime()) > 5 * 60 * 1000;

  const hasFilters = status !== 'all' || agentIds.length > 0 || searchQuery || hasDateFilter;

  if (traces.length === 0) {
    const isTrulyEmpty = initialData.length === 0;

    return (
      <WorkbenchPanel
        title="Trace workbench"
        description="Use this table to scan recent executions, isolate unhealthy runs, and launch a run comparison from two selected traces."
      >
        <div className="rounded-lg p-12 text-center" style={{ border: '1px solid var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
          <p className="text-lg font-medium" style={{ color: 'var(--tenant-text-primary)' }}>
            {isTrulyEmpty || !hasFilters ? 'No traces yet' : 'No traces match your filters'}
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--tenant-text-muted)' }}>
            {isTrulyEmpty || !hasFilters
              ? 'Traces will appear here once your agents start sending data.'
              : 'Try adjusting your filters or clearing them to see more results.'}
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
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.48fr)]">
        <div className="flex items-center justify-between">
          <div className="text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>
            Showing <span className="font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{traces.length}</span> trace{traces.length !== 1 ? 's' : ''}
            {traces.length !== initialData.length && (
              <span style={{ color: 'var(--tenant-text-muted)' }}> (filtered from {initialData.length})</span>
            )}
          </div>
        </div>

        <div
          className="rounded-[var(--tenant-radius-panel)] border px-4 py-3"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
            Compare guidance
          </div>
          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--tenant-text-secondary)' }}>
            Pick the failing trace first, then the healthy or newer run second. That preserves the clearest before-versus-after investigation path when you jump into Run Diff.
          </p>
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
              Tip: start with the run that broke, then add the baseline or proposed fix. Keep the compare story obvious.
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
                  className="[&_td]:py-3"
                  style={isSelected ? { background: 'color-mix(in srgb, var(--tenant-accent-soft) 82%, white)' } : undefined}
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
                    <Badge variant={hasError ? 'destructive' : 'default'} className="rounded-[var(--tenant-radius-control-tight)] px-2 py-1 text-[10px] uppercase tracking-[0.14em]">
                      {hasError ? 'Error' : 'Success'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    <div className="truncate font-mono text-sm font-medium" style={{ color: 'var(--tenant-text-primary)' }}>
                      {trace.agentId}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--tenant-text-muted)' }}>
                      {hasError ? 'Needs investigation' : 'Healthy execution'}
                    </div>
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
                  <TableCell>
                    <div className="font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{duration}s</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--tenant-text-muted)' }}>
                      runtime
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{trace.spans.length}</span>
                      <span className="text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
                        ({trace.spans.filter((s) => s.kind === 'llm_call').length} LLM)
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--tenant-text-muted)' }}>
                      total spans
                    </div>
                  </TableCell>
                  <TableCell>
                    <div style={{ color: 'var(--tenant-text-secondary)' }}>
                      {format(new Date(trace.startTimeMs), 'yyyy-MM-dd HH:mm')}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--tenant-text-muted)' }}>
                      started
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <Link
                        href={`${baseHref}/traces/${trace.id}`}
                        className="rounded-[var(--tenant-radius-control-tight)] border px-3 py-1.5 transition-[border-color,background-color,color] duration-200 hover:border-[color:var(--tenant-accent)]/45 hover:bg-[color:var(--tenant-panel-strong)]"
                        style={{ borderColor: 'var(--tenant-panel-stroke)', color: 'var(--tenant-accent-strong)' }}
                      >
                        Inspect
                      </Link>
                    </div>
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
