'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { Trace } from '@foxhound/types';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { PageContainer, PageHeader } from '@/components/system/page';
import { VerdictBar, MetricChip, MetricStrip, InlineAction } from '@/components/investigation';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { getPromptMetadata } from '@/lib/trace-utils';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { getSandboxPromptDetailHref, getSandboxReplayHref, getSandboxRootHref } from '@/lib/sandbox-routes';
import { Play, Eye, BookOpen } from 'lucide-react';

interface ReplayIndexViewProps {
  traces: Trace[];
  baseHref?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
}

const replayFilters: DashboardFilterDefinition[] = [
  { key: 'searchQuery', kind: 'search', label: 'Search', placeholder: 'Search agents, sessions, or story labels...' },
  {
    key: 'status', kind: 'single-select', label: 'Status',
    options: [
      { value: 'all', label: 'All' },
      { value: 'success', label: 'Healthy' },
      { value: 'error', label: 'Errors' },
    ],
  },
  { key: 'agentIds', kind: 'multi-select', label: 'Agents', options: [] },
  {
    key: 'dateRange', kind: 'date-preset', label: 'Date range',
    presets: [
      { label: 'Last 24h', hours: 24 },
      { label: 'Last 7d', hours: 24 * 7 },
      { label: 'Last 30d', hours: 24 * 30 },
    ],
  },
];

function getReplayHref(baseHref: string, traceId: string) {
  return baseHref === getSandboxRootHref() ? getSandboxReplayHref(traceId) : `${baseHref}/replay/${traceId}`;
}

function getPromptHref(baseHref: string, promptName?: string) {
  if (!promptName) return null;
  if (baseHref === getSandboxRootHref()) return getSandboxPromptDetailHref(promptName);
  return `${baseHref}/prompts?focus=${encodeURIComponent(promptName)}`;
}

export function ReplayIndexView({
  traces,
  baseHref = '',
  eyebrow = 'Investigate',
  title = 'Session Replay',
  description = 'Step through agent executions to find the exact transition point where behavior diverged. Error paths surface first.',
}: ReplayIndexViewProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filterDefinitions = useMemo(() => {
    const options = Array.from(new Set(traces.map((t) => t.agentId))).sort().map((id) => ({ value: id, label: id }));
    return replayFilters.map((d) => (d.key === 'agentIds' ? { ...d, options } : d));
  }, [traces]);

  const rows = useMemo(() => {
    return traces.map((trace) => {
      const hasError = trace.spans.some((s) => s.status === 'error');
      const errorCount = trace.spans.filter((s) => s.status === 'error').length;
      const { promptName, promptVersion } = getPromptMetadata(trace);
      const storyLabel = typeof trace.metadata?.story_label === 'string' ? trace.metadata.story_label : trace.agentId;
      const storySummary = typeof trace.metadata?.story_summary === 'string'
        ? trace.metadata.story_summary
        : `${trace.spans.length} spans, ${hasError ? `${errorCount} error${errorCount > 1 ? 's' : ''}` : 'healthy'}.`;
      const duration = trace.endTimeMs ? ((trace.endTimeMs - trace.startTimeMs) / 1000).toFixed(2) : '--';
      return { trace, hasError, errorCount, promptName, promptVersion, storyLabel, storySummary, duration };
    });
  }, [traces]);

  const filteredRows = filterByDashboardScope(rows, filters, {
    searchableText: (item) => `${item.trace.id} ${item.trace.agentId} ${item.trace.sessionId ?? ''} ${item.storyLabel} ${item.storySummary} ${item.promptName ?? ''}`,
    status: (item) => (item.hasError ? 'error' : 'success'),
    severity: (item) => (item.hasError ? 'critical' : 'healthy'),
    agentIds: (item) => [item.trace.agentId],
  });

  // Sort: errors first, then by recency
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      if (a.hasError && !b.hasError) return -1;
      if (!a.hasError && b.hasError) return 1;
      return Number(b.trace.startTimeMs) - Number(a.trace.startTimeMs);
    });
  }, [filteredRows]);

  const errorRows = sortedRows.filter((r) => r.hasError);
  const healthyRows = sortedRows.filter((r) => !r.hasError);

  // Summary verdict
  const verdictSeverity = errorRows.length > 0 ? 'critical' as const : 'success' as const;
  const verdictHeadline = errorRows.length > 0
    ? `${errorRows.length} error replay${errorRows.length > 1 ? 's' : ''} need investigation`
    : `All ${healthyRows.length} replays are healthy`;
  const topAgent = errorRows.length > 0 ? errorRows[0].trace.agentId : '';
  const verdictSummary = errorRows.length > 0
    ? `${topAgent} has the most recent failures. Open the replay to find the exact step where behavior diverged.`
    : 'No error paths detected in the current replay corpus. Use filters to narrow by agent or date range.';

  return (
    <PageContainer>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <DashboardFilterBar definitions={filterDefinitions} />

      <VerdictBar severity={verdictSeverity} headline={verdictHeadline} summary={verdictSummary} />

      <MetricStrip>
        <MetricChip label="Total" value={String(sortedRows.length)} />
        <MetricChip label="Errors" value={String(errorRows.length)} accent={errorRows.length > 0 ? 'danger' : 'success'} />
        <MetricChip label="Healthy" value={String(healthyRows.length)} accent="success" />
        <MetricChip label="Agents" value={String(new Set(sortedRows.map((r) => r.trace.agentId)).size)} />
      </MetricStrip>

      {/* Error replays */}
      {errorRows.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-tenant-text-primary">
            Error paths ({errorRows.length})
          </h3>
          <div className="space-y-1">
            {errorRows.map((row, idx) => (
              <ReplayRow key={row.trace.id} row={row} baseHref={baseHref} rank={idx + 1} />
            ))}
          </div>
        </div>
      ) : null}

      {/* Healthy replays */}
      {healthyRows.length > 0 ? (
        <details open={errorRows.length === 0}>
          <summary className="cursor-pointer text-sm font-semibold text-tenant-text-secondary hover:text-tenant-text-primary">
            Healthy paths ({healthyRows.length})
          </summary>
          <div className="mt-2 space-y-1">
            {healthyRows.map((row, idx) => (
              <ReplayRow key={row.trace.id} row={row} baseHref={baseHref} rank={errorRows.length + idx + 1} />
            ))}
          </div>
        </details>
      ) : null}
    </PageContainer>
  );
}

