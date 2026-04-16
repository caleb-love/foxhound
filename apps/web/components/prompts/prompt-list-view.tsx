'use client';

import Link from 'next/link';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { PageWarningState } from '@/components/ui/page-state';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import type { PromptResponse } from '@foxhound/api-client';
import { PageContainer, PageHeader, StatusBadge } from '@/components/system/page';
import { VerdictBar } from '@/components/investigation';

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

export function PromptListView({ prompts, performanceByPrompt, focusedPromptName, baseHref = '' }: PromptListViewProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const sortedPrompts = filterByDashboardScope(prompts, filters, {
    searchableText: (prompt) => `${prompt.name} ${prompt.id}`,
    promptIds: (prompt) => [prompt.name],
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

      {sortedPrompts.length === 0 ? (
        <PageWarningState
          title="No prompts yet"
          message="Create a prompt in the API first, then return here to review versions and compare changes."
        />
      ) : (
        <div
          className="overflow-hidden rounded-[var(--tenant-radius-panel)] border"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}
        >
          {/* Table header */}
          <div
            className="grid items-center border-b px-4 py-2"
            style={{
              gridTemplateColumns: performanceByPrompt ? '1.2fr 60px 80px 100px 110px 90px' : '1fr 100px 120px',
              borderColor: 'var(--tenant-panel-stroke)',
              background: 'color-mix(in srgb, var(--card) 88%, var(--background))',
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">Prompt</span>
            {performanceByPrompt ? (
              <>
                <span className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">Ver</span>
                <span className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">Traces</span>
                <span className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">Health</span>
                <span className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">Avg cost</span>
              </>
            ) : (
              <span className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">Updated</span>
            )}
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">Actions</span>
          </div>

          {/* Rows */}
          <div className="divide-y" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
            {sortedPrompts.map((prompt) => {
              const isFocused = focusedPromptName?.toLowerCase() === prompt.name.toLowerCase();
              const perf = performanceByPrompt?.[prompt.name];
              const healthPct = perf ? (1 - perf.errorRate) * 100 : null;

              return (
                <div
                  key={prompt.id}
                  className="grid items-center px-4 py-3 transition-colors hover:bg-[color:color-mix(in_srgb,var(--tenant-accent)_4%,var(--card))]"
                  style={{
                    gridTemplateColumns: performanceByPrompt ? '1.2fr 60px 80px 100px 110px 90px' : '1fr 100px 120px',
                    borderLeft: isFocused ? '3px solid var(--tenant-accent)' : '3px solid transparent',
                    background: isFocused ? 'color-mix(in srgb, var(--tenant-accent) 6%, var(--card))' : undefined,
                  }}
                >
                  {/* Name and ID */}
                  <div className="min-w-0">
                    <Link
                      href={`${baseHref}/prompts/${prompt.id}`}
                      className="text-sm font-semibold text-tenant-text-primary hover:underline"
                    >
                      {prompt.name}
                    </Link>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-tenant-text-muted">{prompt.id}</div>
                  </div>

                  {performanceByPrompt ? (
                    <>
                      {/* Version */}
                      <div className="text-center text-xs font-semibold text-tenant-text-secondary">
                        {perf?.latestVersion !== undefined ? `v${perf.latestVersion}` : '-'}
                      </div>

                      {/* Trace count */}
                      <div className="text-center font-mono text-xs text-tenant-text-secondary">
                        {perf ? perf.traceCount.toLocaleString() : '-'}
                      </div>

                      {/* Health bar */}
                      <div className="flex justify-center">
                        {healthPct !== null ? <HealthBar value={healthPct} /> : <span className="text-xs text-tenant-text-muted">-</span>}
                      </div>

                      {/* Avg cost */}
                      <div className="text-center font-mono text-xs text-tenant-text-secondary">
                        {perf ? `$${perf.avgCostUsd.toFixed(4)}` : '-'}
                      </div>
                    </>
                  ) : (
                    /* Fallback: just updated date */
                    <div className="text-center text-xs text-tenant-text-muted">
                      {new Date(prompt.updatedAt).toLocaleDateString()}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`${baseHref}/prompts/${prompt.id}`}
                      className="rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-xs font-medium transition-colors hover:border-[color:var(--tenant-accent)]"
                      style={{ borderColor: 'var(--tenant-panel-stroke)', color: 'var(--tenant-accent)' }}
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
