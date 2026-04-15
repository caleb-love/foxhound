'use client';

import { Badge } from '@/components/ui/badge';
import {
  PremiumActionLink,
  PremiumActions,
  PremiumBody,
  PremiumMetricCard,
  PremiumPanel,
  PremiumRecord,
  PremiumRecordHeader,
  PremiumStatusBadge,
  SplitPanelLayout,
} from '@/components/sandbox/primitives';
import { PageContainer, PageHeader } from '@/components/system/page';
import { WorkbenchPanel } from '@/components/system/workbench';

export interface NotificationMetric {
  label: string;
  value: string;
  supportingText: string;
}

export interface NotificationChannelRecord {
  name: string;
  type: string;
  status: 'healthy' | 'warning' | 'critical';
  routingSummary: string;
  lastDelivery: string;
  alertsHref: string;
  regressionsHref: string;
  slasHref: string;
}

interface NotificationsGovernDashboardProps {
  metrics: NotificationMetric[];
  channels: NotificationChannelRecord[];
  nextActions: Array<{
    title: string;
    description: string;
    href: string;
    cta: string;
  }>;
}

export function NotificationsGovernDashboard({
  metrics,
  channels,
  nextActions,
}: NotificationsGovernDashboardProps) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Govern"
        title="Notifications"
        description="Understand which alerts route where, whether channels are healthy, and how operational issues escalate across budgets, SLAs, and regressions."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <PremiumMetricCard key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
        ))}
      </section>

      <WorkbenchPanel
        title="Alert routing workbench"
        description="Use this surface to understand delivery health, inspect which channels carry the highest-signal alerts, and confirm that escalation paths still match operational reality."
      >
        <SplitPanelLayout
          main={
            <PremiumPanel title="Alert routing status" description="Channel health, routing coverage, and where operators will actually get notified.">
              {channels.map((channel) => (
                <PremiumRecord key={channel.name}>
                  <PremiumRecordHeader
                    title={channel.name}
                    badge={<div className="flex items-center gap-2"><Badge variant="outline">{channel.type}</Badge><PremiumStatusBadge status={channel.status} variant={channel.status} /></div>}
                  />
                  <PremiumBody>{channel.routingSummary}</PremiumBody>
                  <div className="mt-3 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>Last delivery: {channel.lastDelivery}</div>
                  <PremiumActions>
                    <PremiumActionLink href={channel.alertsHref}>Review alert source</PremiumActionLink>
                    <PremiumActionLink href={channel.regressionsHref}>Open regressions</PremiumActionLink>
                    <PremiumActionLink href={channel.slasHref}>Open SLAs</PremiumActionLink>
                  </PremiumActions>
                </PremiumRecord>
              ))}
            </PremiumPanel>
          }
          side={
            <PremiumPanel title="Recommended next actions" description="Tighten routing and ensure the highest-signal alerts are visible to the right operators.">
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
      </WorkbenchPanel>
    </PageContainer>
  );
}
