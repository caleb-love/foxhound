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

export interface ExperimentMetric {
  label: string;
  value: string;
  supportingText: string;
}

export interface ExperimentRecord {
  name: string;
  status: 'running' | 'completed' | 'warning';
  dataset: string;
  comparisonSummary: string;
  lastUpdated: string;
  winningSignal: string;
  datasetHref: string;
  evaluatorsHref: string;
  tracesHref: string;
  promoteHref?: string;
}

interface ExperimentsDashboardProps {
  metrics: ExperimentMetric[];
  experiments: ExperimentRecord[];
  nextActions: Array<{
    title: string;
    description: string;
    href: string;
    cta: string;
  }>;
}

const experimentFilters: DashboardFilterDefinition[] = [
  {
    key: 'searchQuery',
    kind: 'search',
    label: 'Search',
    placeholder: 'Search experiments, datasets, or winning signals...',
  },
  {
    key: 'status',
    kind: 'single-select',
    label: 'Status',
    options: [
      { value: 'all', label: 'All statuses' },
      { value: 'success', label: 'Healthy/completed' },
      { value: 'error', label: 'Running/warning' },
    ],
  },
  {
    key: 'datasetIds',
    kind: 'multi-select',
    label: 'Datasets',
    options: [
      { value: 'support-latency-outliers', label: 'support-latency-outliers' },
      { value: 'onboarding-regressions', label: 'onboarding-regressions' },
      { value: 'planner-behavior-drift', label: 'planner-behavior-drift' },
    ],
  },
];

function mapExperimentStatus(status: ExperimentRecord['status']): 'healthy' | 'warning' | 'critical' {
  if (status === 'completed') return 'healthy';
  if (status === 'running') return 'warning';
  return 'critical';
}

function toExperimentTimelineItems(experiments: ExperimentRecord[]): TimelineItem[] {
  return experiments.map((experiment) => ({
    title: experiment.name,
    description: `${experiment.comparisonSummary}. Winning signal: ${experiment.winningSignal}. Last updated: ${experiment.lastUpdated}.`,
    status: mapExperimentStatus(experiment.status),
    href: experiment.tracesHref,
    cta: 'Inspect traces',
    meta: experiment.dataset,
  }));
}

function toActionItems(actions: Array<{ title: string; description: string; href: string; cta: string }>): TopListItem[] {
  return actions.map((action) => ({
    title: action.title,
    description: action.description,
    href: action.href,
  }));
}

export function ExperimentsDashboard({
  metrics,
  experiments,
  nextActions,
}: ExperimentsDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filteredExperiments = filterByDashboardScope(experiments, filters, {
    searchableText: (item) => `${item.name} ${item.dataset} ${item.comparisonSummary} ${item.winningSignal}`,
    status: (item) => mapExperimentStatus(item.status),
    severity: (item) => mapExperimentStatus(item.status),
    models: () => [],
    promptIds: () => [],
  }).filter((item) => (filters.datasetIds.length === 0 ? true : filters.datasetIds.includes(item.dataset)));

  const filteredNextActions = filterByDashboardScope(nextActions, filters, {
    searchableText: (item) => `${item.title} ${item.description}`,
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Improve"
        title="Experiments"
        description="Compare candidate prompts and routing strategies against real trace-derived datasets, then use evaluator signals to decide what is safe to promote."
      >
        <div
          className="inline-flex items-center rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)', color: 'var(--tenant-text-secondary)' }}
        >
          Promotion workbench
        </div>
      </PageHeader>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.24fr)_minmax(320px,0.76fr)]">
        <SectionPanel
          title="Read experiment posture before you promote"
          description="This page should turn experiment results into promotion confidence. Show the portfolio first, then the filter state, then the best evidence and next validation route."
        >
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
            ))}
          </section>
        </SectionPanel>

        <SectionPanel
          title="Filter experiment posture"
          description="Slice by dataset or status before widening the comparison review."
        >
          <DashboardFilterBar definitions={experimentFilters} />
        </SectionPanel>
      </section>

      <WorkbenchPanel
        title="Experiment comparison workbench"
        description="Use this surface to compare candidate changes against trace-derived datasets, review evaluator-backed outcomes, and decide what is safe to promote."
      >
        <SplitPanelLayout
          main={
            <EventTimeline
              title="Active experiment comparisons"
              description="Compare what changed, which candidate is winning, and where to verify before promotion."
              items={toExperimentTimelineItems(filteredExperiments)}
            />
          }
          side={
            <TopNList
              title="Recommended next actions"
              description="Keep comparison work grounded in trace evidence and evaluator signals."
              items={toActionItems(filteredNextActions)}
            />
          }
        />

        <SectionPanel
          title="Promotion triage framing"
          description="A compact interpretation layer between posture metrics and experiment records, so operators can see which candidates are credible, what evidence is missing, and where validation should continue."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {filteredExperiments.map((experiment) => (
              <div
                key={experiment.name}
                className="rounded-[var(--tenant-radius-panel)] border p-4"
                style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
                  {experiment.dataset} · {experiment.lastUpdated}
                </div>
                <div className="mt-2 font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{experiment.name}</div>
                <div className="mt-3">
                  <RecordBody>{experiment.comparisonSummary}</RecordBody>
                </div>
                <div className="mt-3 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
                  Winning signal: {experiment.winningSignal}
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      </WorkbenchPanel>
    </PageContainer>
  );
}
