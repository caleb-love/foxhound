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

interface PromptListViewProps {
  prompts: PromptResponse[];
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

export function PromptListView({ prompts, focusedPromptName, baseHref = '' }: PromptListViewProps) {
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
              gridTemplateColumns: '1fr 100px 120px',
              borderColor: 'var(--tenant-panel-stroke)',
              background: 'color-mix(in srgb, var(--card) 88%, var(--background))',
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">Prompt</span>
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">Updated</span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">Actions</span>
          </div>

          {/* Rows */}
          <div className="divide-y" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
            {sortedPrompts.map((prompt) => {
              const isFocused = focusedPromptName?.toLowerCase() === prompt.name.toLowerCase();

              return (
                <div
                  key={prompt.id}
                  className="grid items-center px-4 py-3 transition-colors hover:bg-[color:color-mix(in_srgb,var(--tenant-accent)_4%,var(--card))]"
                  style={{
                    gridTemplateColumns: '1fr 100px 120px',
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

                  {/* Updated */}
                  <div className="text-center text-xs text-tenant-text-muted">
                    {new Date(prompt.updatedAt).toLocaleDateString()}
                  </div>

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
