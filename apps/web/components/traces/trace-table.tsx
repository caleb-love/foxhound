'use client';

import { useMemo, useRef, type CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import type { Trace } from '@foxhound/types';
import { Button } from '@/components/ui/button';
import { createDateRangeFromHours } from '@/lib/stores/dashboard-filter-presets';
import { useFilterStore } from '@/lib/stores/filter-store';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { useCompareStore } from '@/lib/stores/compare-store';
import { WorkbenchPanel, SelectionSummaryBar } from '@/components/system/workbench';
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

const ROW_HEIGHT = 56;
const VIRTUAL_THRESHOLD = 80;
const GRID_COLS = '40px minmax(160px,1.2fr) 80px 72px 80px 80px 88px minmax(180px,1fr)';

/* ---------- Row component (shared by virtual and non-virtual paths) ---------- */

interface TraceRowProps {
  trace: Trace;
  baseHref: string;
  isSandbox: boolean;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onSetSlot: (slot: 'a' | 'b', id: string) => void;
  style?: CSSProperties;
}

function TraceRow({ trace, baseHref, isSandbox, isSelected, onToggle, onSetSlot, style }: TraceRowProps) {
  const duration = trace.endTimeMs ? ((trace.endTimeMs - trace.startTimeMs) / 1000).toFixed(2) : '-';
  const hasError = trace.spans.some((s) => s.status === 'error');
  const errorCount = trace.spans.filter((s) => s.status === 'error').length;
  const { promptName } = getPromptMetadata(trace);
  const replayHref = isSandbox ? getSandboxReplayHref(trace.id) : `${baseHref}/replay/${trace.id}`;
  const promptHref = promptName
    ? isSandbox ? getSandboxPromptDetailHref(promptName) : `${baseHref}/prompts?focus=${encodeURIComponent(promptName)}`
    : null;
  const totalCost = trace.spans.reduce((sum, s) => sum + (typeof s.attributes.cost === 'number' ? (s.attributes.cost as number) : 0), 0);
  const storyLabel = typeof trace.metadata?.story_label === 'string' ? trace.metadata.story_label : null;

  return (
    <div
      data-state={isSelected ? 'selected' : undefined}
      className="grid items-center border-b px-3"
      style={{
        gridTemplateColumns: GRID_COLS,
        height: ROW_HEIGHT,
        borderColor: 'var(--tenant-panel-stroke)',
        borderLeft: hasError ? '3px solid var(--tenant-danger)' : '3px solid transparent',
        background: isSelected
          ? 'color-mix(in srgb, var(--tenant-accent) 8%, var(--card))'
          : hasError
            ? 'color-mix(in srgb, var(--tenant-danger) 3%, var(--card))'
            : undefined,
        ...style,
      }}
    >
      <div>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(trace.id)}
          className="h-4 w-4 cursor-pointer rounded"
          style={{ borderColor: 'var(--tenant-panel-stroke)', accentColor: 'var(--tenant-accent)' }}
          aria-label={`Select trace ${trace.id}`}
        />
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <div
          className="h-2 w-2 shrink-0 rounded-full"
          style={{
            background: hasError ? 'var(--tenant-danger)' : 'var(--tenant-success)',
            boxShadow: hasError ? '0 0 0 3px color-mix(in srgb, var(--tenant-danger) 16%, transparent)' : 'none',
          }}
        />
        <div className="min-w-0">
          <Link href={`${baseHref}/traces/${trace.id}`} className="block truncate text-[13px] font-medium text-tenant-text-primary hover:underline">
            {trace.agentId}
          </Link>
          <div className="truncate text-[10px] text-tenant-text-muted">
            {hasError ? <span style={{ color: 'var(--tenant-danger)' }}>{errorCount} err</span> : <span style={{ color: 'var(--tenant-success)' }}>OK</span>}
            {storyLabel ? <span> · {storyLabel}</span> : null}
          </div>
        </div>
      </div>

      <div>
        {trace.sessionId ? (
          <Link
            href={isSandbox ? getSandboxSessionHref(trace.sessionId) : `${baseHref}/sessions/${trace.sessionId}`}
            className="font-mono text-[11px] hover:underline"
            style={{ color: 'var(--tenant-accent)' }}
          >
            {trace.sessionId.slice(0, 8)}
          </Link>
        ) : <span className="text-[10px] text-tenant-text-muted">--</span>}
      </div>

      <div><span className="font-mono text-[12px] text-tenant-text-primary">{duration}s</span></div>

      <div>
        <span className="text-[12px] text-tenant-text-primary">{trace.spans.length}</span>
        <span className="ml-0.5 text-[9px] text-tenant-text-muted">({trace.spans.filter((s) => s.kind === 'llm_call').length})</span>
      </div>

      <div>
        {totalCost > 0
          ? <span className="font-mono text-[12px] text-tenant-text-primary">${totalCost.toFixed(4)}</span>
          : <span className="text-[10px] text-tenant-text-muted">--</span>}
      </div>

      <div><span className="text-[11px] text-tenant-text-secondary">{format(new Date(trace.startTimeMs), 'MMM d HH:mm')}</span></div>

      <div className="flex flex-wrap items-center justify-end gap-1">
        <InlineAction href={`${baseHref}/traces/${trace.id}`} variant="primary" className="text-[11px] px-2 py-0.5">
          <Eye className="h-3 w-3" /> Inspect
        </InlineAction>
        <InlineAction href={replayHref} variant="secondary" className="text-[11px] px-2 py-0.5">
          <Play className="h-3 w-3" /> Replay
        </InlineAction>
        {promptHref ? (
          <InlineAction href={promptHref} variant="ghost" className="text-[11px] px-1.5 py-0.5">
            <BookOpen className="h-3 w-3" />
          </InlineAction>
        ) : null}
        <Button variant="outline" size="xs" className="text-[10px] h-6 px-1.5" onClick={() => onSetSlot('a', trace.id)}>Set A</Button>
        <Button variant="outline" size="xs" className="text-[10px] h-6 px-1.5" onClick={() => onSetSlot('b', trace.id)}>Set B</Button>
      </div>
    </div>
  );
}

