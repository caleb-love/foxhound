'use client';

import { EventTimeline } from '@/components/charts/event-timeline';
import { MetricTile } from '@/components/charts/metric-tile';
import { TopNList } from '@/components/charts/top-n-list';
import type { TimelineItem, TopListItem } from '@/components/charts/chart-types';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import {
  DashboardPage,
  MetricGrid,
  SplitPanelLayout,
} from '@/components/demo/dashboard-primitives';

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
    description: `${experiment.comparisonSummary}. Winning signal: ${experiment.winningSignal}.`,
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
    <DashboardPage
      eyebrow="Improve · Experiments"
      title="Experiments"
      description="Compare candidate prompts and routing strategies against real trace-derived datasets, then use evaluator signals to decide what is safe to promote."
    >
      <DashboardFilterBar definitions={experimentFilters} />

      <MetricGrid>
        {metrics.map((metric) => (
          <MetricTile key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
        ))}
      </MetricGrid>

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
    </DashboardPage>
  );
}
