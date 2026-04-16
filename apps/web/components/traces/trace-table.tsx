'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import type { Trace } from '@foxhound/types';
import { Button } from '@/components/ui/button';
import { createDateRangeFromHours } from '@/lib/stores/dashboard-filter-presets';
import { useFilterStore } from '@/lib/stores/filter-store';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { useCompareStore } from '@/lib/stores/compare-store';
import { WorkbenchPanel, SelectionSummaryBar, TableShell } from '@/components/system/workbench';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getSandboxPromptDetailHref,
  getSandboxReplayHref,
  getSandboxRootHref,
  getSandboxSessionHref,
  isSandboxPath,
} from '@/lib/sandbox-routes';
import { getPromptMetadata } from '@/lib/trace-utils';
import { InlineAction } from '@/components/investigation';
import { Eye, Play, BookOpen } from 'lucide-react';

interface TraceTableProps {
  initialData: Trace[];
}

export function TraceTable({ initialData }: TraceTableProps) {
  const legacyFilters = useFilterStore();
  const segmentFilters = useSegmentStore((state) => state.currentFilters);
  const { status, agentIds, dateRange, searchQuery } = segmentFilters ?? legacyFilters;
  const { selectedTraceIds, toggleTrace, clearSelection, canCompare, setTraceSlot, setComparePair } = useCompareStore();
  const pathname = usePathname();
  const router = useRouter();

  const isSandbox = isSandboxPath(pathname);
  const baseHref = isSandbox ? getSandboxRootHref() : '';

  const handleCompare = () => {
    if (canCompare()) {
      const [traceA, traceB] = selectedTraceIds;
      setComparePair(traceA!, traceB!);
      router.push(`${baseHref}/diff?a=${traceA}&b=${traceB}`);
    }
  };

  const handleSetCompareSlot = (slot: 'a' | 'b', traceId: string) => {
    const otherTraceId = selectedTraceIds.find((id) => id !== traceId);
    setTraceSlot(slot, traceId);
    if (slot === 'a' && otherTraceId) setComparePair(traceId, otherTraceId);
    if (slot === 'b' && otherTraceId) setComparePair(otherTraceId, traceId);
  };

  // Apply filters
  const traces = useMemo(() => {
    let filtered = initialData;

    if (status !== 'all') {
      filtered = filtered.filter((trace) => {
        const hasError = trace.spans.some((s) => s.status === 'error');
        return status === 'error' ? hasError : !hasError;
      });
    }

    if (agentIds.length > 0) {
      filtered = filtered.filter((trace) => agentIds.includes(trace.agentId));
    }

    const allTracesAreFutureDated =
      initialData.length > 0 && initialData.every((trace) => Number(trace.startTimeMs) > dateRange.end.getTime());

    if (!(isSandbox && allTracesAreFutureDated)) {
      filtered = filtered.filter((trace) => {
        const traceDate = new Date(trace.startTimeMs);
        return traceDate >= dateRange.start && traceDate <= dateRange.end;
      });
    }

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
  }, [initialData, status, agentIds, dateRange, searchQuery, isSandbox]);

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
          <p className="text-lg font-medium text-tenant-text-primary">
            {isTrulyEmpty || !hasFilters ? 'No traces yet' : 'No traces match your filters'}
          </p>
          <p className="mt-2 text-sm text-tenant-text-muted">
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
      description="Select two runs to compare, inspect recent failures, and move from evidence to investigation."
    >
      <div className="flex items-center justify-between">
        <div className="text-sm text-tenant-text-secondary">
          Showing <span className="font-medium text-tenant-text-primary">{traces.length}</span> trace{traces.length !== 1 ? 's' : ''}
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

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <span className="sr-only">Select</span>
              </TableHead>
              <TableHead className="w-[200px]">Agent / Status</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Spans</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {traces.map((trace) => {
              const duration = trace.endTimeMs
                ? ((trace.endTimeMs - trace.startTimeMs) / 1000).toFixed(2)
                : '-';
              const hasError = trace.spans.some((s) => s.status === 'error');
              const errorCount = trace.spans.filter((s) => s.status === 'error').length;
              const isSelected = selectedTraceIds.includes(trace.id);
              const { promptName, promptVersion } = getPromptMetadata(trace);
              const replayHref = isSandbox ? getSandboxReplayHref(trace.id) : `${baseHref}/replay/${trace.id}`;
              const promptHref = promptName
                ? isSandbox
                  ? getSandboxPromptDetailHref(promptName)
                  : `${baseHref}/prompts?focus=${encodeURIComponent(promptName)}`
                : null;
              const totalCost = trace.spans.reduce((sum, s) => {
                const c = s.attributes.cost;
                return sum + (typeof c === 'number' ? c : 0);
              }, 0);
              const storyLabel = typeof trace.metadata?.story_label === 'string' ? trace.metadata.story_label : null;

              return (
                <TableRow
                  key={trace.id}
                  data-state={isSelected ? 'selected' : undefined}
                  className="group"
                  style={{
                    borderLeft: hasError ? '3px solid var(--tenant-danger)' : '3px solid transparent',
                    background: isSelected
                      ? 'color-mix(in srgb, var(--tenant-accent) 8%, var(--card))'
                      : hasError
                        ? 'color-mix(in srgb, var(--tenant-danger) 3%, var(--card))'
                        : undefined,
                  }}
                >
                  <TableCell className="py-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleTrace(trace.id)}
                      className="h-4 w-4 cursor-pointer rounded"
                      style={{ borderColor: 'var(--tenant-panel-stroke)', accentColor: 'var(--tenant-accent)' }}
                      aria-label={`Select trace ${trace.id}`}
                    />
                  </TableCell>

                  {/* Agent + status */}
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background: hasError ? 'var(--tenant-danger)' : 'var(--tenant-success)',
                          boxShadow: hasError ? '0 0 0 3px color-mix(in srgb, var(--tenant-danger) 16%, transparent)' : 'none',
                        }}
                      />
                      <div className="min-w-0">
                        <Link
                          href={`${baseHref}/traces/${trace.id}`}
                          className="block truncate text-sm font-medium text-tenant-text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {trace.agentId}
                        </Link>
                        <div className="mt-0.5 truncate text-[11px] text-tenant-text-muted">
                          {hasError ? (
                            <span style={{ color: 'var(--tenant-danger)' }}>{errorCount} error{errorCount > 1 ? 's' : ''}</span>
                          ) : (
                            <span style={{ color: 'var(--tenant-success)' }}>Healthy</span>
                          )}
                          {storyLabel ? <span> · {storyLabel}</span> : null}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Session */}
                  <TableCell className="py-2.5">
                    {trace.sessionId ? (
                      <Link
                        href={isSandbox ? getSandboxSessionHref(trace.sessionId) : `${baseHref}/sessions/${trace.sessionId}`}
                        className="font-mono text-xs hover:underline"
                        style={{ color: 'var(--tenant-accent)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {trace.sessionId.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-xs text-tenant-text-muted">--</span>
                    )}
                  </TableCell>

                  {/* Duration */}
                  <TableCell className="py-2.5">
                    <span className="font-mono text-sm text-tenant-text-primary">{duration}s</span>
                  </TableCell>

                  {/* Spans */}
                  <TableCell className="py-2.5">
                    <span className="text-sm text-tenant-text-primary">{trace.spans.length}</span>
                    <span className="ml-1 text-[10px] text-tenant-text-muted">
                      ({trace.spans.filter((s) => s.kind === 'llm_call').length} LLM)
                    </span>
                  </TableCell>

                  {/* Cost */}
                  <TableCell className="py-2.5">
                    {totalCost > 0 ? (
                      <span className="font-mono text-sm text-tenant-text-primary">${totalCost.toFixed(4)}</span>
                    ) : (
                      <span className="text-xs text-tenant-text-muted">--</span>
                    )}
                  </TableCell>

                  {/* Started */}
                  <TableCell className="py-2.5">
                    <span className="text-xs text-tenant-text-secondary">
                      {format(new Date(trace.startTimeMs), 'MMM d HH:mm')}
                    </span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="py-2.5">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <InlineAction href={`${baseHref}/traces/${trace.id}`} variant="primary" className="text-xs px-2 py-1">
                        <Eye className="h-3 w-3" />
                        Inspect
                      </InlineAction>
                      <InlineAction href={replayHref} variant="secondary" className="text-xs px-2 py-1">
                        <Play className="h-3 w-3" />
                        Replay
                      </InlineAction>
                      {promptHref ? (
                        <InlineAction href={promptHref} variant="ghost" className="text-xs px-2 py-1">
                          <BookOpen className="h-3 w-3" />
                          Prompt{promptVersion !== undefined ? ` v${promptVersion}` : ''}
                        </InlineAction>
                      ) : null}
                      <Button variant="outline" size="xs" onClick={() => handleSetCompareSlot('a', trace.id)}>
                        Set A
                      </Button>
                      <Button variant="outline" size="xs" onClick={() => handleSetCompareSlot('b', trace.id)}>
                        Set B
                      </Button>
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
