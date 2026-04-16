'use client';

import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { PageContainer, PageHeader } from '@/components/system/page';
import { DataGrid, DataGridBody, DataGridCell, DataGridFooter, DataGridHead, DataGridHeader, DataGridRow, VerdictBar, MetricChip, MetricStrip, InlineAction, InlineActionBar } from '@/components/investigation';
import { Plus, Eye, Settings } from 'lucide-react';
import { ComparisonScorecard } from '@/components/charts/comparison-scorecard';

export interface SlaRecord {
  agentId: string;
  maxDurationMs: number;
  minSuccessRate: number;
  observedDurationMs: number;
  observedSuccessRate: number;
  status: string;
  summary: string;
  updatedAt?: string;
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
    timestampMs: (item) => (item.updatedAt ? new Date(item.updatedAt).getTime() : undefined),
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

      <ComparisonScorecard
        title="SLA decomposition"
        description="Separate latency pressure from success-rate pressure so the next control change targets the real failure mode."
        items={[
          {
            label: 'Latency breaches',
            current: String(filtered.filter((sla) => sla.observedDurationMs > sla.maxDurationMs).length),
            supportingText: 'Agents currently missing their duration target.',
            tone: filtered.some((sla) => sla.observedDurationMs > sla.maxDurationMs) ? 'warning' : 'healthy',
          },
          {
            label: 'Success breaches',
            current: String(filtered.filter((sla) => sla.observedSuccessRate < sla.minSuccessRate).length),
            supportingText: 'Agents currently missing their minimum success-rate target.',
            tone: filtered.some((sla) => sla.observedSuccessRate < sla.minSuccessRate) ? 'critical' : 'healthy',
          },
          {
            label: 'Both dimensions',
            current: String(filtered.filter((sla) => sla.observedDurationMs > sla.maxDurationMs && sla.observedSuccessRate < sla.minSuccessRate).length),
            supportingText: 'Agents breaching both reliability dimensions at once.',
            tone: filtered.some((sla) => sla.observedDurationMs > sla.maxDurationMs && sla.observedSuccessRate < sla.minSuccessRate) ? 'critical' : 'healthy',
          },
          {
            label: 'Scoped view',
            current: filters.agentIds.length > 0 ? 'Segmented' : 'Fleet-wide',
            supportingText: filters.agentIds.length > 0 ? `Analytics currently narrowed to ${filters.agentIds.length} agent scope(s).` : 'No agent segmentation is active.',
            tone: filters.agentIds.length > 0 ? 'warning' : 'default',
          },
        ]}
      />

      {filtered.length === 0 ? (
        <div className="rounded-[var(--tenant-radius-panel)] border p-12 text-center" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
          <p className="text-sm text-tenant-text-muted">
            {slas.length === 0 ? 'Set your first SLA target to start monitoring.' : 'No SLAs match the current filter.'}
          </p>
        </div>
      ) : (
        <DataGrid>
          <DataGridHeader columns="minmax(0,1fr) 108px 116px 88px 68px">
            <DataGridHead>Agent</DataGridHead>
            <DataGridHead className="text-center">Latency</DataGridHead>
            <DataGridHead className="text-center">Success rate</DataGridHead>
            <DataGridHead className="text-center">Status</DataGridHead>
            <DataGridHead className="sr-only">Actions</DataGridHead>
          </DataGridHeader>

          <DataGridBody>
            {filtered.map((sla) => {
              const latencyOk = sla.observedDurationMs <= sla.maxDurationMs;
              const successOk = sla.observedSuccessRate >= sla.minSuccessRate;

              return (
                <DataGridRow
                  key={sla.agentId}
                  columns="minmax(0,1fr) 108px 116px 88px 68px"
                  style={{
                    borderLeft: sla.status !== 'healthy' ? `3px solid ${sla.status === 'critical' ? 'var(--tenant-danger)' : 'var(--tenant-warning)'}` : '3px solid transparent',
                  }}
                >
                  <DataGridCell>
                    <span className="truncate text-sm font-semibold text-tenant-text-primary">{sla.agentId}</span>
                    <div className="mt-0.5 truncate text-[11px] text-tenant-text-muted">{sla.summary}</div>
                  </DataGridCell>

                  <DataGridCell className="text-center">
                    <div className="font-mono text-xs" style={{ color: latencyOk ? 'var(--tenant-success)' : 'var(--tenant-danger)' }}>
                      {(sla.observedDurationMs / 1000).toFixed(1)}s
                    </div>
                    <div className="text-[9px] text-tenant-text-muted">/ {(sla.maxDurationMs / 1000).toFixed(1)}s max</div>
                  </DataGridCell>

                  <DataGridCell className="text-center">
                    <div className="font-mono text-xs" style={{ color: successOk ? 'var(--tenant-success)' : 'var(--tenant-danger)' }}>
                      {(sla.observedSuccessRate * 100).toFixed(1)}%
                    </div>
                    <div className="text-[9px] text-tenant-text-muted">/ {(sla.minSuccessRate * 100).toFixed(0)}% min</div>
                  </DataGridCell>

                  <DataGridCell className="text-center">
                    <div
                      className="mx-auto h-2 w-2 rounded-full"
                      style={{ background: sla.status === 'healthy' ? 'var(--tenant-success)' : sla.status === 'warning' ? 'var(--tenant-warning)' : 'var(--tenant-danger)' }}
                    />
                  </DataGridCell>

                  <DataGridCell className="flex items-center justify-end whitespace-nowrap">
                    <InlineAction href={`${baseHref}/slas`} variant="ghost" className="text-[11px] px-2 py-0.5">
                      <Settings className="h-3 w-3" />
                    </InlineAction>
                  </DataGridCell>
                </DataGridRow>
              );
            })}
          </DataGridBody>

          <DataGridFooter>
            {filtered.length} SLA{filtered.length !== 1 ? 's' : ''}
          </DataGridFooter>
        </DataGrid>
      )}
    </PageContainer>
  );
}
