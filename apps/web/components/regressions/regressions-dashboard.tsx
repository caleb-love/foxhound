'use client';

import { DiffScorecard, type DiffMetricItem } from '@/components/charts/diff-scorecard';
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

export interface RegressionMetric {
  label: string;
  value: string;
  supportingText: string;
}

export interface RegressionRecord {
  title: string;
  severity: 'critical' | 'warning' | 'healthy';
  changedAt: string;
  description: string;
  traceHref: string;
  diffHref: string;
  promptHref?: string;
}

interface RegressionsDashboardProps {
  metrics: RegressionMetric[];
  activeRegressions: RegressionRecord[];
  likelyCauses: Array<{
    title: string;
    description: string;
    href: string;
    cta: string;
  }>;
}

function toRegressionTimelineItems(activeRegressions: RegressionRecord[]): TimelineItem[] {
  return activeRegressions.map((regression) => ({
    title: regression.title,
    description: regression.description,
    status: regression.severity,
    meta: `Changed ${regression.changedAt}`,
    href: regression.diffHref,
    cta: 'Compare runs',
  }));
}

function toLikelyCauseItems(items: Array<{ title: string; description: string; href: string; cta: string }>): TopListItem[] {
  return items.map((item) => ({
    title: item.title,
    description: item.description,
    href: item.href,
  }));
}

const regressionFilters: DashboardFilterDefinition[] = [
  {
    key: 'searchQuery',
    kind: 'search',
    label: 'Search',
    placeholder: 'Search regressions, prompts, or diff targets...',
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
    key: 'promptIds',
    kind: 'multi-select',
    label: 'Prompts',
    options: [
      { value: 'onboarding-router', label: 'onboarding-router' },
      { value: 'support-routing', label: 'support-routing' },
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

function buildRegressionDiffMetrics(activeRegressions: RegressionRecord[]): DiffMetricItem[] {
  const criticalCount = activeRegressions.filter((item) => item.severity === 'critical').length;
  const warningCount = activeRegressions.filter((item) => item.severity === 'warning').length;
  const promptLinkedCount = activeRegressions.filter((item) => Boolean(item.promptHref)).length;

  return [
    {
      label: 'Critical regressions',
      baseline: '0 expected',
      comparison: `${criticalCount} active`,
      delta: criticalCount === 0 ? 'No critical drift' : `+${criticalCount} critical`,
      tone: criticalCount > 0 ? 'critical' : 'healthy',
    },
    {
      label: 'Warning regressions',
      baseline: 'Low/steady',
      comparison: `${warningCount} active`,
      delta: warningCount === 0 ? 'No warning drift' : `+${warningCount} warning`,
      tone: warningCount > 0 ? 'warning' : 'healthy',
    },
    {
      label: 'Prompt-linked shifts',
      baseline: 'Review if non-zero',
      comparison: `${promptLinkedCount} linked`,
      delta: promptLinkedCount === 0 ? 'No prompt linkage' : `${promptLinkedCount} needs prompt review`,
      tone: promptLinkedCount > 0 ? 'warning' : 'default',
    },
  ];
}

export function RegressionsDashboard({
  metrics,
  activeRegressions,
  likelyCauses,
}: RegressionsDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filteredRegressions = filterByDashboardScope(activeRegressions, filters, {
    searchableText: (item) => `${item.title} ${item.description}`,
    severity: (item) => item.severity,
    status: (item) => item.severity,
    agentIds: (item) =>
      item.title.toLowerCase().includes('planner') ? ['planner-agent'] : item.title.toLowerCase().includes('support') ? ['support-agent'] : ['onboarding-router'],
    promptIds: (item) => (item.promptHref?.includes('support-routing') ? ['support-routing'] : item.promptHref?.includes('onboarding-router') ? ['onboarding-router'] : []),
  });

  const filteredLikelyCauses = filterByDashboardScope(likelyCauses, filters, {
    searchableText: (item) => `${item.title} ${item.description}`,
    agentIds: (item) =>
      item.title.toLowerCase().includes('prompt') ? ['onboarding-router'] : item.title.toLowerCase().includes('execution') ? ['planner-agent'] : ['support-agent'],
    promptIds: (item) => (item.href.includes('support-routing') ? ['support-routing'] : item.href.includes('onboarding-router') ? ['onboarding-router'] : []),
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Govern"
        title="Behavior Regressions"
        description="Track where agent behavior changed, prioritize the regressions most likely to matter operationally, and jump directly into traces, replay, run diff, and prompt review to understand root cause."
      >
        <div
          className="inline-flex items-center rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)', color: 'var(--tenant-text-secondary)' }}
        >
          Governance workbench
        </div>
      </PageHeader>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.24fr)_minmax(320px,0.76fr)]">
        <SectionPanel
          title="Read drift before it becomes incident response"
          description="This view should feel like operational triage, not passive reporting. Show the current behavior posture first, then the highest-likelihood causes, then the routes into evidence."
        >
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
            ))}
          </section>
        </SectionPanel>

        <SectionPanel
          title="Filter regression posture"
          description="Slice by severity, agent, or prompt target before widening the investigation."
        >
          <DashboardFilterBar definitions={regressionFilters} />
        </SectionPanel>
      </section>

      <WorkbenchPanel
        title="Regression triage workbench"
        description="Use this workbench to compare current behavior with the stable baseline, separate signal from noise, and move directly into the investigation surfaces that explain what changed."
      >
        <DiffScorecard
          title="Regression delta summary"
          description="A shared governance compare view that frames behavioral drift against the expected stable baseline before deeper investigation begins."
          metrics={buildRegressionDiffMetrics(filteredRegressions)}
        />

        <SplitPanelLayout
          main={
            <EventTimeline
              title="Active regressions"
              description="The behavior shifts most likely to matter right now, framed as active investigation targets instead of a passive issue list."
              items={toRegressionTimelineItems(filteredRegressions)}
            />
          }
          side={
            <TopNList
              title="Likely causes to review"
              description="Follow the strongest causal leads first, then widen investigation only if the evidence says you need to."
              items={toLikelyCauseItems(filteredLikelyCauses)}
            />
          }
        />

        <SectionPanel
          title="Triage framing"
          description="A compact explanation layer between metrics and investigation links, so operators can see what changed, why it likely changed, and what to inspect first."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {filteredRegressions.map((regression) => (
              <div
                key={regression.title}
                className="rounded-[var(--tenant-radius-panel)] border p-4"
                style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-panel-alt) 94%, transparent)' }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
                  {regression.changedAt}
                </div>
                <div className="mt-2 font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{regression.title}</div>
                <div className="mt-3">
                  <RecordBody>{regression.description}</RecordBody>
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      </WorkbenchPanel>
    </PageContainer>
  );
}
