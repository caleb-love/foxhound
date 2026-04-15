'use client';

import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { PageWarningState } from '@/components/ui/page-state';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import type { PromptResponse } from '@foxhound/api-client';
import { PageContainer, PageHeader, RecordBody, RecordCard, RecordHeader, StatusBadge } from '@/components/system/page';
import { WorkbenchPanel } from '@/components/system/workbench';

interface PromptListViewProps {
  prompts: PromptResponse[];
  focusedPromptName?: string;
  baseHref?: string;
}

const promptFilters: DashboardFilterDefinition[] = [
  {
    key: 'searchQuery',
    kind: 'search',
    label: 'Search',
    placeholder: 'Search prompts, versions, or linked workflows...',
  },
  {
    key: 'promptIds',
    kind: 'multi-select',
    label: 'Prompts',
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
        description="Browse saved prompts, inspect version history, and move into side-by-side prompt comparisons using the same operator workflow conventions as traces and run diff."
      >
        {focusedPromptName ? <StatusBadge status={`Focused: ${focusedPromptName}`} variant="warning" /> : null}
      </PageHeader>

      <DashboardFilterBar definitions={promptFilters} />

      {sortedPrompts.length === 0 ? (
        <PageWarningState
          title="No prompts yet"
          message="Create a prompt in the API first, then return here to review versions and compare changes."
        />
      ) : (
        <WorkbenchPanel
          title="Prompt catalog workbench"
          description="Use this catalog to find the relevant prompt family quickly, then move into prompt history or prompt comparison without losing investigation context."
        >
          {focusedPromptName ? (
            <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)', color: 'var(--tenant-text-secondary)' }}>
              Prompt focus was carried in from another workflow. Review the matching prompt first, then branch into prompt history or comparison.
            </div>
          ) : null}
          <div className="grid gap-4">
            {sortedPrompts.map((prompt) => {
              const isFocused = focusedPromptName?.toLowerCase() === prompt.name.toLowerCase();

              return (
                <RecordCard key={prompt.id} style={isFocused ? { boxShadow: '0 0 0 2px color-mix(in srgb, var(--tenant-accent) 20%, transparent)' } : undefined}>
                  <RecordHeader
                    title={prompt.name}
                    meta={prompt.id}
                    badge={isFocused ? <StatusBadge status="Focused" variant="warning" /> : undefined}
                  />
                  <RecordBody>
                    Updated {new Date(prompt.updatedAt).toLocaleString()}
                  </RecordBody>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm font-medium">
                    <a
                      href={`${baseHref}/prompts/${prompt.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      View prompt
                    </a>
                  </div>
                </RecordCard>
              );
            })}
          </div>
        </WorkbenchPanel>
      )}
    </PageContainer>
  );
}
