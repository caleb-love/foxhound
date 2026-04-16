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

export interface SettingsMetric {
  label: string;
  value: string;
  supportingText: string;
}

export interface SettingsControlRecord {
  name: string;
  category: string;
  status: 'healthy' | 'warning' | 'critical';
  summary: string;
  lastChanged: string;
  href: string;
  owner: string;
}

interface SettingsGovernDashboardProps {
  metrics: SettingsMetric[];
  controls: SettingsControlRecord[];
  nextActions: Array<{
    title: string;
    description: string;
    href: string;
    cta: string;
  }>;
}

const settingsFilters: DashboardFilterDefinition[] = [
  {
    key: 'searchQuery',
    kind: 'search',
    label: 'Search',
    placeholder: 'Search settings, controls, or owners...',
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
    label: 'Owner',
    options: [
      { value: 'platform-ops', label: 'platform-ops' },
      { value: 'reliability-team', label: 'reliability-team' },
      { value: 'security-review', label: 'security-review' },
    ],
  },
];

export function SettingsGovernDashboard({
  metrics,
  controls,
  nextActions,
}: SettingsGovernDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filteredControls = filterByDashboardScope(controls, filters, {
    searchableText: (item) => `${item.name} ${item.category} ${item.summary} ${item.owner}`,
    severity: (item) => item.status,
    status: (item) => item.status,
    agentIds: (item) => [item.owner],
  });

  const filteredNextActions = filterByDashboardScope(nextActions, filters, {
    searchableText: (item) => `${item.title} ${item.description}`,
    agentIds: (item) =>
      item.title.toLowerCase().includes('security')
        ? ['security-review']
        : item.title.toLowerCase().includes('reliability')
          ? ['reliability-team']
          : ['platform-ops'],
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Govern"
        title="Settings and Controls"
        description="Review the operational controls that shape alerting, reliability guardrails, routing, and access policy, then jump directly into the surfaces that need adjustment before drift becomes an incident."
      >
        <div
          className="inline-flex items-center rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-secondary)' }}
        >
          Control governance
        </div>
      </PageHeader>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.24fr)_minmax(320px,0.76fr)]">
        <SectionPanel
          title="Read control posture before drift becomes policy debt"
          description="This page should frame settings as live operational control surfaces, not as a leftover admin appendix. Show the control posture first, then the drift, then the next intervention path."
        >
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
            ))}
          </section>
        </SectionPanel>

        <SectionPanel
          title="Filter control posture"
          description="Slice by status or owner before widening the governance review."
        >
          <DashboardFilterBar definitions={settingsFilters} />
        </SectionPanel>
      </section>

      <WorkbenchPanel
        title="Governance controls workbench"
        description="Use this surface to understand which controls are healthy, which guardrails are drifting, and where operators should intervene first."
      >
        <SplitPanelLayout
          main={
            <PremiumPanel
              title="Control status"
              description="The highest-leverage governance controls, grouped as operational artifacts instead of a generic settings placeholder."
            >
              {filteredControls.map((control) => (
                <PremiumRecord key={control.name}>
                  <PremiumRecordHeader
                    title={control.name}
                    meta={`Last changed ${control.lastChanged}`}
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
                          {control.category}
                        </span>
                        <PremiumStatusBadge status={control.status} variant={control.status} />
                      </div>
                    }
                  />
                  <PremiumBody>{control.summary}</PremiumBody>
                  <div className="mt-3 text-xs text-tenant-text-muted">
                    Owner: {control.owner}
                  </div>
                  <PremiumActions>
                    <PremiumActionLink href={control.href}>Review surface</PremiumActionLink>
                  </PremiumActions>
                </PremiumRecord>
              ))}
            </PremiumPanel>
          }
          side={
            <PremiumPanel
              title="Recommended next actions"
              description="Resolve drift in the order that best protects operators, responders, and customer-facing reliability."
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
          title="Control triage framing"
          description="A compact interpretation layer between posture metrics and control records, so operators can see where policy drift matters, who owns it, and where to intervene first."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {filteredControls.map((control) => (
              <div
                key={control.name}
                className="rounded-[var(--tenant-radius-panel)] border p-4"
                style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-tenant-text-muted">
                  {control.lastChanged}
                </div>
                <div className="mt-2 font-medium text-tenant-text-primary">{control.name}</div>
                <div className="mt-3">
                  <RecordBody>{control.summary}</RecordBody>
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      </WorkbenchPanel>
    </PageContainer>
  );
}
