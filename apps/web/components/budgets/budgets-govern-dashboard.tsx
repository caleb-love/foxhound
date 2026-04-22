'use client';

import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { PageContainer, PageHeader } from '@/components/system/page';
import { DataGrid, DataGridBody, DataGridCell, DataGridFooter, DataGridHead, DataGridHeader, DataGridRow, VerdictBar, MetricChip, MetricStrip, InlineAction, InlineActionBar } from '@/components/investigation';
import { Plus, Eye, AlertTriangle, Settings } from 'lucide-react';
import { StackedBarChart } from '@/components/charts/stacked-bar-chart';
import { createDateRangeFromHours } from '@/lib/stores/dashboard-filter-presets';

export interface BudgetRecord {
  agentId: string;
  budgetUsd: number;
  currentSpendUsd: number;
  status: string;
  summary: string;
  updatedAt?: string;
}

interface BudgetsGovernDashboardProps {
  budgets: BudgetRecord[];
  baseHref?: string;
}

const budgetFilters: DashboardFilterDefinition[] = [
  { key: 'searchQuery', kind: 'search', label: 'Search', placeholder: 'Search agents or budgets...' },
];

function formatUsd(v: number): string {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function spendPercent(spend: number, budget: number): number {
  return budget > 0 ? Math.round((spend / budget) * 100) : 0;
}

export function BudgetsGovernDashboard({ budgets, baseHref = '' }: BudgetsGovernDashboardProps) {
  const filters = useSegmentStore((state) => state.currentFilters);
  const defaultDateRange = createDateRangeFromHours(24);
  const hasExplicitDateFilter =
    Math.abs(filters.dateRange.start.getTime() - defaultDateRange.start.getTime()) > 5 * 60 * 1000 ||
    Math.abs(filters.dateRange.end.getTime() - defaultDateRange.end.getTime()) > 5 * 60 * 1000;

  const filtered = filterByDashboardScope(budgets, filters, {
    searchableText: (item) => `${item.agentId} ${item.summary}`,
    timestampMs: hasExplicitDateFilter ? (item) => (item.updatedAt ? new Date(item.updatedAt).getTime() : undefined) : undefined,
  });

  const criticalCount = budgets.filter((b) => b.status === 'critical').length;
  const warningCount = budgets.filter((b) => b.status === 'warning').length;
  const totalBudget = budgets.reduce((s, b) => s + b.budgetUsd, 0);
  const totalSpend = budgets.reduce((s, b) => s + b.currentSpendUsd, 0);

  const verdictSeverity = criticalCount > 0 ? 'critical' as const : warningCount > 0 ? 'warning' as const : budgets.length === 0 ? 'info' as const : 'success' as const;
  const verdictHeadline = budgets.length === 0
    ? 'No budgets configured'
    : criticalCount > 0
      ? `${criticalCount} agent${criticalCount !== 1 ? 's' : ''} over budget`
      : `All ${budgets.length} agents within budget`;
  const verdictSummary = budgets.length === 0
    ? 'Set cost budgets for your agents to start tracking spend against limits.'
    : `Total tracked spend: ${formatUsd(totalSpend)} of ${formatUsd(totalBudget)} across ${budgets.length} agent${budgets.length !== 1 ? 's' : ''}.`;

  return (
    <PageContainer>
      <PageHeader eyebrow="Govern" title="Budgets" description="Track agent spend against monthly budgets. Identify cost hotspots and intervene before overspend." />

      <DashboardFilterBar definitions={budgetFilters} />

      <VerdictBar
        severity={verdictSeverity}
        headline={verdictHeadline}
        summary={verdictSummary}
        actions={
          <InlineActionBar>
            <InlineAction href={`${baseHref}/budgets`} variant="primary">
              <Plus className="h-3.5 w-3.5" />
              Set budget
            </InlineAction>
            <InlineAction href={`${baseHref}/traces`} variant="secondary">
              <Eye className="h-3.5 w-3.5" />
              Investigate spend
            </InlineAction>
          </InlineActionBar>
        }
      />

      <MetricStrip>
        <MetricChip label="Agents" value={String(budgets.length)} />
        <MetricChip label="Total budget" value={formatUsd(totalBudget)} />
        <MetricChip label="Current spend" value={formatUsd(totalSpend)} accent={totalSpend > totalBudget * 0.9 ? 'danger' : 'success'} />
        {criticalCount > 0 ? <MetricChip label="Over budget" value={String(criticalCount)} accent="danger" /> : null}
        {warningCount > 0 ? <MetricChip label="At risk" value={String(warningCount)} accent="warning" /> : null}
      </MetricStrip>

      <StackedBarChart
        title="Budget concentration"
        description="See whether overspend is broad or concentrated in a small number of agents before changing thresholds or traffic."
        data={filtered.map((budget) => ({
          label: budget.agentId,
          healthy: budget.status === 'healthy' ? budget.currentSpendUsd : 0,
          warning: budget.status === 'warning' ? budget.currentSpendUsd : 0,
          critical: budget.status === 'critical' ? budget.currentSpendUsd : 0,
          drillIn: { href: `${baseHref}/traces` },
        }))}
      />

      {filtered.length === 0 ? (
        <div className="rounded-[var(--tenant-radius-panel)] border p-12 text-center" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
          <p className="text-sm text-tenant-text-muted">
            {budgets.length === 0 ? 'Set your first agent budget to start tracking spend.' : 'No budgets match the current filter.'}
          </p>
        </div>
      ) : (
        <DataGrid>
          <DataGridHeader columns="minmax(0,1fr) 108px 108px 128px 88px">
            <DataGridHead>Agent</DataGridHead>
            <DataGridHead className="text-center">Budget</DataGridHead>
            <DataGridHead className="text-center">Spend</DataGridHead>
            <DataGridHead className="text-center">Usage</DataGridHead>
            <DataGridHead className="text-right">Actions</DataGridHead>
          </DataGridHeader>

          <DataGridBody>
            {filtered.map((budget) => {
              const pct = spendPercent(budget.currentSpendUsd, budget.budgetUsd);
              const barColor = budget.status === 'critical' ? 'var(--tenant-danger)' : budget.status === 'warning' ? 'var(--tenant-warning)' : 'var(--tenant-success)';

              return (
                <DataGridRow
                  key={budget.agentId}
                  columns="minmax(0,1fr) 108px 108px 128px 88px"
                  style={{
                    borderLeft: budget.status === 'critical' ? '3px solid var(--tenant-danger)' : budget.status === 'warning' ? '3px solid var(--tenant-warning)' : '3px solid transparent',
                  }}
                >
                  <DataGridCell>
                    <div className="flex items-center gap-2">
                      {budget.status === 'critical' ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tenant-danger)' }} /> : null}
                      <span className="truncate text-sm font-semibold text-tenant-text-primary">{budget.agentId}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-tenant-text-muted">{budget.summary}</div>
                  </DataGridCell>

                  <DataGridCell className="text-center font-mono text-xs text-tenant-text-primary">{formatUsd(budget.budgetUsd)}</DataGridCell>

                  <DataGridCell className="text-center font-mono text-xs" style={{ color: barColor }}>{formatUsd(budget.currentSpendUsd)}</DataGridCell>

                  <DataGridCell className="px-2">
                    <div className="flex items-center gap-2">
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--tenant-panel-stroke) 32%, transparent)' }}>
                        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold" style={{ color: barColor }}>{pct}%</span>
                    </div>
                  </DataGridCell>

                  <DataGridCell className="flex items-center justify-end whitespace-nowrap">
                    <InlineAction href={`${baseHref}/budgets`} variant="ghost" className="text-[11px] px-2 py-0.5">
                      <Settings className="h-3 w-3" />
                    </InlineAction>
                  </DataGridCell>
                </DataGridRow>
              );
            })}
          </DataGridBody>

          <DataGridFooter>
            {filtered.length} budget{filtered.length !== 1 ? 's' : ''}
          </DataGridFooter>
        </DataGrid>
      )}
    </PageContainer>
  );
}
