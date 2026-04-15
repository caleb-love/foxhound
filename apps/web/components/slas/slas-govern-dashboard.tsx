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

export interface SlaMetric {
  label: string;
  value: string;
  supportingText: string;
}

export interface SlaRiskRecord {
  agent: string;
  status: 'warning' | 'critical' | 'healthy';
  successRate: string;
  latency: string;
  description: string;
  tracesHref: string;
  regressionsHref: string;
  replayHref: string;
}

interface SlasGovernDashboardProps {
  metrics: SlaMetric[];
  atRiskAgents: SlaRiskRecord[];
  nextActions: Array<{
    title: string;
    description: string;
    href: string;
    cta: string;
  }>;
}

function toAtRiskTimelineItems(atRiskAgents: SlaRiskRecord[]): TimelineItem[] {
  return atRiskAgents.map((agent) => ({
    title: agent.agent,
    description: `${agent.description} Success rate: ${agent.successRate}. Latency: ${agent.latency}.`,
    status: agent.status,
    href: agent.tracesHref,
    cta: 'Review traces',
    meta: `${agent.successRate} · ${agent.latency}`,
  }));
}

function toActionItems(actions: Array<{ title: string; description: string; href: string; cta: string }>): TopListItem[] {
  return actions.map((action) => ({
    title: action.title,
    description: action.description,
    href: action.href,
  }));
}

const slaFilters: DashboardFilterDefinition[] = [
  {
    key: 'searchQuery',
    kind: 'search',
    label: 'Search',
    placeholder: 'Search agents, breaches, or replay targets...',
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

const slaTrendSeries: TrendSeries[] = [
  {
    id: 'success-rate',
    label: 'Success rate trend',
    tone: 'healthy',
    values: [
      { label: 'Mon', value: 98 },
      { label: 'Tue', value: 97 },
      { label: 'Wed', value: 96 },
      { label: 'Thu', value: 94 },
      { label: 'Fri', value: 91 },
    ],
  },
  {
    id: 'p95-latency',
    label: 'p95 latency trend',
    tone: 'warning',
    values: [
      { label: 'Mon', value: 2 },
      { label: 'Tue', value: 2.6 },
      { label: 'Wed', value: 3.1 },
      { label: 'Thu', value: 3.9 },
      { label: 'Fri', value: 4.8 },
    ],
  },
];

export function SlasGovernDashboard({
  metrics,
  atRiskAgents,
  nextActions,
}: SlasGovernDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filteredAtRiskAgents = filterByDashboardScope(atRiskAgents, filters, {
    searchableText: (item) => `${item.agent} ${item.description} ${item.successRate} ${item.latency}`,
    severity: (item) => item.status,
    status: (item) => item.status,
    agentIds: (item) => [item.agent],
  });

  const filteredNextActions = filterByDashboardScope(nextActions, filters, {
    searchableText: (item) => `${item.title} ${item.description}`,
    agentIds: (item) =>
      item.title.toLowerCase().includes('failing')
        ? ['planner-agent']
        : item.title.toLowerCase().includes('regressions')
          ? ['support-agent']
          : ['onboarding-router'],
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Govern"
        title="SLA Monitoring"
        description="Track which agent workflows are drifting beyond latency or success-rate targets and move directly into investigation surfaces before reliability incidents reach users."
      />

      <DashboardFilterBar definitions={slaFilters} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricTile key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
        ))}
      </section>

      <WorkbenchPanel
        title="SLA triage workbench"
        description="Use this surface to understand reliability drift, identify the most at-risk workflows, and move directly into traces, replay, and regression analysis."
      >
        <TrendChart
          title="Reliability drift trend"
          description="A shared trend view for SLA health and latency movement that can be reused across overview, SLAs, and regressions."
          series={slaTrendSeries}
        />

        <SplitPanelLayout
          main={
            <EventTimeline
              title="At-risk agents"
              description="Workflows trending toward or already breaching their reliability targets."
              items={toAtRiskTimelineItems(filteredAtRiskAgents)}
            />
          }
          side={
            <TopNList
              title="Recommended next actions"
              description="Use the investigation and improvement workflow to recover reliability before breaching commitments."
              items={toActionItems(filteredNextActions)}
            />
          }
        />
      </WorkbenchPanel>
    </PageContainer>
  );
}
