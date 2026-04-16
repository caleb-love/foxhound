'use client';

import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { PageContainer, PageHeader } from '@/components/system/page';
import { VerdictBar, MetricChip, MetricStrip, InlineAction, InlineActionBar } from '@/components/investigation';
import { Plus, Eye, AlertTriangle, Settings } from 'lucide-react';

export interface BudgetRecord {
  agentId: string;
  budgetUsd: number;
  currentSpendUsd: number;
  status: string;
  summary: string;
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

  const filtered = filterByDashboardScope(budgets, filters, {
    searchableText: (item) => `${item.agentId} ${item.summary}`,
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

      {filtered.length === 0 ? (
        <div className="rounded-[var(--tenant-radius-panel)] border p-12 text-center" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
          <p className="text-sm text-tenant-text-muted">
            {budgets.length === 0 ? 'Set your first agent budget to start tracking spend.' : 'No budgets match the current filter.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--tenant-radius-panel)] border" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
          <div className="grid items-center border-b px-4 py-2" style={{ gridTemplateColumns: '1fr 100px 100px 120px 80px', borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Agent</span>
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Budget</span>
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Spend</span>
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Usage</span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">Actions</span>
          </div>

          {filtered.map((budget) => {
            const pct = spendPercent(budget.currentSpendUsd, budget.budgetUsd);
            const barColor = budget.status === 'critical' ? 'var(--tenant-danger)' : budget.status === 'warning' ? 'var(--tenant-warning)' : 'var(--tenant-success)';

            return (
              <div
                key={budget.agentId}
                className="grid items-center border-b px-4 py-3 transition-colors hover:bg-[color:color-mix(in_srgb,var(--tenant-accent)_4%,var(--card))]"
                style={{
                  gridTemplateColumns: '1fr 100px 100px 120px 80px',
                  borderColor: 'var(--tenant-panel-stroke)',
                  borderLeft: budget.status === 'critical' ? '3px solid var(--tenant-danger)' : budget.status === 'warning' ? '3px solid var(--tenant-warning)' : '3px solid transparent',
                }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {budget.status === 'critical' ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tenant-danger)' }} /> : null}
                    <span className="truncate text-sm font-semibold text-tenant-text-primary">{budget.agentId}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-tenant-text-muted">{budget.summary}</div>
                </div>

                <div className="text-center font-mono text-xs text-tenant-text-primary">{formatUsd(budget.budgetUsd)}</div>

                <div className="text-center font-mono text-xs" style={{ color: barColor }}>{formatUsd(budget.currentSpendUsd)}</div>

                <div className="px-2">
                  <div className="flex items-center gap-2">
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--tenant-panel-stroke) 32%, transparent)' }}>
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold" style={{ color: barColor }}>{pct}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <InlineAction href={`${baseHref}/budgets`} variant="ghost" className="text-[11px] px-2 py-0.5">
                    <Settings className="h-3 w-3" />
                  </InlineAction>
                </div>
              </div>
            );
          })}

          <div className="border-t px-4 py-2 text-[11px] text-tenant-text-muted" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
            {filtered.length} budget{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
