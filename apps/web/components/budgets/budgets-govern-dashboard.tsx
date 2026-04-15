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
import { PageContainer, PageHeader, RecordBody, SectionPanel } from '@/components/system/page';
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
        description="Track cost pressure across the agent fleet, identify the workflows most likely to overspend, and move directly into traces, regressions, and improvement loops before burn compounds into a broader incident."
      >
        <div
          className="inline-flex items-center rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)', color: 'var(--tenant-text-secondary)' }}
        >
          Cost governance
        </div>
      </PageHeader>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.24fr)_minmax(320px,0.76fr)]">
        <SectionPanel
          title="Read spend before it becomes a budget incident"
          description="This page should explain cost pressure as an operational problem. Show the posture first, then the hotspots, then the action routes that reduce burn without damaging quality."
        >
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
            ))}
          </section>
        </SectionPanel>

        <SectionPanel
          title="Filter budget posture"
          description="Slice by severity, agent, or model to isolate accidental burn before widening the investigation."
        >
          <DashboardFilterBar definitions={budgetFilters} />
        </SectionPanel>
      </section>

      <WorkbenchPanel
        title="Budget pressure workbench"
        description="Use this workbench to connect spend spikes back to real execution evidence, separate intentional investment from accidental burn, and route operators into the right cost-reduction workflow quickly."
      >
        <TrendChart
          title="Budget pressure trend"
          description="A shared governance trend view for burn and risk movement, so budget drift reads with the same clarity as SLA and regression signals."
          series={budgetTrendSeries}
        />

        <SplitPanelLayout
          main={
            <EventTimeline
              title="Spend hotspots"
              description="The workflows creating the strongest cost pressure right now, ordered for investigation rather than passive reporting."
              items={toHotspotTimelineItems(filteredHotspots)}
            />
          }
          side={
            <TopNList
              title="Recommended next actions"
              description="Take the next highest-leverage actions to reduce spend without accidentally degrading behavior quality or operator confidence."
              items={toActionItems(filteredNextActions)}
            />
          }
        />

        <SectionPanel
          title="Budget triage framing"
          description="A compact explanation layer between metrics and traces, so operators can see which agents are drifting, what is likely causing the burn, and where to intervene first."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {filteredHotspots.map((hotspot) => (
              <div
                key={hotspot.agent}
                className="rounded-[var(--tenant-radius-panel)] border p-4"
                style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
                  {hotspot.spend} / {hotspot.budget}
                </div>
                <div className="mt-2 font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{hotspot.agent}</div>
                <div className="mt-3">
                  <RecordBody>{hotspot.description}</RecordBody>
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      </WorkbenchPanel>
    </PageContainer>
  );
}
