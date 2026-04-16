'use client';

import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { PageContainer, PageHeader } from '@/components/system/page';
import { VerdictBar, MetricChip, MetricStrip, InlineAction, InlineActionBar } from '@/components/investigation';
import { Eye, GitCompare, AlertTriangle } from 'lucide-react';

export interface RegressionRecord {
  id: string;
  title: string;
  severity: string;
  traceId: string;
  diffPairId: string;
  promptName?: string;
  summary: string;
  detectedAt?: string;
}

interface RegressionsDashboardProps {
  regressions: RegressionRecord[];
  baseHref?: string;
}

const regressionFilters: DashboardFilterDefinition[] = [
  { key: 'searchQuery', kind: 'search', label: 'Search', placeholder: 'Search regressions...' },
];

export function RegressionsDashboard({ regressions, baseHref = '' }: RegressionsDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filtered = filterByDashboardScope(regressions, filters, {
    searchableText: (item) => `${item.title} ${item.summary} ${item.promptName ?? ''}`,
    timestampMs: (item) => (item.detectedAt ? new Date(item.detectedAt).getTime() : undefined),
  });

  const criticalCount = regressions.filter((r) => r.severity === 'critical').length;
  const warningCount = regressions.filter((r) => r.severity === 'warning').length;

  const verdictSeverity = regressions.length === 0 ? 'success' as const : criticalCount > 0 ? 'critical' as const : warningCount > 0 ? 'warning' as const : 'success' as const;
  const verdictHeadline = regressions.length === 0
    ? 'No regressions detected'
    : criticalCount > 0
      ? `${criticalCount} critical regression${criticalCount !== 1 ? 's' : ''} detected`
      : `${regressions.length} regression${regressions.length !== 1 ? 's' : ''} tracked`;
  const verdictSummary = regressions.length === 0
    ? 'No behavior regressions detected in the current monitoring window.'
    : 'Review each regression, compare the baseline vs current behavior, and use experiments to validate fixes.';

  return (
    <PageContainer>
      <PageHeader eyebrow="Govern" title="Regressions" description="Detect behavior drift and structural changes across agent executions. Compare baselines to identify root causes." />

      <DashboardFilterBar definitions={regressionFilters} />

      <VerdictBar
        severity={verdictSeverity}
        headline={verdictHeadline}
        summary={verdictSummary}
        actions={
          <InlineActionBar>
            <InlineAction href={`${baseHref}/traces`} variant="secondary">
              <Eye className="h-3.5 w-3.5" />
              Investigate traces
            </InlineAction>
            <InlineAction href={`${baseHref}/experiments`} variant="secondary">
              Validate with experiment
            </InlineAction>
          </InlineActionBar>
        }
      />

      <MetricStrip>
        <MetricChip label="Total" value={String(regressions.length)} />
        {criticalCount > 0 ? <MetricChip label="Critical" value={String(criticalCount)} accent="danger" /> : null}
        {warningCount > 0 ? <MetricChip label="Warning" value={String(warningCount)} accent="warning" /> : null}
      </MetricStrip>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--tenant-radius-panel)] border p-12 text-center" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
          <p className="text-sm text-tenant-text-muted">
            {regressions.length === 0 ? 'No regressions detected. The fleet is stable.' : 'No regressions match the current filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((regression) => (
            <div
              key={regression.id}
              className="rounded-[var(--tenant-radius-panel-tight)] border px-4 py-3 transition-colors hover:border-[color:color-mix(in_srgb,var(--tenant-accent)_24%,var(--tenant-panel-stroke))]"
              style={{
                borderColor: 'var(--tenant-panel-stroke)',
                background: regression.severity === 'critical'
                  ? 'color-mix(in srgb, var(--tenant-danger) 4%, var(--card))'
                  : 'var(--card)',
                borderLeft: regression.severity === 'critical'
                  ? '3px solid var(--tenant-danger)'
                  : regression.severity === 'warning'
                    ? '3px solid var(--tenant-warning)'
                    : '3px solid transparent',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {regression.severity === 'critical' ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tenant-danger)' }} /> : null}
                    <span className="text-sm font-semibold text-tenant-text-primary">{regression.title}</span>
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                      style={{
                        background: regression.severity === 'critical'
                          ? 'color-mix(in srgb, var(--tenant-danger) 14%, var(--card))'
                          : regression.severity === 'warning'
                            ? 'color-mix(in srgb, var(--tenant-warning) 14%, var(--card))'
                            : 'color-mix(in srgb, var(--tenant-success) 14%, var(--card))',
                        color: regression.severity === 'critical'
                          ? 'var(--tenant-danger)'
                          : regression.severity === 'warning'
                            ? 'var(--tenant-warning)'
                            : 'var(--tenant-success)',
                      }}
                    >
                      {regression.severity}
                    </span>
                  </div>
                  <div className="mt-1 text-[12px] text-tenant-text-secondary">{regression.summary}</div>
                  {regression.promptName ? (
                    <div className="mt-1 text-[11px] text-tenant-text-muted">Prompt: {regression.promptName}</div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <InlineAction href={`${baseHref}/traces/${regression.traceId}`} variant="secondary" className="text-[11px] px-2 py-0.5">
                    <Eye className="h-3 w-3" /> Trace
                  </InlineAction>
                  <InlineAction href={`${baseHref}/diff?a=${regression.diffPairId}&b=${regression.traceId}`} variant="primary" className="text-[11px] px-2 py-0.5">
                    <GitCompare className="h-3 w-3" /> Diff
                  </InlineAction>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
