'use client';

import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { PageContainer, PageHeader } from '@/components/system/page';
import { WorkbenchPanel } from '@/components/system/workbench';
import { VerdictBar, MetricChip, MetricStrip, InlineAction, InlineActionBar } from '@/components/investigation';
import { Plus, FlaskConical, Eye, Database } from 'lucide-react';

export interface DatasetRecord {
  id: string;
  name: string;
  description?: string;
  itemCount: number;
  sourceTraceIds?: string[];
}

interface DatasetsDashboardProps {
  datasets: DatasetRecord[];
  baseHref?: string;
}

const datasetFilters: DashboardFilterDefinition[] = [
  { key: 'searchQuery', kind: 'search', label: 'Search', placeholder: 'Search datasets...' },
];

export function DatasetsDashboard({ datasets, baseHref = '' }: DatasetsDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filtered = filterByDashboardScope(datasets, filters, {
    searchableText: (item) => `${item.name} ${item.description ?? ''}`,
  });

  const totalCases = datasets.reduce((sum, d) => sum + d.itemCount, 0);
  const verdictSeverity = datasets.length === 0 ? 'info' as const : 'success' as const;
  const verdictHeadline = datasets.length === 0
    ? 'No datasets yet'
    : `${datasets.length} dataset${datasets.length !== 1 ? 's' : ''} with ${totalCases} total cases`;
  const verdictSummary = datasets.length === 0
    ? 'Create your first dataset from production traces to start the evaluation loop.'
    : 'Use these datasets to run evaluators and experiments, then promote winning candidates.';

  return (
    <PageContainer>
      <PageHeader eyebrow="Improve" title="Datasets" description="Turn production failures into reusable evaluation cases, then push them into experiment workflows." />

      <DashboardFilterBar definitions={datasetFilters} />

      <VerdictBar
        severity={verdictSeverity}
        headline={verdictHeadline}
        summary={verdictSummary}
        actions={
          <InlineActionBar>
            <InlineAction href={`${baseHref}/traces`} variant="primary">
              <Plus className="h-3.5 w-3.5" />
              Create from traces
            </InlineAction>
            <InlineAction href={`${baseHref}/evaluators`} variant="secondary">
              <FlaskConical className="h-3.5 w-3.5" />
              Evaluators
            </InlineAction>
            <InlineAction href={`${baseHref}/experiments`} variant="secondary">
              <FlaskConical className="h-3.5 w-3.5" />
              Experiments
            </InlineAction>
          </InlineActionBar>
        }
      />

      <MetricStrip>
        <MetricChip label="Datasets" value={String(datasets.length)} />
        <MetricChip label="Total cases" value={String(totalCases)} />
        <MetricChip label="Linked traces" value={String(new Set(datasets.flatMap((d) => d.sourceTraceIds ?? [])).size)} />
      </MetricStrip>

      {filtered.length === 0 ? (
        <WorkbenchPanel title="Datasets" description="No datasets match your search.">
          <div className="py-12 text-center text-sm text-tenant-text-muted">
            {datasets.length === 0
              ? 'Create your first dataset by selecting traces and adding them as evaluation cases.'
              : 'No datasets match the current filter. Try adjusting your search.'}
          </div>
        </WorkbenchPanel>
      ) : (
        <div
          className="overflow-hidden rounded-[var(--tenant-radius-panel)] border"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}
        >
          {/* Header */}
          <div
            className="grid items-center border-b px-4 py-2"
            style={{ gridTemplateColumns: '1fr 80px 100px 140px', borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Dataset</span>
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Cases</span>
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Sources</span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Actions</span>
          </div>

          {/* Rows */}
          {filtered.map((dataset) => (
            <div
              key={dataset.id}
              className="grid items-center border-b px-4 py-3 transition-colors hover:bg-[color:color-mix(in_srgb,var(--tenant-accent)_4%,var(--card))]"
              style={{ gridTemplateColumns: '1fr 80px 100px 140px', borderColor: 'var(--tenant-panel-stroke)' }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 shrink-0 text-tenant-accent" />
                  <span className="truncate text-sm font-semibold text-tenant-text-primary">{dataset.name}</span>
                </div>
                {dataset.description ? (
                  <div className="mt-0.5 truncate text-[11px] text-tenant-text-muted">{dataset.description}</div>
                ) : null}
              </div>

              <div className="text-center">
                <span className="text-sm font-medium text-tenant-text-primary">{dataset.itemCount}</span>
              </div>

              <div className="text-center">
                <span className="text-xs text-tenant-text-muted">{dataset.sourceTraceIds?.length ?? 0} traces</span>
              </div>

              <div className="flex items-center justify-end gap-1">
                <InlineAction href={`${baseHref}/datasets/${dataset.id}`} variant="primary" className="text-[11px] px-2 py-0.5">
                  <Eye className="h-3 w-3" /> View
                </InlineAction>
                <InlineAction href={`${baseHref}/experiments`} variant="ghost" className="text-[11px] px-2 py-0.5">
                  <FlaskConical className="h-3 w-3" /> Run
                </InlineAction>
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="border-t px-4 py-2 text-[11px] text-tenant-text-muted" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
            {filtered.length} dataset{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
