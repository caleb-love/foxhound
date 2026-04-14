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

const statusVariant: Record<SlaRiskRecord['status'], 'secondary' | 'default' | 'destructive'> = {
  healthy: 'secondary',
  warning: 'default',
  critical: 'destructive',
};

export function SlasGovernDashboard({
  metrics,
  atRiskAgents,
  nextActions,
}: SlasGovernDashboardProps) {
  return (
    <DashboardPage
      eyebrow="Govern · SLAs"
      title="SLA Monitoring"
      description="Track which agent workflows are drifting beyond latency or success-rate targets and move directly into investigation surfaces before reliability incidents reach users."
    >
      <MetricGrid>
        {metrics.map((metric) => (
          <PremiumMetricCard key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
        ))}
      </MetricGrid>

      <SplitPanelLayout
        main={
          <PremiumPanel title="At-risk agents" description="Workflows trending toward or already breaching their reliability targets.">
            {atRiskAgents.map((agent) => (
              <PremiumRecord key={agent.agent}>
                <PremiumRecordHeader title={agent.agent} badge={<PremiumStatusBadge status={agent.status} variant={agent.status} />} />
                <div className="grid gap-2 text-sm md:grid-cols-2" style={{ color: 'var(--tenant-text-secondary)' }}>
                  <div>Success rate: {agent.successRate}</div>
                  <div>Latency: {agent.latency}</div>
                </div>
                <PremiumBody><div className="mt-3">{agent.description}</div></PremiumBody>
                <PremiumActions>
                  <PremiumActionLink href={agent.tracesHref}>Review traces</PremiumActionLink>
                  <PremiumActionLink href={agent.regressionsHref}>Check regressions</PremiumActionLink>
                  <PremiumActionLink href={agent.replayHref}>Open replay</PremiumActionLink>
                </PremiumActions>
              </PremiumRecord>
            ))}
          </PremiumPanel>
        }
        side={
          <PremiumPanel title="Recommended next actions" description="Use the investigation and improvement workflow to recover reliability before breaching commitments.">
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
