'use client';

import { Badge } from '@/components/ui/badge';
import {
  DashboardPage,
  MetricGrid,
  PremiumActionLink,
  PremiumActions,
  PremiumBody,
  PremiumMetricCard,
  PremiumPanel,
  PremiumRecord,
  PremiumRecordHeader,
  SplitPanelLayout,
} from '@/components/demo/dashboard-primitives';

export interface DatasetMetric {
  label: string;
  value: string;
  supportingText: string;
}

export interface DatasetRecord {
  name: string;
  itemCount: number;
  sourceSummary: string;
  lastUpdated: string;
  scoreSignal: string;
  traceHref: string;
  evaluatorsHref: string;
  experimentHref: string;
}

interface DatasetsDashboardProps {
  metrics: DatasetMetric[];
  datasets: DatasetRecord[];
  nextActions: Array<{
    title: string;
    description: string;
    href: string;
    cta: string;
  }>;
}

export function DatasetsDashboard({
  metrics,
  datasets,
  nextActions,
}: DatasetsDashboardProps) {
  return (
    <DashboardPage
      eyebrow="Improve · Datasets"
      title="Datasets"
      description="Turn production failures and low-scoring traces into reusable evaluation cases, then push them into experiment workflows to improve prompts, routing, and agent behavior."
    >
      <MetricGrid>
        {metrics.map((metric) => (
          <PremiumMetricCard key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
        ))}
      </MetricGrid>

      <SplitPanelLayout
        main={
          <PremiumPanel title="Improvement datasets" description="Datasets derived from trace evidence and ready for evaluation or experimentation.">
            {datasets.map((dataset) => (
              <PremiumRecord key={dataset.name}>
                <PremiumRecordHeader title={dataset.name} badge={<Badge variant="secondary">{dataset.itemCount} cases</Badge>} />
                <PremiumBody>{dataset.sourceSummary}</PremiumBody>
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-2" style={{ color: 'var(--tenant-text-muted)' }}>
                  <div>Last updated: {dataset.lastUpdated}</div>
                  <div>Primary signal: {dataset.scoreSignal}</div>
                </div>
                <PremiumActions>
                  <PremiumActionLink href={dataset.traceHref}>Review source traces</PremiumActionLink>
                  <PremiumActionLink href={dataset.evaluatorsHref}>Check evaluators</PremiumActionLink>
                  <PremiumActionLink href={dataset.experimentHref}>Run experiment</PremiumActionLink>
                </PremiumActions>
              </PremiumRecord>
            ))}
          </PremiumPanel>
        }
        side={
          <PremiumPanel title="Recommended next actions" description="Keep the improve loop moving from trace evidence to validated changes.">
            {nextActions.map((action) => (
              <PremiumRecord key={action.title}>
                <PremiumRecordHeader title={action.title} />
                <PremiumBody>{action.description}</PremiumBody>
                <PremiumActions>
                  <PremiumActionLink href={action.href}>{action.cta}</PremiumActionLink>
                </PremiumActions>
              </PremiumRecord>
            ))}
          </PremiumPanel>
        }
      />
    </DashboardPage>
  );
}
