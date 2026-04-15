'use client';

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
    <PageContainer>
      <PageHeader
        eyebrow="Improve"
        title="Evaluators"
        description="Monitor evaluator health, understand scoring adoption, and keep the improve loop moving from production traces to datasets, experiments, and release decisions."
      >
        <div
          className="inline-flex items-center rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)', color: 'var(--tenant-text-secondary)' }}
        >
          Scoring workbench
        </div>
      </PageHeader>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.24fr)_minmax(320px,0.76fr)]">
        <SectionPanel
          title="Read evaluator posture before you trust the scores"
          description="This page should frame evaluators as scoring infrastructure, not just configuration. Show evaluator health first, then filtering, then coverage and the strongest next route into datasets, experiments, and traces."
        >
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
            ))}
          </section>
        </SectionPanel>

        <SectionPanel
          title="Filter evaluator posture"
          description="Slice by severity or model before widening the scoring review."
        >
          <DashboardFilterBar definitions={evaluatorFilters} />
        </SectionPanel>
      </section>

      <WorkbenchPanel
        title="Evaluator coverage workbench"
        description="Use this surface to understand evaluator health, trace coverage, and whether current scoring signals are strong enough to support a promotion decision."
      >
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

        <SectionPanel
          title="Evaluator triage framing"
          description="A compact interpretation layer between posture metrics and evaluator records, so operators can see which scoring systems are reliable, which are drifting, and where to intervene next."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {filteredEvaluators.map((evaluator) => (
              <div
                key={evaluator.name}
                className="rounded-[var(--tenant-radius-panel)] border p-4"
                style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
                  {evaluator.model} · {evaluator.scoringType}
                </div>
                <div className="mt-2 font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{evaluator.name}</div>
                <div className="mt-3">
                  <RecordBody>{evaluator.lastRunSummary}</RecordBody>
                </div>
                <div className="mt-3 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
                  {evaluator.adoptionSummary}
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      </WorkbenchPanel>
    </PageContainer>
  );
}