/* ---------- Compact replay row ---------- */

interface ReplayRowData {
  trace: Trace;
  hasError: boolean;
  errorCount: number;
  promptName?: string;
  promptVersion?: string | number;
  storyLabel: string;
  storySummary: string;
  duration: string;
}

function ReplayRow({ row, baseHref, rank }: { row: ReplayRowData; baseHref: string; rank: number }) {
  const replayHref = getReplayHref(baseHref, row.trace.id);
  const promptHref = getPromptHref(baseHref, row.promptName);

  return (
    <div
      className="flex items-center gap-3 rounded-[var(--tenant-radius-panel-tight)] border px-3 py-2.5 transition-colors hover:border-[color:color-mix(in_srgb,var(--tenant-accent)_24%,var(--tenant-panel-stroke))]"
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        background: row.hasError
          ? 'color-mix(in srgb, var(--tenant-danger) 4%, var(--card))'
          : 'var(--card)',
        borderLeft: row.hasError ? '3px solid var(--tenant-danger)' : '3px solid transparent',
      }}
    >
      {/* Rank */}
      <span className="w-6 shrink-0 text-center font-mono text-[11px] text-tenant-text-muted">{rank}</span>

      {/* Status dot */}
      <div
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: row.hasError ? 'var(--tenant-danger)' : 'var(--tenant-success)' }}
      />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={replayHref} className="truncate text-sm font-medium text-tenant-text-primary hover:underline">
            {row.storyLabel}
          </Link>
          {row.hasError ? (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: 'color-mix(in srgb, var(--tenant-danger) 14%, var(--card))', color: 'var(--tenant-danger)' }}>
              {row.errorCount} err
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-tenant-text-muted">
          <span>{row.trace.agentId}</span>
          <span>·</span>
          <span>{row.trace.spans.length} spans</span>
          <span>·</span>
          <span>{row.duration}s</span>
          {row.promptName ? (
            <>
              <span>·</span>
              <span>{row.promptName}{row.promptVersion !== undefined ? ` v${row.promptVersion}` : ''}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <InlineAction href={replayHref} variant="primary" className="text-xs">
          <Play className="h-3 w-3" /> Replay
        </InlineAction>
        <InlineAction href={`${baseHref}/traces/${row.trace.id}`} variant="ghost" className="text-xs">
          <Eye className="h-3 w-3" />
        </InlineAction>
        {promptHref ? (
          <InlineAction href={promptHref} variant="ghost" className="text-xs">
            <BookOpen className="h-3 w-3" />
          </InlineAction>
        ) : null}
      </div>
    </div>
  );
}
