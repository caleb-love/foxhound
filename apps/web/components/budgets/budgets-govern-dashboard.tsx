'use client';

import { EventTimeline } from '@/components/charts/event-timeline';
import { MetricTile } from '@/components/charts/metric-tile';
import { TopNList } from '@/components/charts/top-n-list';
import { TrendChart } from '@/components/charts/trend-chart';
import type { TimelineItem, TopListItem, TrendSeries } from '@/components/charts/chart-types';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { PageContainer, PageHeader } from '@/components/system/page';
import { WorkbenchPanel } from '@/components/system/workbench';
import { SplitPanelLayout } from '@/components/sandbox/primitives';

export interface BudgetMetric {
  label: string;
  value: string;
  supportingText: string;
}

export interface BudgetRiskRecord {
  agent: string;
  status: 'warning' | 'critical' | 'healthy';
  spend: string;
  budget: string;
  description: string;
  tracesHref: string;
  regressionsHref: string;
  improveHref: string;
}

interface BudgetsGovernDashboardProps {
  metrics: BudgetMetric[];
  hotspots: BudgetRiskRecord[];
  nextActions: Array<{
    title: string;
    description: string;
    href: string;
    cta: string;
  }>;
}

function toHotspotTimelineItems(hotspots: BudgetRiskRecord[]): TimelineItem[] {
  return hotspots.map((hotspot) => ({
    title: hotspot.agent,
    description: `${hotspot.description} Spend: ${hotspot.spend}. Budget: ${hotspot.budget}.`,
    status: hotspot.status,
    href: hotspot.tracesHref,
    cta: 'Review traces',
    meta: `${hotspot.spend} / ${hotspot.budget}`,
  }));
}

function toActionItems(actions: Array<{ title: string; description: string; href: string; cta: string }>): TopListItem[] {
  return actions.map((action) => ({
    title: action.title,
    description: action.description,
    href: action.href,
  }));
}

const budgetFilters: DashboardFilterDefinition[] = [
  {
    key: 'searchQuery',
    kind: 'search',
    label: 'Search',
    placeholder: 'Search budgets, agents, or hotspots...',
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
    key: 'agentIds',
    kind: 'multi-select',
    label: 'Agents',
    options: [
      { value: 'planner-agent', label: 'planner-agent' },
      { value: 'support-agent', label: 'support-agent' },
      { value: 'onboarding-router', label: 'onboarding-router' },
    ],
  },
  {
    key: 'models',
    kind: 'multi-select',
    label: 'Models',
    options: [
      { value: 'claude-3-5-sonnet', label: 'claude-3-5-sonnet' },
      { value: 'gpt-4o', label: 'gpt-4o' },
      { value: 'claude-3-haiku', label: 'claude-3-haiku' },
    ],
  },
  {
    key: 'dateRange',
    kind: 'date-preset',
    label: 'Date range',
    presets: [
      { label: 'Last 24h', hours: 24 },
      { label: 'Last 7d', hours: 24 * 7 },
      { label: 'Last 30d', hours: 24 * 30 },
    ],
  },
];

const budgetTrendSeries: TrendSeries[] = [
  {
    id: 'monthly-spend',
    label: 'Monthly spend trend',
    tone: 'warning',
    values: [
      { label: 'Mon', value: 240 },
      { label: 'Tue', value: 272 },
      { label: 'Wed', value: 301 },
      { label: 'Thu', value: 336 },
      { label: 'Fri', value: 418 },
    ],
  },
  {
    id: 'at-risk-budgets',
    label: 'At-risk budgets',
    tone: 'critical',
    values: [
      { label: 'Mon', value: 1 },
      { label: 'Tue', value: 1 },
      { label: 'Wed', value: 2 },
      { label: 'Thu', value: 2 },
      { label: 'Fri', value: 2 },
    ],
  },
];

export function BudgetsGovernDashboard({
  metrics,
  hotspots,
  nextActions,
}: BudgetsGovernDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filteredHotspots = filterByDashboardScope(hotspots, filters, {
    searchableText: (item) => `${item.agent} ${item.description} ${item.spend} ${item.budget}`,
    severity: (item) => item.status,
    status: (item) => item.status,
    agentIds: (item) => [item.agent],
    models: (item) =>
      item.agent === 'planner-agent'
        ? ['claude-3-5-sonnet']
        : item.agent === 'support-agent'
          ? ['gpt-4o']
          : ['claude-3-haiku'],
  });

  const filteredNextActions = filterByDashboardScope(nextActions, filters, {
    searchableText: (item) => `${item.title} ${item.description}`,
    agentIds: (item) =>
      item.title.toLowerCase().includes('expensive')
        ? ['planner-agent']
        : item.title.toLowerCase().includes('regressions')
          ? ['support-agent']
          : ['onboarding-router'],
    models: (item) => (item.href.includes('experiments') ? ['claude-3-haiku'] : ['claude-3-5-sonnet']),
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Govern"
        title="Cost Budgets"
        description="Monitor overspend risk, identify the most expensive agent workflows, and route operators into traces, regressions, and improvement workflows before spend compounds."
      />

      <DashboardFilterBar definitions={budgetFilters} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricTile key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
        ))}
      </section>

      <WorkbenchPanel
        title="Budget pressure workbench"
        description="Use this surface to identify overspend hotspots, connect budget risk back to real traces, and open the improvement workflow before cost compounds."
      >
        <TrendChart
          title="Budget pressure trend"
          description="A shared trend view for burn and risk signals that can be reused across budgets, SLAs, and overview dashboards."
          series={budgetTrendSeries}
        />

        <SplitPanelLayout
          main={
            <EventTimeline
              title="Spend hotspots"
              description="The highest-risk or highest-cost agent workflows to review right now."
              items={toHotspotTimelineItems(filteredHotspots)}
            />
          }
          side={
            <TopNList
              title="Recommended next actions"
              description="Bring cost back under control without losing sight of behavior quality."
              items={toActionItems(filteredNextActions)}
            />
          }
        />
      </WorkbenchPanel>
    </PageContainer>
  );
}
