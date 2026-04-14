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
import {
  DashboardPage,
  MetricGrid,
  PremiumActionLink,
  PremiumActions,
  PremiumPanel,
  PremiumRecord,
  PremiumRecordHeader,
} from '@/components/demo/dashboard-primitives';

export interface OverviewMetric {
  label: string;
  value: string;
  supportingText: string;
  tone?: 'default' | 'warning' | 'destructive';
}

export interface OverviewActionItem {
  title: string;
  description: string;
  href: string;
  cta: string;
}

export interface OverviewFeedItem {
  title: string;
  description: string;
  status: 'healthy' | 'warning' | 'critical';
}

interface FleetOverviewProps {
  metrics: OverviewMetric[];
  changeFeed: OverviewFeedItem[];
  actionQueue: OverviewFeedItem[];
  nextActions: OverviewActionItem[];
  demoMode?: boolean;
}

function toTimelineItems(items: OverviewFeedItem[]): TimelineItem[] {
  return items.map((item) => ({
    title: item.title,
    description: item.description,
    status: item.status === 'healthy' ? 'healthy' : item.status === 'warning' ? 'warning' : 'critical',
  }));
}

function toTopListItems(actions: OverviewActionItem[]): TopListItem[] {
  return actions.map((action) => ({
    title: action.title,
    description: action.description,
    href: action.href,
  }));
}

const overviewFilters: DashboardFilterDefinition[] = [
  {
    key: 'searchQuery',
    kind: 'search',
    label: 'Search',
    placeholder: 'Search agents, prompts, incidents, or traces...',
  },
  {
    key: 'status',
    kind: 'single-select',
    label: 'Status',
    options: [
      { value: 'all', label: 'All' },
      { value: 'success', label: 'Healthy' },
      { value: 'error', label: 'Needs attention' },
    ],
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

const overviewTrendSeries: TrendSeries[] = [
  {
    id: 'fleet-health',
    label: 'Fleet health trend',
    tone: 'healthy',
    values: [
      { label: 'Mon', value: 88 },
      { label: 'Tue', value: 90 },
      { label: 'Wed', value: 91 },
      { label: 'Thu', value: 89 },
      { label: 'Fri', value: 92 },
    ],
  },
  {
    id: 'budget-risk',
    label: 'Budget risk trend',
    tone: 'warning',
    values: [
      { label: 'Mon', value: 2 },
      { label: 'Tue', value: 3 },
      { label: 'Wed', value: 3 },
      { label: 'Thu', value: 4 },
      { label: 'Fri', value: 4 },
    ],
  },
];

export function FleetOverview({
  metrics,
  changeFeed,
  actionQueue,
  nextActions,
  demoMode = false,
}: FleetOverviewProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filteredChangeFeed = filterByDashboardScope(changeFeed, filters, {
    searchableText: (item) => `${item.title} ${item.description}`,
    status: (item) => item.status,
    severity: (item) => item.status,
    agentIds: (item) =>
      item.title.toLowerCase().includes('planner') || item.description.toLowerCase().includes('planner')
        ? ['planner-agent']
        : item.title.toLowerCase().includes('support') || item.description.toLowerCase().includes('support')
          ? ['support-agent']
          : item.title.toLowerCase().includes('onboarding') || item.description.toLowerCase().includes('onboarding')
            ? ['onboarding-router']
            : [],
  });

  const filteredActionQueue = filterByDashboardScope(actionQueue, filters, {
    searchableText: (item) => `${item.title} ${item.description}`,
    status: (item) => item.status,
    severity: (item) => item.status,
    agentIds: (item) =>
      item.title.toLowerCase().includes('planner') || item.description.toLowerCase().includes('planner')
        ? ['planner-agent']
        : item.title.toLowerCase().includes('support') || item.description.toLowerCase().includes('support')
          ? ['support-agent']
          : item.title.toLowerCase().includes('onboarding') || item.description.toLowerCase().includes('onboarding')
            ? ['onboarding-router']
            : [],
  });

  const filteredNextActions = filterByDashboardScope(nextActions, filters, {
    searchableText: (item) => `${item.title} ${item.description}`,
    agentIds: (item) =>
      item.title.toLowerCase().includes('prompt')
        ? ['support-agent']
        : item.title.toLowerCase().includes('run')
          ? ['onboarding-router']
          : ['planner-agent'],
  });

  return (
    <DashboardPage
      eyebrow="Overview"
      title="Fleet Overview"
      description="A premium command surface for understanding fleet health, recent change impact, and the highest-priority operator actions."
    >
      <DashboardFilterBar definitions={overviewFilters} />

      {demoMode ? (
        <PremiumPanel
          title="Demo quick links"
          description="Jump straight to the key seeded dashboard surfaces without needing auth or a live API session."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Hero regression trace', href: '/demo/traces/trace_support_refund_v18_regression' },
              { label: 'Hero run diff', href: '/demo/diff?a=trace_support_refund_v17_baseline&b=trace_support_refund_v18_regression' },
              { label: 'Session replay', href: '/demo/replay/trace_support_refund_v18_regression' },
              { label: 'Executive summary', href: '/demo/executive' },
            ].map((item) => (
              <PremiumRecord key={item.href}>
                <PremiumRecordHeader title={item.label} />
                <PremiumActions>
                  <PremiumActionLink href={item.href}>Open route</PremiumActionLink>
                </PremiumActions>
              </PremiumRecord>
            ))}
          </div>
        </PremiumPanel>
      ) : null}

      <MetricGrid>
        {metrics.map((metric) => (
          <MetricTile
            key={metric.label}
            label={metric.label}
            value={metric.value}
            supportingText={metric.supportingText}
          />
        ))}
      </MetricGrid>

      <TrendChart
        title="Trend snapshot"
        description="A compact shared trend surface for health and risk signals that can be reused across overview, governance, and quality dashboards."
        series={overviewTrendSeries}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <EventTimeline
          title="What changed"
          description="Recent events that may explain fleet behavior shifts."
          items={toTimelineItems(filteredChangeFeed)}
        />

        <EventTimeline
          title="What needs action"
          description="Highest-priority issues to investigate or contain next."
          items={toTimelineItems(filteredActionQueue)}
        />
      </section>

      <TopNList
        title="Recommended next actions"
        description="Jump directly into the workflows most likely to move reliability, cost, and behavior."
        items={toTopListItems(filteredNextActions)}
      />
    </DashboardPage>
  );
}
