'use client';

import Link from 'next/link';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { PageWarningState } from '@/components/ui/page-state';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import type { PromptResponse } from '@foxhound/api-client';
import { PageContainer, PageHeader, StatusBadge } from '@/components/system/page';
import { DataGrid, DataGridBody, DataGridCell, DataGridHead, DataGridHeader, DataGridRow, VerdictBar } from '@/components/investigation';
import { createDateRangeFromHours } from '@/lib/stores/dashboard-filter-presets';

export interface PromptPerformanceMetrics {
  traceCount: number;
  errorRate: number;
  avgCostUsd: number;
  latestVersion?: number;
}

interface PromptListViewProps {
  prompts: PromptResponse[];
  /** Performance metrics keyed by prompt name */
  performanceByPrompt?: Record<string, PromptPerformanceMetrics>;
  focusedPromptName?: string;
  baseHref?: string;
  pagination?: {
    page: number;
    limit: number;
    count: number;
  };
}

const promptFilters: DashboardFilterDefinition[] = [
  { key: 'searchQuery', kind: 'search', label: 'Search', placeholder: 'Search prompts...' },
  {
    key: 'promptIds', kind: 'multi-select', label: 'Prompts',
    options: [
      { value: 'support-routing', label: 'support-routing' },
      { value: 'onboarding-router', label: 'onboarding-router' },
      { value: 'refund-policy-check', label: 'refund-policy-check' },
    ],
  },
];

function HealthBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = value >= 95 ? 'var(--tenant-success)' : value >= 85 ? 'var(--tenant-warning)' : 'var(--tenant-danger)';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--tenant-panel-stroke) 48%, transparent)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono text-[11px] tabular-nums" style={{ color }}>{value.toFixed(1)}%</span>
    </div>
  );
}

