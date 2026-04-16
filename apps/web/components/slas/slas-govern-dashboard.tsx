'use client';

import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { PageContainer, PageHeader } from '@/components/system/page';
import { VerdictBar, MetricChip, MetricStrip, InlineAction, InlineActionBar } from '@/components/investigation';
import { Plus, Eye, Settings } from 'lucide-react';

export interface SlaRecord {
  agentId: string;
  maxDurationMs: number;
  minSuccessRate: number;
  observedDurationMs: number;
  observedSuccessRate: number;
  status: string;
  summary: string;
}

interface SlasGovernDashboardProps {
  slas: SlaRecord[];
  baseHref?: string;
}

const slaFilters: DashboardFilterDefinition[] = [
  { key: 'searchQuery', kind: 'search', label: 'Search', placeholder: 'Search agents or SLAs...' },
];

export function SlasGovernDashboard({ slas, baseHref = '' }: SlasGovernDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filtered = filterByDashboardScope(slas, filters, {
    searchableText: (item) => `${item.agentId} ${item.summary}`,
  });

  const atRisk = slas.filter((s) => s.status === 'critical' || s.status === 'warning').length;
  const healthy = slas.filter((s) => s.status === 'healthy').length;

  const verdictSeverity = slas.length === 0 ? 'info' as const : atRisk > 0 ? 'warning' as const : 'success' as const;
  const verdictHeadline = slas.length === 0
    ? 'No SLAs configured'
    : atRisk > 0
      ? `${atRisk} SLA${atRisk !== 1 ? 's' : ''} at risk`
      : `All ${slas.length} SLAs healthy`;
  const verdictSummary = slas.length === 0
    ? 'Set latency and success rate targets for your agents.'
    : `${healthy} meeting targets. ${atRisk > 0 ? `${atRisk} need attention.` : ''}`;

  return (
    <PageContainer>
      <PageHeader eyebrow="Govern" title="SLAs" description="Set latency and success rate targets per agent. Monitor compliance and intervene when SLAs are at risk." />

      <DashboardFilterBar definitions={slaFilters} />

      <VerdictBar
        severity={verdictSeverity}
        headline={verdictHeadline}
        summary={verdictSummary}
        actions={
          <InlineActionBar>
            <InlineAction href={`${baseHref}/slas`} variant="primary">
              <Plus className="h-3.5 w-3.5" />
              Set SLA
            </InlineAction>
            <InlineAction href={`${baseHref}/traces`} variant="secondary">
              <Eye className="h-3.5 w-3.5" />
              Investigate latency
            </InlineAction>
          </InlineActionBar>
        }
      />

      <MetricStrip>
        <MetricChip label="Agents" value={String(slas.length)} />
        <MetricChip label="Healthy" value={String(healthy)} accent="success" />
        {atRisk > 0 ? <MetricChip label="At risk" value={String(atRisk)} accent="warning" /> : null}
      </MetricStrip>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--tenant-radius-panel)] border p-12 text-center" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
          <p className="text-sm text-tenant-text-muted">
            {slas.length === 0 ? 'Set your first SLA target to start monitoring.' : 'No SLAs match the current filter.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--tenant-radius-panel)] border" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
          <div className="grid items-center border-b px-4 py-2" style={{ gridTemplateColumns: '1fr 100px 100px 80px 60px', borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Agent</span>
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Latency</span>
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Success rate</span>
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Status</span>
            <span className="sr-only">Actions</span>
          </div>

          {filtered.map((sla) => {
            const latencyOk = sla.observedDurationMs <= sla.maxDurationMs;
            const successOk = sla.observedSuccessRate >= sla.minSuccessRate;

            return (
              <div
                key={sla.agentId}
                className="grid items-center border-b px-4 py-3 transition-colors hover:bg-[color:color-mix(in_srgb,var(--tenant-accent)_4%,var(--card))]"
                style={{
                  gridTemplateColumns: '1fr 100px 100px 80px 60px',
                  borderColor: 'var(--tenant-panel-stroke)',
                  borderLeft: sla.status !== 'healthy' ? `3px solid ${sla.status === 'critical' ? 'var(--tenant-danger)' : 'var(--tenant-warning)'}` : '3px solid transparent',
                }}
              >
                <div className="min-w-0">
                  <span className="truncate text-sm font-semibold text-tenant-text-primary">{sla.agentId}</span>
                  <div className="mt-0.5 truncate text-[11px] text-tenant-text-muted">{sla.summary}</div>
                </div>

                <div className="text-center">
                  <div className="font-mono text-xs" style={{ color: latencyOk ? 'var(--tenant-success)' : 'var(--tenant-danger)' }}>
                    {(sla.observedDurationMs / 1000).toFixed(1)}s
                  </div>
                  <div className="text-[9px] text-tenant-text-muted">/ {(sla.maxDurationMs / 1000).toFixed(1)}s max</div>
                </div>

                <div className="text-center">
                  <div className="font-mono text-xs" style={{ color: successOk ? 'var(--tenant-success)' : 'var(--tenant-danger)' }}>
                    {(sla.observedSuccessRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-[9px] text-tenant-text-muted">/ {(sla.minSuccessRate * 100).toFixed(0)}% min</div>
                </div>

                <div className="text-center">
                  <div
                    className="mx-auto h-2 w-2 rounded-full"
                    style={{ background: sla.status === 'healthy' ? 'var(--tenant-success)' : sla.status === 'warning' ? 'var(--tenant-warning)' : 'var(--tenant-danger)' }}
                  />
                </div>

                <div className="flex items-center justify-end">
                  <InlineAction href={`${baseHref}/slas`} variant="ghost" className="text-[11px] px-2 py-0.5">
                    <Settings className="h-3 w-3" />
                  </InlineAction>
                </div>
              </div>
            );
          })}

          <div className="border-t px-4 py-2 text-[11px] text-tenant-text-muted" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
            {filtered.length} SLA{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