/* ---------- Table component ---------- */

export function TraceTable({ initialData }: TraceTableProps) {
  const legacyFilters = useFilterStore();
  const segmentFilters = useSegmentStore((state) => state.currentFilters);
  const { status, agentIds, dateRange, searchQuery } = segmentFilters ?? legacyFilters;
  const { selectedTraceIds, toggleTrace, clearSelection, canCompare, setTraceSlot, setComparePair } = useCompareStore();
  const pathname = usePathname();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

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

    const allFuture = initialData.length > 0 && initialData.every((trace) => Number(trace.startTimeMs) > dateRange.end.getTime());
    if (!(isSandbox && allFuture)) {
      filtered = filtered.filter((trace) => {
        const d = new Date(trace.startTimeMs);
        return d >= dateRange.start && d <= dateRange.end;
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((trace) => {
        const md = trace.metadata as { workflow?: string; [k: string]: unknown } | undefined;
        return trace.id.toLowerCase().includes(q) || trace.agentId.toLowerCase().includes(q) || trace.sessionId?.toLowerCase().includes(q) || md?.workflow?.toLowerCase().includes(q);
      });
    }

    return filtered;
  }, [initialData, status, agentIds, dateRange, searchQuery, isSandbox]);

  const defaultDateRange = createDateRangeFromHours(24);
  const hasDateFilter = Math.abs(dateRange.start.getTime() - defaultDateRange.start.getTime()) > 5 * 60 * 1000 || Math.abs(dateRange.end.getTime() - defaultDateRange.end.getTime()) > 5 * 60 * 1000;
  const hasFilters = status !== 'all' || agentIds.length > 0 || searchQuery || hasDateFilter;
  const useVirtual = traces.length >= VIRTUAL_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: useVirtual ? traces.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: useVirtual,
  });

  if (traces.length === 0) {
    const isTrulyEmpty = initialData.length === 0;
    return (
      <WorkbenchPanel title="Trace workbench" description="Use this table to scan recent executions, isolate unhealthy runs, and launch a run comparison from two selected traces.">
        <div className="rounded-lg p-12 text-center" style={{ border: '1px solid var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
          <p className="text-lg font-medium text-tenant-text-primary">
            {isTrulyEmpty || !hasFilters ? 'No traces yet' : 'No traces match your filters'}
          </p>
          <p className="mt-2 text-sm text-tenant-text-muted">
            {isTrulyEmpty || !hasFilters ? 'Traces will appear here once your agents start sending data.' : 'Try adjusting your filters or clearing them to see more results.'}
          </p>
        </div>
      </WorkbenchPanel>
    );
  }

  return (
    <WorkbenchPanel title="Trace workbench" description="Select two runs to compare, inspect recent failures, and move from evidence to investigation.">
      <div className="flex items-center justify-between">
        <div className="text-sm text-tenant-text-secondary">
          Showing <span className="font-medium text-tenant-text-primary">{traces.length}</span> trace{traces.length !== 1 ? 's' : ''}
          {traces.length !== initialData.length && <span style={{ color: 'var(--tenant-text-muted)' }}> (filtered from {initialData.length})</span>}
        </div>
      </div>

      <SelectionSummaryBar selectedCount={selectedTraceIds.length} canCompare={canCompare()} onClear={clearSelection} onCompare={handleCompare} />

      <div className="overflow-hidden rounded-[var(--tenant-radius-panel)] border" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)', boxShadow: 'var(--tenant-shadow-panel)' }}>
        {/* Header */}
        <div className="grid items-center border-b px-3 py-2" style={{ gridTemplateColumns: GRID_COLS, borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
          <span className="sr-only">Select</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Agent</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Session</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Duration</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Spans</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Cost</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Started</span>
          <span className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Actions</span>
        </div>

        {/* Rows */}
        <div ref={scrollRef} className="overflow-y-auto" style={useVirtual ? { maxHeight: `min(${ROW_HEIGHT * 15}px, 60vh)` } : undefined}>
          {useVirtual ? (
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((vr) => (
                <TraceRow key={traces[vr.index]!.id} trace={traces[vr.index]!} style={{ position: 'absolute', top: vr.start, left: 0, right: 0 }} baseHref={baseHref} isSandbox={isSandbox} isSelected={selectedTraceIds.includes(traces[vr.index]!.id)} onToggle={toggleTrace} onSetSlot={handleSetCompareSlot} />
              ))}
            </div>
          ) : (
            traces.map((trace) => (
              <TraceRow key={trace.id} trace={trace} baseHref={baseHref} isSandbox={isSandbox} isSelected={selectedTraceIds.includes(trace.id)} onToggle={toggleTrace} onSetSlot={handleSetCompareSlot} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-3 py-2 text-[11px] text-tenant-text-muted" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
          {traces.length} trace{traces.length !== 1 ? 's' : ''}{selectedTraceIds.length > 0 ? ` · ${selectedTraceIds.length} selected` : ''}{useVirtual ? ' · virtual scrolling' : ''}
        </div>
      </div>
    </WorkbenchPanel>
  );
}
