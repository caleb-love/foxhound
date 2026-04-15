'use client';

import { EventTimeline } from '@/components/charts/event-timeline';
import { MetricTile } from '@/components/charts/metric-tile';
import { TopNList } from '@/components/charts/top-n-list';
import type { TimelineItem, TopListItem } from '@/components/charts/chart-types';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { PageContainer, PageHeader, RecordBody, SectionPanel } from '@/components/system/page';
import { WorkbenchPanel } from '@/components/system/workbench';
import { SplitPanelLayout } from '@/components/sandbox/primitives';

export interface DatasetMetric {
  label: string;
  value: string;
  supportingText: string;
}

export interface DatasetRecord {
  name: string;
  itemCount: number;
  sourceSummary: string;
  lastUpdated: string;
  scoreSignal: string;
  traceHref: string;
  evaluatorsHref: string;
  experimentHref: string;
}

interface DatasetsDashboardProps {
  metrics: DatasetMetric[];
  datasets: DatasetRecord[];
  nextActions: Array<{
    title: string;
    description: string;
    href: string;
    cta: string;
  }>;
}

const datasetFilters: DashboardFilterDefinition[] = [
  {
    key: 'searchQuery',
    kind: 'search',
    label: 'Search',
    placeholder: 'Search datasets, source signals, or trace lineage...',
  },
  {
    key: 'datasetIds',
    kind: 'multi-select',
    label: 'Datasets',
    options: [
      { value: 'onboarding-regressions', label: 'onboarding-regressions' },
      { value: 'support-latency-outliers', label: 'support-latency-outliers' },
      { value: 'planner-behavior-drift', label: 'planner-behavior-drift' },
    ],
  },
];

function toDatasetTimelineItems(datasets: DatasetRecord[]): TimelineItem[] {
  return datasets.map((dataset) => ({
    title: dataset.name,
    description: `${dataset.sourceSummary}. Primary signal: ${dataset.scoreSignal}. Last updated: ${dataset.lastUpdated}.`,
    status: 'healthy',
    href: dataset.traceHref,
    cta: 'Review source traces',
    meta: `${dataset.itemCount} cases`,
  }));
}

function toActionItems(actions: Array<{ title: string; description: string; href: string; cta: string }>): TopListItem[] {
  return actions.map((action) => ({
    title: action.title,
    description: action.description,
    href: action.href,
  }));
}

export function DatasetsDashboard({
  metrics,
  datasets,
  nextActions,
}: DatasetsDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filteredDatasets = filterByDashboardScope(datasets, filters, {
    searchableText: (item) => `${item.name} ${item.sourceSummary} ${item.scoreSignal}`,
    datasetIds: (item) => [item.name],
  }).filter((item) => (filters.datasetIds.length === 0 ? true : filters.datasetIds.includes(item.name)));

  const filteredNextActions = filterByDashboardScope(nextActions, filters, {
    searchableText: (item) => `${item.title} ${item.description}`,
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Improve"
        title="Datasets"
        description="Turn production failures and low-scoring traces into reusable evaluation cases, then push them into experiment workflows to improve prompts, routing, and agent behavior."
      >
        <div
          className="inline-flex items-center rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)', color: 'var(--tenant-text-secondary)' }}
        >
          Evidence workbench
        </div>
      </PageHeader>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.24fr)_minmax(320px,0.76fr)]">
        <SectionPanel
          title="Read dataset posture before you trust the experiment loop"
          description="This page should frame datasets as the evidence backbone of the Improve family. Show collection posture first, then filtering, then the strongest signals and next build paths."
        >
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
            ))}
          </section>
        </SectionPanel>

        <SectionPanel
          title="Filter dataset posture"
          description="Slice by dataset lineage before widening the evaluation and experiment review."
        >
          <DashboardFilterBar definitions={datasetFilters} />
        </SectionPanel>
      </section>

      <WorkbenchPanel
        title="Dataset improvement workbench"
        description="Use trace-derived datasets to connect production evidence to evaluator coverage and experiment decisions without leaving the improvement workflow."
      >
        <SplitPanelLayout
          main={
            <EventTimeline
              title="Improvement datasets"
              description="Datasets derived from trace evidence and ready for evaluation or experimentation."
              items={toDatasetTimelineItems(filteredDatasets)}
            />
          }
          side={
            <TopNList
              title="Recommended next actions"
              description="Keep the improve loop moving from trace evidence to validated changes."
              items={toActionItems(filteredNextActions)}
            />
          }
        />

        <SectionPanel
          title="Dataset triage framing"
          description="A compact interpretation layer between posture metrics and dataset records, so operators can see what evidence is strongest, what signal produced it, and where to route it next."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {filteredDatasets.map((dataset) => (
              <div
                key={dataset.name}
                className="rounded-[var(--tenant-radius-panel)] border p-4"
                style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
                  {dataset.itemCount} cases · {dataset.lastUpdated}
                </div>
                <div className="mt-2 font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{dataset.name}</div>
                <div className="mt-3">
                  <RecordBody>{dataset.sourceSummary}</RecordBody>
                </div>
                <div className="mt-3 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
                  Primary signal: {dataset.scoreSignal}
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      </WorkbenchPanel>
    </PageContainer>
  );
}
