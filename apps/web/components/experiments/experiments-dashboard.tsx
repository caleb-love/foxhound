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
  PremiumStatusBadge,
  SplitPanelLayout,
} from '@/components/demo/dashboard-primitives';

export interface ExperimentMetric {
  label: string;
  value: string;
  supportingText: string;
}

export interface ExperimentRecord {
  name: string;
  status: 'running' | 'completed' | 'warning';
  dataset: string;
  comparisonSummary: string;
  lastUpdated: string;
  winningSignal: string;
  datasetHref: string;
  evaluatorsHref: string;
  tracesHref: string;
  promoteHref?: string;
}

interface ExperimentsDashboardProps {
  metrics: ExperimentMetric[];
  experiments: ExperimentRecord[];
  nextActions: Array<{
    title: string;
    description: string;
    href: string;
    cta: string;
  }>;
}

const statusVariant: Record<ExperimentRecord['status'], 'secondary' | 'default' | 'outline'> = {
  running: 'default',
  completed: 'secondary',
  warning: 'outline',
};

export function ExperimentsDashboard({
  metrics,
  experiments,
  nextActions,
}: ExperimentsDashboardProps) {
  return (
    <DashboardPage
      eyebrow="Improve · Experiments"
      title="Experiments"
      description="Compare candidate prompts and routing strategies against real trace-derived datasets, then use evaluator signals to decide what is safe to promote."
    >
      <MetricGrid>
        {metrics.map((metric) => (
          <PremiumMetricCard key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
        ))}
      </MetricGrid>

      <SplitPanelLayout
        main={
          <PremiumPanel title="Active experiment comparisons" description="Compare what changed, which candidate is winning, and where to verify before promotion.">
            {experiments.map((experiment) => (
              <PremiumRecord key={experiment.name}>
                <PremiumRecordHeader title={experiment.name} badge={<PremiumStatusBadge status={experiment.status} variant={experiment.status === 'running' ? 'warning' : experiment.status === 'completed' ? 'healthy' : 'neutral'} />} />
                <PremiumBody>
                  <div>Dataset: {experiment.dataset}</div>
                  <div className="mt-2">{experiment.comparisonSummary}</div>
                </PremiumBody>
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-2" style={{ color: 'var(--tenant-text-muted)' }}>
                  <div>Last updated: {experiment.lastUpdated}</div>
                  <div>Winning signal: {experiment.winningSignal}</div>
                </div>
                <PremiumActions>
                  <PremiumActionLink href={experiment.datasetHref}>Review dataset</PremiumActionLink>
                  <PremiumActionLink href={experiment.evaluatorsHref}>Check evaluators</PremiumActionLink>
                  <PremiumActionLink href={experiment.tracesHref}>Inspect traces</PremiumActionLink>
                  {experiment.promoteHref ? <PremiumActionLink href={experiment.promoteHref}>Promote candidate</PremiumActionLink> : null}
                </PremiumActions>
              </PremiumRecord>
            ))}
          </PremiumPanel>
        }
        side={
          <PremiumPanel title="Recommended next actions" description="Keep comparison work grounded in trace evidence and evaluator signals.">
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
