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

const statusVariant: Record<EvaluatorRecord['lastRunStatus'], 'secondary' | 'default' | 'destructive'> = {
  healthy: 'secondary',
  warning: 'default',
  critical: 'destructive',
};

export function EvaluatorsDashboard({
  metrics,
  evaluators,
  nextActions,
}: EvaluatorsDashboardProps) {
  return (
    <DashboardPage
      eyebrow="Improve · Evaluators"
      title="Evaluators"
      description="Monitor evaluator health, understand scoring adoption, and keep the improve loop moving from production traces to datasets, experiments, and release decisions."
    >
      <MetricGrid>
        {metrics.map((metric) => (
          <PremiumMetricCard key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
        ))}
      </MetricGrid>

      <SplitPanelLayout
        main={
          <PremiumPanel title="Evaluator coverage" description="Which evaluators are active, what they score, and where to investigate weak signals next.">
            {evaluators.map((evaluator) => (
              <PremiumRecord key={evaluator.name}>
                <PremiumRecordHeader
                  title={evaluator.name}
                  badge={<div className="flex items-center gap-2"><Badge variant="outline">{evaluator.scoringType}</Badge><PremiumStatusBadge status={evaluator.lastRunStatus} variant={evaluator.lastRunStatus} /></div>}
                />
                <PremiumBody>Model: {evaluator.model}</PremiumBody>
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-2" style={{ color: 'var(--tenant-text-muted)' }}>
                  <div>Adoption: {evaluator.adoptionSummary}</div>
                  <div>Latest run: {evaluator.lastRunSummary}</div>
                </div>
                <PremiumActions>
                  <PremiumActionLink href={evaluator.tracesHref}>Review traces</PremiumActionLink>
                  <PremiumActionLink href={evaluator.datasetsHref}>Open datasets</PremiumActionLink>
                  <PremiumActionLink href={evaluator.experimentsHref}>Run experiment</PremiumActionLink>
                  {evaluator.compareHref ? <PremiumActionLink href={evaluator.compareHref}>Compare results</PremiumActionLink> : null}
                </PremiumActions>
              </PremiumRecord>
            ))}
          </PremiumPanel>
        }
        side={
          <PremiumPanel title="Recommended next actions" description="Tighten evaluation coverage before promoting a change or dismissing a regression.">
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
