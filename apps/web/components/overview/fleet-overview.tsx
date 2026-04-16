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
  PremiumActionLink,
  PremiumActions,
  PremiumPanel,
  PremiumRecord,
  PremiumRecordHeader,
} from '@/components/sandbox/primitives';
import { PageContainer, PageHeader, RecordBody, SectionPanel } from '@/components/system/page';

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

function inferAgentIds(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes('planner')) return ['planner-agent'];
  if (text.includes('support') || text.includes('prompt')) return ['support-agent'];
  if (text.includes('onboarding') || text.includes('run')) return ['onboarding-router'];
  return [];
}

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
    agentIds: (item) => inferAgentIds(item.title, item.description),
  });

  const filteredActionQueue = filterByDashboardScope(actionQueue, filters, {
    searchableText: (item) => `${item.title} ${item.description}`,
    status: (item) => item.status,
    severity: (item) => item.status,
    agentIds: (item) => inferAgentIds(item.title, item.description),
  });

  const filteredNextActions = filterByDashboardScope(nextActions, filters, {
    searchableText: (item) => `${item.title} ${item.description}`,
    agentIds: (item) => inferAgentIds(item.title, item.description),
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Overview"
        title="Fleet Overview"
        description="Read platform posture in one pass, isolate the changes that matter, and move straight from top-line signal into investigation or governance action."
      >
        <div
          className="inline-flex items-center rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)', color: 'var(--tenant-text-secondary)' }}
        >
          Live command surface
        </div>
      </PageHeader>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)]">
        <SectionPanel
          title="What changed, what matters, what to do next"
          description="Foxhound should help operators read the moment quickly, not just present another wall of cards. This lead surface compresses posture, active risk, and immediate investigation routes."
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.18fr)_minmax(300px,0.82fr)]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {metrics.map((metric) => (
                  <MetricTile
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    supportingText={metric.supportingText}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <PremiumPanel
                title="Operator focus"
                description="The shortest path from current posture to action."
              >
                <div className="space-y-3">
                  {filteredActionQueue.slice(0, 3).map((item) => (
                    <PremiumRecord key={item.title}>
                      <PremiumRecordHeader title={item.title} />
                      <RecordBody>{item.description}</RecordBody>
                    </PremiumRecord>
                  ))}
                </div>
              </PremiumPanel>
            </div>
          </div>
        </SectionPanel>

        <SectionPanel
          title="Filter the command surface"
          description="Narrow the overview by severity, agent, or recent change before jumping deeper into traces, prompts, or governance surfaces."
        >
          <DashboardFilterBar definitions={overviewFilters} />
        </SectionPanel>
      </section>

      {demoMode ? (
        <PremiumPanel
          title="Sandbox quick links"
          description="Jump straight to seeded hero routes without auth or a live API session."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Hero regression trace', href: '/sandbox/traces/trace_returns_exception_v18_regression' },
              { label: 'Hero run diff', href: '/sandbox/diff?a=trace_returns_exception_v17_baseline&b=trace_returns_exception_v18_regression' },
              { label: 'Session replay', href: '/sandbox/replay/trace_returns_exception_v18_regression' },
              { label: 'Executive summary', href: '/sandbox/executive' },
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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]">
        <TrendChart
          title="Trend snapshot"
          description="Health and budget signals should read like instrumentation, not a detached reporting widget."
          series={overviewTrendSeries}
        />

        <TopNList
          title="Recommended next actions"
          description="Jump directly into the workflows most likely to move reliability, cost, and behavior."
          items={toTopListItems(filteredNextActions)}
        />
      </section>

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
    </PageContainer>
  );
}
