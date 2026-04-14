'use client';

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

const statusVariant: Record<BudgetRiskRecord['status'], 'secondary' | 'default' | 'destructive'> = {
  healthy: 'secondary',
  warning: 'default',
  critical: 'destructive',
};

export function BudgetsGovernDashboard({
  metrics,
  hotspots,
  nextActions,
}: BudgetsGovernDashboardProps) {
  return (
    <DashboardPage
      eyebrow="Govern · Budgets"
      title="Cost Budgets"
      description="Monitor overspend risk, identify the most expensive agent workflows, and route operators into traces, regressions, and improvement workflows before spend compounds."
    >
      <MetricGrid>
        {metrics.map((metric) => (
          <PremiumMetricCard key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
        ))}
      </MetricGrid>

      <SplitPanelLayout
        main={
          <PremiumPanel title="Spend hotspots" description="The highest-risk or highest-cost agent workflows to review right now.">
            {hotspots.map((hotspot) => (
              <PremiumRecord key={hotspot.agent}>
                <PremiumRecordHeader title={hotspot.agent} badge={<PremiumStatusBadge status={hotspot.status} variant={hotspot.status} />} />
                <div className="grid gap-2 text-sm md:grid-cols-2" style={{ color: 'var(--tenant-text-secondary)' }}>
                  <div>Spend: {hotspot.spend}</div>
                  <div>Budget: {hotspot.budget}</div>
                </div>
                <PremiumBody><div className="mt-3">{hotspot.description}</div></PremiumBody>
                <PremiumActions>
                  <PremiumActionLink href={hotspot.tracesHref}>Review traces</PremiumActionLink>
                  <PremiumActionLink href={hotspot.regressionsHref}>Check regressions</PremiumActionLink>
                  <PremiumActionLink href={hotspot.improveHref}>Open improvement flow</PremiumActionLink>
                </PremiumActions>
              </PremiumRecord>
            ))}
          </PremiumPanel>
        }
        side={
          <PremiumPanel title="Recommended next actions" description="Bring cost back under control without losing sight of behavior quality.">
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
