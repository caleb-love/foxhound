'use client';

import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { PageContainer, PageHeader } from '@/components/system/page';
import { VerdictBar, MetricChip, MetricStrip, InlineAction, InlineActionBar } from '@/components/investigation';
import { Plus, Play, Eye, CheckSquare } from 'lucide-react';

export interface EvaluatorRecord {
  id: string;
  name: string;
  scoringType: string;
  model: string;
  health: string;
  summary: string;
  enabled?: boolean;
}

interface EvaluatorsDashboardProps {
  evaluators: EvaluatorRecord[];
  baseHref?: string;
}

const evaluatorFilters: DashboardFilterDefinition[] = [
  { key: 'searchQuery', kind: 'search', label: 'Search', placeholder: 'Search evaluators...' },
];

export function EvaluatorsDashboard({ evaluators, baseHref = '' }: EvaluatorsDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filtered = filterByDashboardScope(evaluators, filters, {
    searchableText: (item) => `${item.name} ${item.model} ${item.summary}`,
  });

  const healthyCount = evaluators.filter((e) => e.health === 'healthy').length;
  const warningCount = evaluators.filter((e) => e.health === 'warning' || e.health === 'critical').length;
  const verdictSeverity = evaluators.length === 0 ? 'info' as const : warningCount > 0 ? 'warning' as const : 'success' as const;
  const verdictHeadline = evaluators.length === 0
    ? 'No evaluators configured'
    : `${evaluators.length} evaluator${evaluators.length !== 1 ? 's' : ''} active, ${healthyCount} healthy`;
  const verdictSummary = evaluators.length === 0
    ? 'Create your first evaluator to start scoring agent outputs against quality criteria.'
    : warningCount > 0
      ? `${warningCount} evaluator${warningCount !== 1 ? 's' : ''} showing degraded health. Review the affected evaluators and check recent scoring trends.`
      : 'All evaluators are healthy. Use them with datasets and experiments to validate agent behavior.';

  return (
    <PageContainer>
      <PageHeader eyebrow="Improve" title="Evaluators" description="Configure scoring criteria for agent outputs, then use evaluators to grade dataset cases and experiment runs." />

      <DashboardFilterBar definitions={evaluatorFilters} />

      <VerdictBar
        severity={verdictSeverity}
        headline={verdictHeadline}
        summary={verdictSummary}
        actions={
          <InlineActionBar>
            <InlineAction href={`${baseHref}/evaluators`} variant="primary">
              <Plus className="h-3.5 w-3.5" />
              Create evaluator
            </InlineAction>
            <InlineAction href={`${baseHref}/datasets`} variant="secondary">
              Datasets
            </InlineAction>
            <InlineAction href={`${baseHref}/experiments`} variant="secondary">
              Experiments
            </InlineAction>
          </InlineActionBar>
        }
      />

      <MetricStrip>
        <MetricChip label="Total" value={String(evaluators.length)} />
        <MetricChip label="Healthy" value={String(healthyCount)} accent="success" />
        {warningCount > 0 ? <MetricChip label="Degraded" value={String(warningCount)} accent="warning" /> : null}
      </MetricStrip>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--tenant-radius-panel)] border p-12 text-center" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
          <p className="text-sm text-tenant-text-muted">
            {evaluators.length === 0 ? 'Create your first evaluator to start scoring outputs.' : 'No evaluators match the current filter.'}
          </p>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-[var(--tenant-radius-panel)] border"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}
        >
          <div className="grid items-center border-b px-4 py-2" style={{ gridTemplateColumns: '1fr 100px 100px 80px 140px', borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Evaluator</span>
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Type</span>
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Model</span>
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Health</span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Actions</span>
          </div>

          {filtered.map((evaluator) => (
            <div
              key={evaluator.id}
              className="grid items-center border-b px-4 py-3 transition-colors hover:bg-[color:color-mix(in_srgb,var(--tenant-accent)_4%,var(--card))]"
              style={{ gridTemplateColumns: '1fr 100px 100px 80px 140px', borderColor: 'var(--tenant-panel-stroke)' }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-3.5 w-3.5 shrink-0 text-tenant-accent" />
                  <span className="truncate text-sm font-semibold text-tenant-text-primary">{evaluator.name}</span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-tenant-text-muted">{evaluator.summary}</div>
              </div>

              <div className="text-center">
                <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-secondary)', border: '1px solid var(--tenant-panel-stroke)' }}>
                  {evaluator.scoringType}
                </span>
              </div>

              <div className="text-center text-xs text-tenant-text-muted">{evaluator.model}</div>

              <div className="text-center">
                <div
                  className="mx-auto h-2 w-2 rounded-full"
                  style={{
                    background: evaluator.health === 'healthy' ? 'var(--tenant-success)' : evaluator.health === 'warning' ? 'var(--tenant-warning)' : 'var(--tenant-danger)',
                  }}
                />
              </div>

              <div className="flex items-center justify-end gap-1">
                <InlineAction href={`${baseHref}/evaluators`} variant="primary" className="text-[11px] px-2 py-0.5">
                  <Eye className="h-3 w-3" /> View
                </InlineAction>
                <InlineAction href={`${baseHref}/experiments`} variant="ghost" className="text-[11px] px-2 py-0.5">
                  <Play className="h-3 w-3" /> Run
                </InlineAction>
              </div>
            </div>
          ))}

          <div className="border-t px-4 py-2 text-[11px] text-tenant-text-muted" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
            {filtered.length} evaluator{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
