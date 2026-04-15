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
        description="Track reliability drift across critical agent workflows, identify where latency or success rates are moving out of bounds, and jump directly into the investigation surfaces that explain why."
      >
        <div
          className="inline-flex items-center rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-secondary)' }}
        >
          Reliability governance
        </div>
      </PageHeader>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.24fr)_minmax(320px,0.76fr)]">
        <SectionPanel
          title="Read reliability before it becomes a customer incident"
          description="This page should frame SLA drift as an operational posture problem. Show the health picture first, then the breach pressure, then the best route into traces, replay, and regression analysis."
        >
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
            ))}
          </section>
        </SectionPanel>

        <SectionPanel
          title="Filter reliability posture"
          description="Slice by severity or agent to isolate breach pressure before widening the investigation."
        >
          <DashboardFilterBar definitions={slaFilters} />
        </SectionPanel>
      </section>

      <WorkbenchPanel
        title="SLA triage workbench"
        description="Use this workbench to read reliability drift as an operator problem, isolate the workflows most likely to breach commitments, and move directly into traces, replay, and regression analysis."
      >
        <TrendChart
          title="Reliability drift trend"
          description="A shared governance trend view for SLA health and latency movement, so reliability risk reads with the same visual clarity as cost and behavior drift."
          series={slaTrendSeries}
        />

        <SplitPanelLayout
          main={
            <EventTimeline
              title="At-risk agents"
              description="The workflows trending toward or already breaching their reliability targets, prioritized for immediate investigation."
              items={toAtRiskTimelineItems(filteredAtRiskAgents)}
            />
          }
          side={
            <TopNList
              title="Recommended next actions"
              description="Use the linked investigation and improvement flows to recover reliability before a drifting workflow turns into a customer-visible incident."
              items={toActionItems(filteredNextActions)}
            />
          }
        />

        <SectionPanel
          title="SLA triage framing"
          description="A compact explanation layer between metrics and evidence, so operators can quickly see who is breaching, what is drifting, and where the recovery workflow should start."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {filteredAtRiskAgents.map((agent) => (
              <div
                key={agent.agent}
                className="rounded-[var(--tenant-radius-panel)] border p-4"
                style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
                  {agent.successRate} · {agent.latency}
                </div>
                <div className="mt-2 font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{agent.agent}</div>
                <div className="mt-3">
                  <RecordBody>{agent.description}</RecordBody>
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      </WorkbenchPanel>
    </PageContainer>
  );
}
