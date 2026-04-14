'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageWarningState } from '@/components/ui/page-state';
import type { PromptResponse, PromptVersionResponse } from '@foxhound/api-client';

interface PromptDetailViewProps {
  prompt: PromptResponse;
  versions: PromptVersionResponse[];
}

export function PromptDetailView({ prompt, versions }: PromptDetailViewProps) {
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions],
  );

  const latestVersion = sortedVersions[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{prompt.name}</h1>
        <p className="text-sm text-muted-foreground">
          Review prompt versions and jump into a side-by-side comparison.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prompt overview</CardTitle>
          <CardDescription>Latest published state and available versions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prompt ID</div>
            <div className="mt-1 font-mono text-sm">{prompt.id}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Latest version</div>
            <div className="mt-1 text-sm">{latestVersion ? `v${latestVersion.version}` : 'None yet'}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total versions</div>
            <div className="mt-1 text-sm">{sortedVersions.length}</div>
          </div>
        </CardContent>
      </Card>

      {sortedVersions.length === 0 ? (
        <PageWarningState
          title="No prompt versions yet"
          message="Create at least two versions before comparing prompt changes."
        />
      ) : (
        <div className="space-y-4">
          {sortedVersions.map((version, index) => {
            const compareTarget = sortedVersions[index + 1] ?? null;
            const compareHref = compareTarget
              ? `/prompts/${prompt.id}/diff?versionA=${compareTarget.version}&versionB=${version.version}`
              : null;

            return (
              <Card key={version.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <CardTitle>Version {version.version}</CardTitle>
                      <CardDescription>
                        {version.model ?? 'No model specified'}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(version.labels ?? []).map((label) => (
                        <Badge key={label} variant="secondary">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs whitespace-pre-wrap">
                    {version.content}
                  </pre>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">
                      Created {new Date(version.createdAt).toLocaleString()}
                    </span>
                    {compareHref ? (
                      <a href={compareHref} className="font-medium text-primary underline-offset-4 hover:underline">
                        Compare against v{compareTarget?.version}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Oldest available version</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
