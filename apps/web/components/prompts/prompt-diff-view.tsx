'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageWarningState } from '@/components/ui/page-state';
import type { PromptVersionDiffResponse, PromptVersionResponse } from '@foxhound/api-client';

interface PromptDiffViewProps {
  promptName: string;
  versions: PromptVersionResponse[];
  initialDiff: PromptVersionDiffResponse | null;
  initialVersionA?: number;
  initialVersionB?: number;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

export function PromptDiffView({
  promptName,
  versions,
  initialDiff,
  initialVersionA,
  initialVersionB,
}: PromptDiffViewProps) {
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions],
  );

  const [selectedA, setSelectedA] = useState<string>(initialVersionA ? String(initialVersionA) : '');
  const [selectedB, setSelectedB] = useState<string>(initialVersionB ? String(initialVersionB) : '');

  const compareHref = useMemo(() => {
    if (!selectedA || !selectedB) return null;
    const query = new URLSearchParams({ versionA: selectedA, versionB: selectedB });
    return `?${query.toString()}`;
  }, [selectedA, selectedB]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Prompt Comparison</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare prompt versions for <span className="font-medium text-foreground">{promptName}</span>.
          </p>
        </div>

        <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Baseline version</span>
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={selectedA}
              onChange={(event) => setSelectedA(event.target.value)}
            >
              <option value="">Select version</option>
              {sortedVersions.map((version) => (
                <option key={`a-${version.id}`} value={version.version}>
                  v{version.version}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium">Comparison version</span>
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={selectedB}
              onChange={(event) => setSelectedB(event.target.value)}
            >
              <option value="">Select version</option>
              {sortedVersions.map((version) => (
                <option key={`b-${version.id}`} value={version.version}>
                  v{version.version}
                </option>
              ))}
            </select>
          </label>

          <a
            href={compareHref ?? '#'}
            aria-disabled={!compareHref}
            className={[
              'inline-flex min-w-28 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground',
              'h-10 transition-opacity',
              compareHref ? 'hover:opacity-90' : 'pointer-events-none opacity-50',
            ].join(' ')}
          >
            Compare
          </a>
        </div>
      </div>

      {!initialDiff ? (
        <PageWarningState
          title="Choose two versions"
          message="Select a baseline and comparison version to inspect prompt changes."
        />
      ) : !initialDiff.hasChanges ? (
        <PageWarningState
          title="No differences found"
          message={`Versions ${initialDiff.versionA} and ${initialDiff.versionB} have identical prompt content, model, and config.`}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">v{initialDiff.versionA}</Badge>
            <span>→</span>
            <Badge>v{initialDiff.versionB}</Badge>
            <span>{initialDiff.changes.length} changed field(s)</span>
          </div>

          {initialDiff.changes.map((change: PromptVersionDiffResponse['changes'][number]) => (
            <Card key={change.field}>
              <CardHeader>
                <CardTitle className="capitalize">{change.field}</CardTitle>
                <CardDescription>
                  Difference between version {initialDiff.versionA} and version {initialDiff.versionB}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Before
                    </div>
                    <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs whitespace-pre-wrap">
                      {formatValue(change.before)}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      After
                    </div>
                    <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs whitespace-pre-wrap">
                      {formatValue(change.after)}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