export function PromptListView({ prompts, performanceByPrompt, focusedPromptName, baseHref = '', pagination }: PromptListViewProps) {
  const filters = useSegmentStore((state) => state.currentFilters);
  const defaultDateRange = createDateRangeFromHours(24);
  const hasExplicitDateFilter =
    Math.abs(filters.dateRange.start.getTime() - defaultDateRange.start.getTime()) > 5 * 60 * 1000 ||
    Math.abs(filters.dateRange.end.getTime() - defaultDateRange.end.getTime()) > 5 * 60 * 1000;

  const sortedPrompts = filterByDashboardScope(prompts, filters, {
    searchableText: (prompt) => `${prompt.name} ${prompt.id}`,
    promptIds: (prompt) => [prompt.name],
    timestampMs: hasExplicitDateFilter ? (prompt) => new Date(prompt.updatedAt).getTime() : undefined,
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Investigate"
        title="Prompts"
        description="Browse prompt families, compare versions, and correlate prompt changes with trace regressions."
      >
        {focusedPromptName ? <StatusBadge status={`Focused: ${focusedPromptName}`} variant="warning" /> : null}
      </PageHeader>

      <DashboardFilterBar definitions={promptFilters} />

      {focusedPromptName ? (
        <VerdictBar
          severity="info"
          headline={`Focused on ${focusedPromptName}`}
          summary="This prompt was carried in from another investigation workflow. Review the matching prompt first, then branch into version comparison."
        />
      ) : null}

      {pagination && baseHref === '' ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-[var(--tenant-radius-panel-tight)] border px-3 py-2 text-sm" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
          <div className="text-tenant-text-secondary">
            Showing <span className="font-medium text-tenant-text-primary">{sortedPrompts.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}-{sortedPrompts.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + sortedPrompts.length}</span> of{' '}
            <span className="font-medium text-tenant-text-primary">{pagination.count}</span> prompts
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={pagination.page <= 2 ? '/prompts' : `/prompts?page=${pagination.page - 1}`}
              aria-disabled={pagination.page <= 1}
              className="rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-xs font-medium transition-opacity"
              style={{
                borderColor: 'var(--tenant-panel-stroke)',
                color: pagination.page > 1 ? 'var(--tenant-text-primary)' : 'var(--tenant-text-muted)',
                pointerEvents: pagination.page > 1 ? 'auto' : 'none',
                opacity: pagination.page > 1 ? 1 : 0.5,
              }}
            >
              Previous
            </Link>
            <span className="text-xs text-tenant-text-muted">Page {pagination.page}</span>
            <Link
              href={`/prompts?page=${pagination.page + 1}`}
              aria-disabled={pagination.count <= pagination.page * pagination.limit}
              className="rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-xs font-medium transition-opacity"
              style={{
                borderColor: 'var(--tenant-panel-stroke)',
                color: pagination.count > pagination.page * pagination.limit ? 'var(--tenant-text-primary)' : 'var(--tenant-text-muted)',
                pointerEvents: pagination.count > pagination.page * pagination.limit ? 'auto' : 'none',
                opacity: pagination.count > pagination.page * pagination.limit ? 1 : 0.5,
              }}
            >
              Next
            </Link>
          </div>
        </div>
      ) : null}

      {sortedPrompts.length === 0 ? (
        <PageWarningState
          title={prompts.length === 0 ? 'No prompts yet' : 'No prompts match the current filter'}
          message={prompts.length === 0
            ? 'Create a prompt in the API first, then return here to review versions and compare changes.'
            : 'Adjust the active search or segment filters to see the seeded prompt catalog again.'}
        />
      ) : (
        <DataGrid>
          <DataGridHeader columns={performanceByPrompt ? 'minmax(0,1.2fr) 64px 84px 108px 112px 92px' : 'minmax(0,1fr) 112px 120px'}>
            <DataGridHead className="tracking-[0.14em]">Prompt</DataGridHead>
            {performanceByPrompt ? (
              <>
                <DataGridHead className="text-center tracking-[0.14em]">Ver</DataGridHead>
                <DataGridHead className="text-center tracking-[0.14em]">Traces</DataGridHead>
                <DataGridHead className="text-center tracking-[0.14em]">Health</DataGridHead>
                <DataGridHead className="text-center tracking-[0.14em]">Avg cost</DataGridHead>
              </>
            ) : (
              <DataGridHead className="text-center tracking-[0.14em]">Updated</DataGridHead>
            )}
            <DataGridHead className="text-right tracking-[0.14em]">Actions</DataGridHead>
          </DataGridHeader>

          <DataGridBody>
            {sortedPrompts.map((prompt) => {
              const isFocused = focusedPromptName?.toLowerCase() === prompt.name.toLowerCase();
              const perf = performanceByPrompt?.[prompt.name];
              const healthPct = perf ? (1 - perf.errorRate) * 100 : null;

              return (
                <DataGridRow
                  key={prompt.id}
                  columns={performanceByPrompt ? 'minmax(0,1.2fr) 64px 84px 108px 112px 92px' : 'minmax(0,1fr) 112px 120px'}
                  style={{
                    borderLeft: isFocused ? '3px solid var(--tenant-accent)' : '3px solid transparent',
                    background: isFocused ? 'color-mix(in srgb, var(--tenant-accent) 6%, var(--card))' : undefined,
                  }}
                >
                  <DataGridCell>
                    <Link
                      href={`${baseHref}/prompts/${prompt.id}`}
                      className="text-sm font-semibold text-tenant-text-primary hover:underline"
                    >
                      {prompt.name}
                    </Link>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-tenant-text-muted">{prompt.id}</div>
                  </DataGridCell>

                  {performanceByPrompt ? (
                    <>
                      <DataGridCell className="text-center text-xs font-semibold text-tenant-text-secondary">
                        {perf?.latestVersion !== undefined ? `v${perf.latestVersion}` : '-'}
                      </DataGridCell>

                      <DataGridCell className="text-center font-mono text-xs text-tenant-text-secondary">
                        {perf ? perf.traceCount.toLocaleString() : '-'}
                      </DataGridCell>

                      <DataGridCell className="flex justify-center">
                        {healthPct !== null ? <HealthBar value={healthPct} /> : <span className="text-xs text-tenant-text-muted">-</span>}
                      </DataGridCell>

                      <DataGridCell className="text-center font-mono text-xs text-tenant-text-secondary">
                        {perf ? `$${perf.avgCostUsd.toFixed(4)}` : '-'}
                      </DataGridCell>
                    </>
                  ) : (
                    <DataGridCell className="text-center text-xs text-tenant-text-muted">
                      {new Date(prompt.updatedAt).toLocaleDateString()}
                    </DataGridCell>
                  )}

                  <DataGridCell className="flex items-center justify-end gap-2 whitespace-nowrap">
                    <Link
                      href={`${baseHref}/prompts/${prompt.id}`}
                      className="rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-xs font-medium transition-colors hover:border-[color:var(--tenant-accent)]"
                      style={{ borderColor: 'var(--tenant-panel-stroke)', color: 'var(--tenant-accent)' }}
                    >
                      View
                    </Link>
                  </DataGridCell>
                </DataGridRow>
              );
            })}
          </DataGridBody>
        </DataGrid>
      )}
    </PageContainer>
  );
}
