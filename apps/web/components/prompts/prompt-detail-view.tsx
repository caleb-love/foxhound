'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { PageWarningState } from '@/components/ui/page-state';
import type { PromptResponse, PromptVersionResponse } from '@foxhound/api-client';
import { ActionCard, DetailActionPanel, DetailHeader, EvidenceCard, SummaryStatCard } from '@/components/system/detail';

interface PromptDetailViewProps {
  prompt: PromptResponse;
  versions: PromptVersionResponse[];
  baseHref?: string;
}

export function PromptDetailView({ prompt, versions, baseHref = '' }: PromptDetailViewProps) {
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions],
  );

  const latestVersion = sortedVersions[0] ?? null;
  const compareHref = latestVersion && sortedVersions[1]
    ? `${baseHref}/prompts/${prompt.id}/diff?versionA=${sortedVersions[1].version}&versionB=${latestVersion.version}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <DetailHeader
            title={prompt.name}
            subtitle="Review prompt versions, understand the current published state, and jump directly into side-by-side comparisons using the same investigation workflow language as traces and run diff."
          />
          <div className="font-mono text-sm text-muted-foreground">{prompt.id}</div>
        </div>

        <DetailActionPanel title="Recommended prompt actions">
          <ActionCard
            href={`${baseHref}/prompts`}
            title="Return to prompt catalog"
            description="Go back to the prompt workbench to switch prompt families without losing the overall investigation workflow."
          />
          <ActionCard
            href={compareHref ?? '#'}
            title="Compare latest versions"
            description={compareHref
              ? `Open a side-by-side comparison between v${sortedVersions[1]?.version} and v${latestVersion?.version}.`
              : 'At least two versions are required before a meaningful prompt comparison is available.'}
            disabled={!compareHref}
          />
          <ActionCard
            href={`${baseHref}/traces`}
            title="Connect prompt changes to traces"
            description="Return to traces to verify whether recent prompt changes align with regressions, recoveries, or behavior drift."
          />
        </DetailActionPanel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryStatCard label="Prompt ID" value={prompt.id} supportingText="Stable prompt family identifier." />
        <SummaryStatCard label="Latest version" value={latestVersion ? `v${latestVersion.version}` : 'None yet'} supportingText="Most recent version available in this prompt family." />
        <SummaryStatCard label="Total versions" value={String(sortedVersions.length)} supportingText="Available versions for comparison and change review." />
      </div>

      {sortedVersions.length === 0 ? (
        <PageWarningState
          title="No prompt versions yet"
          message="Create at least two versions before comparing prompt changes."
        />
      ) : (
        <div className="space-y-4">
          {sortedVersions.map((version, index) => {
            const compareTarget = sortedVersions[index + 1] ?? null;
            const versionCompareHref = compareTarget
              ? `${baseHref}/prompts/${prompt.id}/diff?versionA=${compareTarget.version}&versionB=${version.version}`
              : null;

            return (
              <EvidenceCard key={version.id} title={`Version ${version.version}`}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">
                        {version.model ?? 'No model specified'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Created {new Date(version.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(version.labels ?? []).map((label) => (
                        <Badge key={label} variant="secondary">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs whitespace-pre-wrap">
                    {version.content}
                  </pre>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">
                      {compareTarget ? `Previous comparison target: v${compareTarget.version}` : 'Oldest available version'}
                    </span>
                    {versionCompareHref ? (
                      <a href={versionCompareHref} className="font-medium text-primary underline-offset-4 hover:underline">
                        Compare against v{compareTarget?.version}
                      </a>
                    ) : null}
                  </div>
                </div>
              </EvidenceCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
