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

const statusVariant: Record<ExecutiveDecisionItem['status'], 'secondary' | 'default' | 'destructive'> = {
  'on-track': 'secondary',
  watch: 'default',
  attention: 'destructive',
};

export function ExecutiveSummaryDashboard({
  metrics,
  decisions,
  highlights,
}: ExecutiveSummaryDashboardProps) {
  return (
    <DashboardPage
      eyebrow="Executive Summary"
      title="Leadership Overview"
      description="A stakeholder-oriented summary of platform health, operational risk, and the most important decisions needed right now across reliability, spend, and change management."
    >
      <MetricGrid>
        {metrics.map((metric) => (
          <PremiumMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            supportingText={metric.supportingText}
          />
        ))}
      </MetricGrid>

      <SplitPanelLayout
        main={
          <PremiumPanel title="Decision queue" description="What leadership or platform owners should review next.">
            {decisions.map((decision) => (
              <PremiumRecord key={decision.title}>
                <PremiumRecordHeader
                  title={decision.title}
                  badge={<PremiumStatusBadge status={decision.status} variant={decision.status === 'attention' ? 'critical' : decision.status === 'watch' ? 'warning' : 'healthy'} />}
                />
                <PremiumBody>{decision.description}</PremiumBody>
                <PremiumActions>
                  <PremiumActionLink href={decision.href}>{decision.cta}</PremiumActionLink>
                </PremiumActions>
              </PremiumRecord>
            ))}
          </PremiumPanel>
        }
        side={
          <PremiumPanel title="Top-line highlights" description="Fast, shareable talking points for review and planning.">
            {highlights.map((highlight) => (
              <PremiumRecord key={highlight}>
                <PremiumBody>{highlight}</PremiumBody>
              </PremiumRecord>
            ))}
          </PremiumPanel>
        }
      />
    </DashboardPage>
  );
}
