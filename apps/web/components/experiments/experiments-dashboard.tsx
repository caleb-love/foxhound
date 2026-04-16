'use client';

import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { PageContainer, PageHeader } from '@/components/system/page';
import { VerdictBar, MetricChip, MetricStrip, InlineAction, InlineActionBar } from '@/components/investigation';
import { Plus, Eye, Beaker } from 'lucide-react';

export interface ExperimentRecord {
  id: string;
  name: string;
  datasetId: string;
  status: string;
  summary: string;
  winningCandidate?: string;
}

interface ExperimentsDashboardProps {
  experiments: ExperimentRecord[];
  baseHref?: string;
}

const experimentFilters: DashboardFilterDefinition[] = [
  { key: 'searchQuery', kind: 'search', label: 'Search', placeholder: 'Search experiments...' },
];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  completed: { bg: 'color-mix(in srgb, var(--tenant-success) 14%, var(--card))', color: 'var(--tenant-success)' },
  running: { bg: 'color-mix(in srgb, var(--tenant-accent) 14%, var(--card))', color: 'var(--tenant-accent)' },
  pending: { bg: 'color-mix(in srgb, var(--tenant-warning) 14%, var(--card))', color: 'var(--tenant-warning)' },
  failed: { bg: 'color-mix(in srgb, var(--tenant-danger) 14%, var(--card))', color: 'var(--tenant-danger)' },
};

export function ExperimentsDashboard({ experiments, baseHref = '' }: ExperimentsDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filtered = filterByDashboardScope(experiments, filters, {
    searchableText: (item) => `${item.name} ${item.summary} ${item.winningCandidate ?? ''}`,
  });

  const completedCount = experiments.filter((e) => e.status === 'completed').length;
  const runningCount = experiments.filter((e) => e.status === 'running' || e.status === 'pending').length;
  const failedCount = experiments.filter((e) => e.status === 'failed').length;
  const withWinner = experiments.filter((e) => e.winningCandidate).length;

  const verdictSeverity = experiments.length === 0 ? 'info' as const : failedCount > 0 ? 'warning' as const : 'success' as const;
  const verdictHeadline = experiments.length === 0
    ? 'No experiments yet'
    : `${experiments.length} experiment${experiments.length !== 1 ? 's' : ''}, ${completedCount} completed`;
  const verdictSummary = experiments.length === 0
    ? 'Create an experiment by selecting a dataset and configuring candidate prompts or routing changes.'
    : withWinner > 0
      ? `${withWinner} experiment${withWinner !== 1 ? 's' : ''} have a winning candidate ready for promotion.`
      : runningCount > 0
        ? `${runningCount} experiment${runningCount !== 1 ? 's' : ''} currently running. Results will appear when complete.`
        : 'Review completed experiments and promote winning candidates.';

  return (
    <PageContainer>
      <PageHeader eyebrow="Improve" title="Experiments" description="Compare prompt candidates, routing changes, and model swaps against your datasets to find the best configuration." />

      <DashboardFilterBar definitions={experimentFilters} />

      <VerdictBar
        severity={verdictSeverity}
        headline={verdictHeadline}
        summary={verdictSummary}
        actions={
          <InlineActionBar>
            <InlineAction href={`${baseHref}/experiments`} variant="primary">
              <Plus className="h-3.5 w-3.5" />
              New experiment
            </InlineAction>
            <InlineAction href={`${baseHref}/datasets`} variant="secondary">
              Datasets
            </InlineAction>
            <InlineAction href={`${baseHref}/evaluators`} variant="secondary">
              Evaluators
            </InlineAction>
          </InlineActionBar>
        }
      />

      <MetricStrip>
        <MetricChip label="Total" value={String(experiments.length)} />
        <MetricChip label="Completed" value={String(completedCount)} accent="success" />
        {runningCount > 0 ? <MetricChip label="Running" value={String(runningCount)} accent="warning" /> : null}
        {failedCount > 0 ? <MetricChip label="Failed" value={String(failedCount)} accent="danger" /> : null}
        {withWinner > 0 ? <MetricChip label="With winner" value={String(withWinner)} accent="success" /> : null}
      </MetricStrip>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--tenant-radius-panel)] border p-12 text-center" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
          <p className="text-sm text-tenant-text-muted">
            {experiments.length === 0 ? 'Create your first experiment to compare candidates.' : 'No experiments match the current filter.'}
          </p>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-[var(--tenant-radius-panel)] border"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}
        >
          <div className="grid items-center border-b px-4 py-2" style={{ gridTemplateColumns: '1fr 80px 100px 100px', borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Experiment</span>
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Status</span>
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Winner</span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Actions</span>
          </div>

          {filtered.map((experiment) => {
            const statusStyle = STATUS_COLORS[experiment.status] ?? STATUS_COLORS.pending;
            return (
              <div
                key={experiment.id}
                className="grid items-center border-b px-4 py-3 transition-colors hover:bg-[color:color-mix(in_srgb,var(--tenant-accent)_4%,var(--card))]"
                style={{ gridTemplateColumns: '1fr 80px 100px 100px', borderColor: 'var(--tenant-panel-stroke)' }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Beaker className="h-3.5 w-3.5 shrink-0 text-tenant-accent" />
                    <span className="truncate text-sm font-semibold text-tenant-text-primary">{experiment.name}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-tenant-text-muted">{experiment.summary}</div>
                </div>

                <div className="text-center">
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                    {experiment.status}
                  </span>
                </div>

                <div className="text-center text-xs text-tenant-text-muted">
                  {experiment.winningCandidate ?? '--'}
                </div>

                <div className="flex items-center justify-end gap-1">
                  <InlineAction href={`${baseHref}/experiments/${experiment.id}`} variant="primary" className="text-[11px] px-2 py-0.5">
                    <Eye className="h-3 w-3" /> View
                  </InlineAction>
                </div>
              </div>
            );
          })}

          <div className="border-t px-4 py-2 text-[11px] text-tenant-text-muted" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
            {filtered.length} experiment{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
