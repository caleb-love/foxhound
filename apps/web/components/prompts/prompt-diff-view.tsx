'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { PageWarningState } from '@/components/ui/page-state';
import type { PromptVersionDiffResponse, PromptVersionResponse } from '@foxhound/api-client';
import { CompareContextCard, DetailActionPanel, DetailHeader, EvidenceCard, ActionCard } from '@/components/system/detail';

interface PromptDiffViewProps {
  promptName: string;
  versions: PromptVersionResponse[];
  initialDiff: PromptVersionDiffResponse | null;
  initialVersionA?: number;
  initialVersionB?: number;
  baseHref?: string;
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
  baseHref = '',
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
    return `${baseHref ? `${baseHref}/prompts` : ''}?${query.toString()}`;
  }, [baseHref, selectedA, selectedB]);

  const releaseReviewHref = useMemo(() => {
    if (!selectedA || !selectedB) return `${baseHref}/prompts`;
    return `${baseHref}/prompts?baseline=${encodeURIComponent(selectedA)}&comparison=${encodeURIComponent(selectedB)}&focus=${encodeURIComponent(promptName)}`;
  }, [baseHref, promptName, selectedA, selectedB]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <DetailHeader
            title="Prompt Comparison"
            subtitle={`Compare prompt versions for ${promptName} and inspect content, model, and config changes using the same side-by-side investigation patterns as run diff.`}
          />
        </div>

        <DetailActionPanel title="Comparison controls and next actions">
          <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
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
          </div>

          <ActionCard
            href={compareHref ?? '#'}
            title="Run prompt comparison"
            description={compareHref
              ? 'Reload the page with the selected baseline and comparison versions.'
              : 'Choose both versions first to inspect prompt differences.'}
            disabled={!compareHref}
          />
          <ActionCard
            href={`${baseHref}/prompts`}
            title="Return to prompt catalog"
            description="Switch prompt families or reopen prompt detail using the shared prompt workbench."
          />
          <ActionCard
            href={`${baseHref}/traces`}
            title="Reconnect to traces"
            description="Return to traces to validate whether these prompt changes correlate with an observed regression or recovery."
          />
          <ActionCard
            href={releaseReviewHref}
            title="Carry this pair into release review"
            description="Reopen the prompt family with the same baseline and comparison versions preserved so release controls and label decisions stay anchored to this exact comparison."
          />
        </DetailActionPanel>
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
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <CompareContextCard
              label="Baseline version"
              id={`v${initialDiff.versionA}`}
              meta={[
                `Prompt: ${promptName}`,
                `${initialDiff.changes.length} changed field(s) detected across the comparison.`,
              ]}
            />
            <CompareContextCard
              label="Comparison version"
              id={`v${initialDiff.versionB}`}
              meta={[
                `Prompt: ${promptName}`,
                'Review changed fields below to understand the likely behavior shift.',
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">v{initialDiff.versionA}</Badge>
            <span>→</span>
            <Badge>v{initialDiff.versionB}</Badge>
            <span>{initialDiff.changes.length} changed field(s)</span>
          </div>

          <div className="space-y-4">
            {initialDiff.changes.map((change: PromptVersionDiffResponse['changes'][number]) => (
              <EvidenceCard key={change.field} title={change.field.charAt(0).toUpperCase() + change.field.slice(1)}>
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
              </EvidenceCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
