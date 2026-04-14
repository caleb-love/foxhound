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

const severityVariant: Record<RegressionRecord['severity'], 'destructive' | 'default' | 'secondary'> = {
  critical: 'destructive',
  warning: 'default',
  healthy: 'secondary',
};

export function RegressionsDashboard({
  metrics,
  activeRegressions,
  likelyCauses,
}: RegressionsDashboardProps) {
  return (
    <DashboardPage
      eyebrow="Govern · Regressions"
      title="Behavior Regressions"
      description="Track where agent behavior changed, prioritize the highest-risk regressions, and jump directly into traces, replay, diffs, and prompt review to understand root cause."
    >
      <MetricGrid>
        {metrics.map((metric) => (
          <PremiumMetricCard key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
        ))}
      </MetricGrid>

      <SplitPanelLayout
        main={
          <PremiumPanel title="Active regressions" description="The most important behavior shifts to investigate right now.">
            {activeRegressions.map((regression) => (
              <PremiumRecord key={regression.title}>
                <PremiumRecordHeader
                  title={regression.title}
                  meta={`Changed ${regression.changedAt}`}
                  badge={<PremiumStatusBadge status={regression.severity} variant={regression.severity === 'critical' ? 'critical' : regression.severity === 'warning' ? 'warning' : 'healthy'} />}
                />
                <PremiumBody>{regression.description}</PremiumBody>
                <PremiumActions>
                  <PremiumActionLink href={regression.traceHref}>Open trace</PremiumActionLink>
                  <PremiumActionLink href={regression.diffHref}>Compare runs</PremiumActionLink>
                  {regression.promptHref ? <PremiumActionLink href={regression.promptHref}>Review prompts</PremiumActionLink> : null}
                </PremiumActions>
              </PremiumRecord>
            ))}
          </PremiumPanel>
        }
        side={
          <PremiumPanel title="Likely causes to review" description="Follow the strongest leads before widening investigation scope.">
            {likelyCauses.map((item) => (
              <PremiumRecord key={item.title}>
                <PremiumRecordHeader title={item.title} />
                <PremiumBody>{item.description}</PremiumBody>
                <PremiumActions>
                  <PremiumActionLink href={item.href}>{item.cta}</PremiumActionLink>
                </PremiumActions>
              </PremiumRecord>
            ))}
          </PremiumPanel>
        }
      />
    </DashboardPage>
  );
}
