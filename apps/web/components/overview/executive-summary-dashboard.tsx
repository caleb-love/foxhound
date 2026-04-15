'use client';

import { EventTimeline } from '@/components/charts/event-timeline';
import { MetricTile } from '@/components/charts/metric-tile';
import { TopNList } from '@/components/charts/top-n-list';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { TimelineItem, TopListItem } from '@/components/charts/chart-types';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import {
  DashboardPage,
  MetricGrid,
  SplitPanelLayout,
} from '@/components/sandbox/primitives';
import { PremiumPanel, PremiumRecord, PremiumRecordHeader } from '@/components/sandbox/primitives';
import { RecordBody, SectionPanel } from '@/components/system/page';

export interface ExecutiveMetric {
  label: string;
  value: string;
  supportingText: string;
}

export interface ExecutiveDecisionItem {
  title: string;
  status: 'on-track' | 'watch' | 'attention';
  description: string;
  href: string;
  cta: string;
}

interface ExecutiveSummaryDashboardProps {
  metrics: ExecutiveMetric[];
  decisions: ExecutiveDecisionItem[];
  highlights: string[];
}

const executiveFilters: DashboardFilterDefinition[] = [
  {
    key: 'searchQuery',
    kind: 'search',
    label: 'Search',
    placeholder: 'Search decisions, highlights, or risks...',
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
];

function toDecisionTimelineItems(decisions: ExecutiveDecisionItem[]): TimelineItem[] {
  return decisions.map((decision) => ({
    title: decision.title,
    description: decision.description,
    status: decision.status === 'attention' ? 'critical' : decision.status === 'watch' ? 'warning' : 'healthy',
    href: decision.href,
    cta: decision.cta,
  }));
}

function toHighlightItems(highlights: string[]): TopListItem[] {
  return highlights.map((highlight, index) => ({
    title: `Highlight ${index + 1}`,
    description: highlight,
  }));
}

export function ExecutiveSummaryDashboard({
  metrics,
  decisions,
  highlights,
}: ExecutiveSummaryDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filteredDecisions = filterByDashboardScope(decisions, filters, {
    searchableText: (item) => `${item.title} ${item.description}`,
    severity: (item) => (item.status === 'attention' ? 'critical' : item.status === 'watch' ? 'warning' : 'healthy'),
    status: (item) => (item.status === 'attention' ? 'critical' : item.status === 'watch' ? 'warning' : 'healthy'),
    agentIds: (item) =>
      item.title.toLowerCase().includes('planner')
        ? ['planner-agent']
        : item.title.toLowerCase().includes('support')
          ? ['support-agent']
          : ['onboarding-router'],
  });

  const filteredHighlights = filterByDashboardScope(
    highlights.map((highlight, index) => ({ id: index, text: highlight })),
    filters,
    {
      searchableText: (item) => item.text,
      agentIds: (item) =>
        item.text.toLowerCase().includes('planner')
          ? ['planner-agent']
          : item.text.toLowerCase().includes('support')
            ? ['support-agent']
            : ['onboarding-router'],
    },
  ).map((item) => item.text);

  return (
    <DashboardPage
      eyebrow="Executive Summary"
      title="Leadership Overview"
      description="A stakeholder-facing summary of platform health, operational risk, and the decisions that matter right now across reliability, spend, and change management."
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(320px,0.72fr)]">
        <SectionPanel
          title="Read the business posture fast"
          description="This surface is for leaders who need signal compression, not implementation detail. Show posture first, decisions second, and detailed evidence only when it changes the call."
        >
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
        </SectionPanel>

        <SectionPanel
          title="Executive filter"
          description="Narrow the summary to the risk slice, team slice, or search context you want to discuss."
        >
          <DashboardFilterBar definitions={executiveFilters} />
        </SectionPanel>
      </section>

      <SplitPanelLayout
        main={
          <EventTimeline
            title="Decision queue"
            description="What leadership or platform owners should review next."
            items={toDecisionTimelineItems(filteredDecisions)}
          />
        }
        side={
          <TopNList
            title="Top-line highlights"
            description="Fast, shareable talking points for review and planning."
            items={toHighlightItems(filteredHighlights)}
          />
        }
      />

      <PremiumPanel
        title="Decision framing"
        description="A tighter layer between metrics and workflow navigation so leadership can see what is on track, what needs attention, and where to drill in."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {filteredDecisions.map((decision) => (
            <PremiumRecord key={decision.title}>
              <PremiumRecordHeader title={decision.title} />
              <RecordBody>{decision.description}</RecordBody>
            </PremiumRecord>
          ))}
        </div>
      </PremiumPanel>
    </DashboardPage>
  );
}
