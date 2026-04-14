'use client';

import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageWarningState } from '@/components/ui/page-state';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import type { PromptResponse } from '@foxhound/api-client';

interface PromptListViewProps {
  prompts: PromptResponse[];
  focusedPromptName?: string;
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

export function PromptListView({ prompts, focusedPromptName }: PromptListViewProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const sortedPrompts = filterByDashboardScope(prompts, filters, {
    searchableText: (prompt) => `${prompt.name} ${prompt.id}`,
    promptIds: (prompt) => [prompt.name],
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Prompts</h1>
        <p className="text-sm text-muted-foreground">
          Browse saved prompts, inspect versions, and jump into prompt comparisons.
        </p>
        {focusedPromptName ? (
          <p className="text-sm text-muted-foreground">
            Focused from another workflow: <span className="font-medium text-foreground">{focusedPromptName}</span>
          </p>
        ) : null}
      </div>

      <DashboardFilterBar definitions={promptFilters} />

      {sortedPrompts.length === 0 ? (
        <PageWarningState
          title="No prompts yet"
          message="Create a prompt in the API first, then return here to review versions and compare changes."
        />
      ) : (
        <div className="grid gap-4">
          {sortedPrompts.map((prompt) => {
            const isFocused = focusedPromptName?.toLowerCase() === prompt.name.toLowerCase();

            return (
              <Card key={prompt.id} className={isFocused ? 'ring-2 ring-primary/25' : undefined}>
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <CardTitle>{prompt.name}</CardTitle>
                      <CardDescription>{prompt.id}</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {isFocused ? (
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          Focused
                        </span>
                      ) : null}
                      <a
                        href={`/prompts/${prompt.id}`}
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        View prompt
                      </a>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Updated {new Date(prompt.updatedAt).toLocaleString()}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
