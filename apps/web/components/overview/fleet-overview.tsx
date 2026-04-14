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

export interface OverviewMetric {
  label: string;
  value: string;
  supportingText: string;
  tone?: 'default' | 'warning' | 'destructive';
}

export interface OverviewActionItem {
  title: string;
  description: string;
  href: string;
  cta: string;
}

export interface OverviewFeedItem {
  title: string;
  description: string;
  status: 'healthy' | 'warning' | 'critical';
}

interface FleetOverviewProps {
  metrics: OverviewMetric[];
  changeFeed: OverviewFeedItem[];
  actionQueue: OverviewFeedItem[];
  nextActions: OverviewActionItem[];
  demoMode?: boolean;
}

const badgeVariantByStatus: Record<OverviewFeedItem['status'], 'default' | 'secondary' | 'destructive'> = {
  healthy: 'secondary',
  warning: 'default',
  critical: 'destructive',
};

export function FleetOverview({
  metrics,
  changeFeed,
  actionQueue,
  nextActions,
  demoMode = false,
}: FleetOverviewProps) {
  return (
    <DashboardPage
      eyebrow="Overview"
      title="Fleet Overview"
      description="A premium command surface for understanding fleet health, recent change impact, and the highest-priority operator actions."
    >
      {demoMode ? (
        <PremiumPanel
          title="Demo quick links"
          description="Jump straight to the key seeded dashboard surfaces without needing auth or a live API session."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Hero regression trace', href: '/demo/traces/trace_support_refund_v18_regression' },
              { label: 'Hero run diff', href: '/demo/diff?a=trace_support_refund_v17_baseline&b=trace_support_refund_v18_regression' },
              { label: 'Session replay', href: '/demo/replay/trace_support_refund_v18_regression' },
              { label: 'Executive summary', href: '/demo/executive' },
            ].map((item) => (
              <PremiumRecord key={item.href}>
                <PremiumRecordHeader title={item.label} />
                <PremiumActions>
                  <PremiumActionLink href={item.href}>Open route</PremiumActionLink>
                </PremiumActions>
              </PremiumRecord>
            ))}
          </div>
        </PremiumPanel>
      ) : null}

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

      <section className="grid gap-4 lg:grid-cols-2">
        <PremiumPanel title="What changed" description="Recent events that may explain fleet behavior shifts.">
          {changeFeed.map((item) => (
            <PremiumRecord key={item.title}>
              <PremiumRecordHeader
                title={item.title}
                badge={<PremiumStatusBadge status={item.status} variant={item.status === 'critical' ? 'critical' : item.status === 'warning' ? 'warning' : 'healthy'} />}
              />
              <PremiumBody>{item.description}</PremiumBody>
            </PremiumRecord>
          ))}
        </PremiumPanel>

        <PremiumPanel title="What needs action" description="Highest-priority issues to investigate or contain next.">
          {actionQueue.map((item) => (
            <PremiumRecord key={item.title}>
              <PremiumRecordHeader
                title={item.title}
                badge={<PremiumStatusBadge status={item.status} variant={item.status === 'critical' ? 'critical' : item.status === 'warning' ? 'warning' : 'healthy'} />}
              />
              <PremiumBody>{item.description}</PremiumBody>
            </PremiumRecord>
          ))}
        </PremiumPanel>
      </section>

      <PremiumPanel
        title="Recommended next actions"
        description="Jump directly into the workflows most likely to move reliability, cost, and behavior."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {nextActions.map((action) => (
            <PremiumRecord key={action.title}>
              <PremiumRecordHeader title={action.title} />
              <PremiumBody>{action.description}</PremiumBody>
              <PremiumActions>
                <PremiumActionLink href={action.href}>{action.cta}</PremiumActionLink>
              </PremiumActions>
            </PremiumRecord>
          ))}
        </div>
      </PremiumPanel>
    </DashboardPage>
  );
}
