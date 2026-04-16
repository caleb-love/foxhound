'use client';

import { MetricTile } from '@/components/charts/metric-tile';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { PageContainer, PageHeader, RecordBody, SectionPanel } from '@/components/system/page';
import { WorkbenchPanel } from '@/components/system/workbench';
import {
  PremiumActionLink,
  PremiumActions,
  PremiumBody,
  PremiumPanel,
  PremiumRecord,
  PremiumRecordHeader,
  PremiumStatusBadge,
  SplitPanelLayout,
} from '@/components/sandbox/primitives';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';

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

const notificationFilters: DashboardFilterDefinition[] = [
  {
    key: 'searchQuery',
    kind: 'search',
    label: 'Search',
    placeholder: 'Search channels, routes, or escalations...',
  },
  {
    key: 'severity',
    kind: 'single-select',
    label: 'Status',
    options: [
      { value: 'all', label: 'All statuses' },
      { value: 'healthy', label: 'Healthy' },
      { value: 'warning', label: 'Warning' },
      { value: 'critical', label: 'Critical' },
    ],
  },
  {
    key: 'agentIds',
    kind: 'multi-select',
    label: 'Channel group',
    options: [
      { value: 'ops', label: 'ops' },
      { value: 'engineering', label: 'engineering' },
      { value: 'executive', label: 'executive' },
    ],
  },
];

export function NotificationsGovernDashboard({
  metrics,
  channels,
  nextActions,
}: NotificationsGovernDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filteredChannels = filterByDashboardScope(channels, filters, {
    searchableText: (item) => `${item.name} ${item.type} ${item.routingSummary} ${item.lastDelivery}`,
    severity: (item) => item.status,
    status: (item) => item.status,
    agentIds: (item) =>
      item.name.includes('exec') ? ['executive'] : item.name.includes('engineering') ? ['engineering'] : ['ops'],
  });

  const filteredNextActions = filterByDashboardScope(nextActions, filters, {
    searchableText: (item) => `${item.title} ${item.description}`,
    agentIds: (item) =>
      item.title.toLowerCase().includes('sla')
        ? ['ops']
        : item.title.toLowerCase().includes('budget')
          ? ['engineering']
          : ['executive'],
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Govern"
        title="Notifications"
        description="Review alert routing health, understand which channels carry the highest-signal incidents, and verify that escalation paths still match how operators actually respond."
      >
        <div
          className="inline-flex items-center rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-secondary)' }}
        >
          Escalation governance
        </div>
      </PageHeader>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.24fr)_minmax(320px,0.76fr)]">
        <SectionPanel
          title="Read routing health before alert trust erodes"
          description="This page should frame notifications as an operational trust system. Show channel posture first, then route health, then the actions that reduce noise and protect escalation confidence."
        >
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
            ))}
          </section>
        </SectionPanel>

        <SectionPanel
          title="Filter routing posture"
          description="Slice by status or channel group before widening the alert-routing review."
        >
          <DashboardFilterBar definitions={notificationFilters} />
        </SectionPanel>
      </section>

      <WorkbenchPanel
        title="Alert routing workbench"
        description="Use this surface to inspect channel health, validate delivery confidence, and tighten escalation paths before the next high-severity incident."
      >
        <SplitPanelLayout
          main={
            <PremiumPanel
              title="Channel status"
              description="Operational channels framed as active routing surfaces, not just static configuration entries."
            >
              {filteredChannels.map((channel) => (
                <PremiumRecord key={channel.name}>
                  <PremiumRecordHeader
                    title={channel.name}
                    meta={`Last delivery ${channel.lastDelivery}`}
                    badge={
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-[var(--tenant-radius-control-tight)] border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em]"
                          style={{
                            borderColor: 'var(--tenant-panel-stroke)',
                            color: 'var(--tenant-text-muted)',
                            background: 'var(--card)',
                          }}
                        >
                          {channel.type}
                        </span>
                        <PremiumStatusBadge status={channel.status} variant={channel.status} />
                      </div>
                    }
                  />
                  <PremiumBody>{channel.routingSummary}</PremiumBody>
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
            <PremiumPanel
              title="Recommended next actions"
              description="Reduce alert noise, protect escalation trust, and keep the highest-signal routes visible to the right operators."
            >
              {filteredNextActions.map((action) => (
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

        <SectionPanel
          title="Routing triage framing"
          description="A compact interpretation layer between posture metrics and channel evidence, so operators can see which routes matter, where trust is weakening, and where escalation tuning should begin."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {filteredChannels.map((channel) => (
              <div
                key={channel.name}
                className="rounded-[var(--tenant-radius-panel)] border p-4"
                style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-tenant-text-muted">
                  {channel.lastDelivery}
                </div>
                <div className="mt-2 font-medium text-tenant-text-primary">{channel.name}</div>
                <div className="mt-3">
                  <RecordBody>{channel.routingSummary}</RecordBody>
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      </WorkbenchPanel>
    </PageContainer>
  );
}
