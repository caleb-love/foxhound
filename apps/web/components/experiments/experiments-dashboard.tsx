'use client';

import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { PageContainer, PageHeader } from '@/components/system/page';
import { DataGrid, DataGridBody, DataGridCell, DataGridFooter, DataGridHead, DataGridHeader, DataGridRow, VerdictBar, MetricChip, MetricStrip, InlineAction, InlineActionBar } from '@/components/investigation';
import { Plus, Eye, Beaker, GitCompare } from 'lucide-react';
import { CompareExperimentsDialog } from './experiment-compare-actions';
import { ComparisonScorecard } from '@/components/charts/comparison-scorecard';
import { createDateRangeFromHours } from '@/lib/stores/dashboard-filter-presets';

export interface ExperimentRecord {
  id: string;
  name: string;
  datasetId: string;
  status: string;
  summary: string;
  winningCandidate?: string;
  createdAt?: string;
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
  const defaultDateRange = createDateRangeFromHours(24);
  const hasExplicitDateFilter =
    Math.abs(filters.dateRange.start.getTime() - defaultDateRange.start.getTime()) > 5 * 60 * 1000 ||
    Math.abs(filters.dateRange.end.getTime() - defaultDateRange.end.getTime()) > 5 * 60 * 1000;

  const filtered = filterByDashboardScope(experiments, filters, {
    searchableText: (item) => `${item.name} ${item.summary} ${item.winningCandidate ?? ''}`,
    timestampMs: hasExplicitDateFilter ? (item) => (item.createdAt ? new Date(item.createdAt).getTime() : undefined) : undefined,
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
  const completedExperiments = experiments.filter((experiment) => experiment.status === 'completed');
  const suggestedComparisonPair = completedExperiments.length >= 2
    ? completedExperiments.slice(0, 2).map((experiment) => experiment.id).join(',')
    : null;

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
            {suggestedComparisonPair ? (
              <InlineAction href={`${baseHref}/experiments/compare?experimentIds=${encodeURIComponent(suggestedComparisonPair)}`} variant="secondary">
                <GitCompare className="h-3.5 w-3.5" />
                Compare top pair
              </InlineAction>
            ) : null}
            {completedExperiments.length >= 2 ? (
              <CompareExperimentsDialog experiments={completedExperiments} baseHref={baseHref} />
            ) : null}
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

      <ComparisonScorecard
        title="Candidate readiness"
        description="Read whether the current experiment set is actually decision-ready, not just numerically complete."
        items={[
          {
            label: 'Promotion-ready',
            current: String(withWinner),
            supportingText: `${withWinner} completed experiment${withWinner === 1 ? '' : 's'} currently advertise a winning candidate.`,
            tone: withWinner > 0 ? 'healthy' : 'warning',
          },
          {
            label: 'Still running',
            current: String(runningCount),
            supportingText: 'These candidates still need more evidence before they should influence release decisions.',
            tone: runningCount > 0 ? 'warning' : 'healthy',
          },
          {
            label: 'Failed runs',
            current: String(failedCount),
            supportingText: 'Failures should be explained before a winner narrative is trusted.',
            tone: failedCount > 0 ? 'critical' : 'healthy',
          },
          {
            label: 'Segment-ready view',
            current: filters.agentIds.length > 0 ? 'Scoped' : 'All traffic',
            supportingText: filters.agentIds.length > 0 ? `Current segment narrows analytics to ${filters.agentIds.length} agent scope(s).` : 'No agent segmentation is active, so the readiness view is fleet-wide.',
            tone: filters.agentIds.length > 0 ? 'warning' : 'default',
          },
        ]}
      />

      {filtered.length === 0 ? (
        <div className="rounded-[var(--tenant-radius-panel)] border p-12 text-center" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
          <p className="text-sm text-tenant-text-muted">
            {experiments.length === 0 ? 'Create your first experiment to compare candidates.' : 'No experiments match the current filter.'}
          </p>
        </div>
      ) : (
        <DataGrid>
          <DataGridHeader columns="minmax(0,1fr) 88px 120px minmax(180px,auto)">
            <DataGridHead>Experiment</DataGridHead>
            <DataGridHead className="text-center">Status</DataGridHead>
            <DataGridHead className="text-center">Winner</DataGridHead>
            <DataGridHead className="text-right">Actions</DataGridHead>
          </DataGridHeader>

          <DataGridBody>
            {filtered.map((experiment) => {
              const statusStyle = STATUS_COLORS[experiment.status] ?? STATUS_COLORS.pending;
              return (
                <DataGridRow key={experiment.id} columns="minmax(0,1fr) 88px 120px minmax(180px,auto)">
                  <DataGridCell>
                    <div className="flex items-center gap-2">
                      <Beaker className="h-3.5 w-3.5 shrink-0 text-tenant-accent" />
                      <span className="truncate text-sm font-semibold text-tenant-text-primary">{experiment.name}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-tenant-text-muted">{experiment.summary}</div>
                  </DataGridCell>

                  <DataGridCell className="text-center">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                      {experiment.status}
                    </span>
                  </DataGridCell>

                  <DataGridCell className="text-center text-xs text-tenant-text-muted">
                    {experiment.winningCandidate ?? '--'}
                  </DataGridCell>

                  <DataGridCell className="flex items-center justify-end gap-1 whitespace-nowrap">
                    <InlineAction href={`${baseHref}/experiments/${experiment.id}`} variant="primary" className="text-[11px] px-2 py-0.5">
                      <Eye className="h-3 w-3" /> View
                    </InlineAction>
                    {experiment.status === 'completed' ? (
                      <InlineAction href={`${baseHref}/experiments/compare?experimentIds=${encodeURIComponent(experiment.id)}`} variant="ghost" className="text-[11px] px-2 py-0.5">
                        <GitCompare className="h-3 w-3" /> Compare
                      </InlineAction>
                    ) : null}
                  </DataGridCell>
                </DataGridRow>
              );
            })}
          </DataGridBody>

          <DataGridFooter>
            {filtered.length} experiment{filtered.length !== 1 ? 's' : ''}
          </DataGridFooter>
        </DataGrid>
      )}
    </PageContainer>
  );
}
