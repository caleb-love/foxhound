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

export interface EvaluatorMetric {
  label: string;
  value: string;
  supportingText: string;
}

export interface EvaluatorRecord {
  name: string;
  scoringType: 'numeric' | 'categorical';
  model: string;
  lastRunStatus: 'healthy' | 'warning' | 'critical';
  adoptionSummary: string;
  lastRunSummary: string;
  tracesHref: string;
  datasetsHref: string;
  experimentsHref: string;
  compareHref?: string;
}

interface EvaluatorsDashboardProps {
  metrics: EvaluatorMetric[];
  evaluators: EvaluatorRecord[];
  nextActions: Array<{
    title: string;
    description: string;
    href: string;
    cta: string;
  }>;
}

const evaluatorFilters: DashboardFilterDefinition[] = [
  {
    key: 'searchQuery',
    kind: 'search',
    label: 'Search',
    placeholder: 'Search evaluators, models, or scoring coverage...',
  },
  {
    key: 'severity',
    kind: 'single-select',
    label: 'Severity',
    options: [
      { value: 'all', label: 'All severities' },
      { value: 'healthy', label: 'Healthy' },
      { value: 'warning', label: 'Warning' },
      { value: 'critical', label: 'Critical' },
    ],
  },
  {
    key: 'models',
    kind: 'multi-select',
    label: 'Models',
    options: [
      { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
      { value: 'claude-3-5-sonnet', label: 'claude-3-5-sonnet' },
      { value: 'gpt-4o', label: 'gpt-4o' },
    ],
  },
];

function toEvaluatorTimelineItems(evaluators: EvaluatorRecord[]): TimelineItem[] {
  return evaluators.map((evaluator) => ({
    title: evaluator.name,
    description: `${evaluator.adoptionSummary}. ${evaluator.lastRunSummary}. Model: ${evaluator.model}.`,
    status: evaluator.lastRunStatus,
    href: evaluator.tracesHref,
    cta: 'Review traces',
    meta: evaluator.scoringType,
  }));
}

function toActionItems(actions: Array<{ title: string; description: string; href: string; cta: string }>): TopListItem[] {
  return actions.map((action) => ({
    title: action.title,
    description: action.description,
    href: action.href,
  }));
}

export function EvaluatorsDashboard({
  metrics,
  evaluators,
  nextActions,
}: EvaluatorsDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filteredEvaluators = filterByDashboardScope(evaluators, filters, {
    searchableText: (item) => `${item.name} ${item.model} ${item.adoptionSummary} ${item.lastRunSummary}`,
    severity: (item) => item.lastRunStatus,
    status: (item) => item.lastRunStatus,
    models: (item) => [item.model],
  });

  const filteredNextActions = filterByDashboardScope(nextActions, filters, {
    searchableText: (item) => `${item.title} ${item.description}`,
  });

  return (
    <DashboardPage
      eyebrow="Improve · Evaluators"
      title="Evaluators"
      description="Monitor evaluator health, understand scoring adoption, and keep the improve loop moving from production traces to datasets, experiments, and release decisions."
    >
      <DashboardFilterBar definitions={evaluatorFilters} />

      <MetricGrid>
        {metrics.map((metric) => (
          <MetricTile key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
        ))}
      </MetricGrid>

      <SplitPanelLayout
        main={
          <EventTimeline
            title="Evaluator coverage"
            description="Which evaluators are active, what they score, and where to investigate weak signals next."
            items={toEvaluatorTimelineItems(filteredEvaluators)}
          />
        }
        side={
          <TopNList
            title="Recommended next actions"
            description="Tighten evaluation coverage before promoting a change or dismissing a regression."
            items={toActionItems(filteredNextActions)}
          />
        }
      />
    </DashboardPage>
  );
}
