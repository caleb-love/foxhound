'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { PageWarningState } from '@/components/ui/page-state';
import type { PromptVersionDiffResponse, PromptVersionResponse } from '@foxhound/api-client';
import { VerdictBar, InlineAction, InlineActionBar } from '@/components/investigation';
import { VersionImpactStrip, type VersionMetrics, type VersionImpact } from '@/components/prompts/version-impact-strip';
import { computeWordDiff, type DiffSegment } from '@/lib/word-diff';
import { ArrowLeft, GitCompare, Eye, FlaskConical } from 'lucide-react';

interface PromptDiffViewProps {
  promptName: string;
  versions: PromptVersionResponse[];
  initialDiff: PromptVersionDiffResponse | null;
  initialVersionA?: number;
  initialVersionB?: number;
  /** Per-version performance metrics keyed by version number */
  performanceByVersion?: Record<number, VersionMetrics>;
  baseHref?: string;
}

/* The diff algorithm is shared: see lib/word-diff.ts */

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
  performanceByVersion,
  baseHref = '',
}: PromptDiffViewProps) {
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions],
  );

  const [selectedA, setSelectedA] = useState<string>(initialVersionA ? String(initialVersionA) : '');
  const [selectedB, setSelectedB] = useState<string>(initialVersionB ? String(initialVersionB) : '');

  const releaseReviewHref = useMemo(() => {
    if (!selectedA || !selectedB) return `${baseHref}/prompts`;
    return `${baseHref}/prompts?baseline=${encodeURIComponent(selectedA)}&comparison=${encodeURIComponent(selectedB)}&focus=${encodeURIComponent(promptName)}`;
  }, [baseHref, promptName, selectedA, selectedB]);

  const changeCount = initialDiff?.changes.length ?? 0;

  // Verdict
  const verdictSeverity = !initialDiff
    ? 'info' as const
    : !initialDiff.hasChanges
      ? 'success' as const
      : changeCount >= 3
        ? 'warning' as const
        : 'info' as const;

  const verdictHeadline = !initialDiff
    ? 'Select two versions to compare'
    : !initialDiff.hasChanges
      ? 'Versions are identical'
      : `${changeCount} field${changeCount > 1 ? 's' : ''} changed between v${initialDiff.versionA} and v${initialDiff.versionB}`;

  const verdictSummary = !initialDiff
    ? 'Choose a baseline and comparison version above to inspect prompt changes.'
    : !initialDiff.hasChanges
      ? `v${initialDiff.versionA} and v${initialDiff.versionB} have identical content, model, and config.`
      : 'Review the diff below to understand the behavior shift, then check traces to see if this change correlated with a regression or improvement.';

  return (
    <div className="space-y-4">
      {/* Back */}
      <Link
        href={`${baseHref}/prompts`}
        className="inline-flex items-center gap-1.5 text-sm text-tenant-text-muted transition-colors hover:text-tenant-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Prompts
      </Link>

      {/* Header with version selectors */}
      <div
        className="rounded-[var(--tenant-radius-panel)] border p-4"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 94%, var(--background))' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-tenant-text-primary">Prompt Comparison</h1>
            <p className="mt-1 text-sm text-tenant-text-secondary">{promptName}</p>
          </div>
          <InlineActionBar>
            <InlineAction href={`${baseHref}/traces`} variant="secondary">
              <Eye className="h-3.5 w-3.5" />
              Linked traces
            </InlineAction>
            <InlineAction href={`${baseHref}/experiments`} variant="ghost">
              <FlaskConical className="h-3.5 w-3.5" />
              Experiments
            </InlineAction>
            <InlineAction href={releaseReviewHref} variant="ghost">
              <GitCompare className="h-3.5 w-3.5" />
              Carry this pair into release review
            </InlineAction>
          </InlineActionBar>
        </div>

        {/* Version selectors */}
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">
              Baseline
            </label>
            <select
              className="mt-1 block w-full rounded-[var(--tenant-radius-control-tight)] border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-primary)' }}
              value={selectedA}
              onChange={(e) => setSelectedA(e.target.value)}
            >
              <option value="">Select version</option>
              {sortedVersions.map((v) => (
                <option key={`a-${v.id}`} value={v.version}>v{v.version}{v.model ? ` (${v.model})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end justify-center pb-2 text-tenant-text-muted">→</div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">
              Comparison
            </label>
            <select
              className="mt-1 block w-full rounded-[var(--tenant-radius-control-tight)] border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-primary)' }}
              value={selectedB}
              onChange={(e) => setSelectedB(e.target.value)}
            >
              <option value="">Select version</option>
              {sortedVersions.map((v) => (
                <option key={`b-${v.id}`} value={v.version}>v{v.version}{v.model ? ` (${v.model})` : ''}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Verdict */}
      <VerdictBar severity={verdictSeverity} headline={verdictHeadline} summary={verdictSummary} />

      {/* Performance impact strip */}
      {(() => {
        if (!performanceByVersion || !initialVersionA || !initialVersionB) return null;
        const before = performanceByVersion[initialVersionA];
        const after = performanceByVersion[initialVersionB];
        if (!before || !after) return null;
        const impact: VersionImpact = { fromVersion: initialVersionA, toVersion: initialVersionB, before, after };
        return <VersionImpactStrip impact={impact} />;
      })()}

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
          {/* Change summary strip */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className="text-[10px]">v{initialDiff.versionA}</Badge>
            <span className="text-tenant-text-muted">→</span>
            <Badge className="text-[10px]">v{initialDiff.versionB}</Badge>
            <span className="text-tenant-text-muted">{changeCount} changed field{changeCount !== 1 ? 's' : ''}</span>
          </div>

          {/* Diff cards */}
          <div className="space-y-4">
            {initialDiff.changes.map((change: PromptVersionDiffResponse['changes'][number]) => {
              const beforeStr = formatValue(change.before);
              const afterStr = formatValue(change.after);
              const isTextContent = typeof change.before === 'string' && typeof change.after === 'string';
              const segments = isTextContent ? computeWordDiff(beforeStr, afterStr) : null;

              return (
                <div
                  key={change.field}
                  className="overflow-hidden rounded-[var(--tenant-radius-panel)] border"
                  style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}
                >
                  {/* Field header */}
                  <div
                    className="flex items-center justify-between border-b px-4 py-2"
                    style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
                  >
                    <span className="text-sm font-semibold text-tenant-text-primary">
                      {change.field.charAt(0).toUpperCase() + change.field.slice(1)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">
                      Changed
                    </span>
                  </div>

                  {segments ? (
                    /* Character-level highlighted diff for text content */
                    <div className="p-4">
                      <div className="overflow-x-auto rounded-[var(--tenant-radius-panel-tight)] border p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 92%, var(--background))' }}>
                        {segments.map((seg, idx) => {
                          if (seg.type === 'equal') {
                            return <span key={idx} className="text-tenant-text-secondary">{seg.text}</span>;
                          }
                          if (seg.type === 'added') {
                            return (
                              <span
                                key={idx}
                                className="rounded px-0.5"
                                style={{ background: 'color-mix(in srgb, var(--tenant-success) 18%, transparent)', color: 'var(--tenant-success)' }}
                              >
                                {seg.text}
                              </span>
                            );
                          }
                          return (
                            <span
                              key={idx}
                              className="rounded px-0.5 line-through"
                              style={{ background: 'color-mix(in srgb, var(--tenant-danger) 18%, transparent)', color: 'var(--tenant-danger)' }}
                            >
                              {seg.text}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Side-by-side for non-text fields (config objects etc.) */
                    <div className="grid gap-0 lg:grid-cols-2 lg:divide-x" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
                      <div className="p-4">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">Before</div>
                        <pre
                          className="overflow-x-auto rounded-[var(--tenant-radius-panel-tight)] border p-3 text-xs whitespace-pre-wrap font-mono"
                          style={{ borderColor: 'color-mix(in srgb, var(--tenant-danger) 16%, var(--tenant-panel-stroke))', background: 'color-mix(in srgb, var(--tenant-danger) 4%, var(--card))', color: 'var(--tenant-text-secondary)' }}
                        >
                          {beforeStr}
                        </pre>
                      </div>
                      <div className="p-4">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">After</div>
                        <pre
                          className="overflow-x-auto rounded-[var(--tenant-radius-panel-tight)] border p-3 text-xs whitespace-pre-wrap font-mono"
                          style={{ borderColor: 'color-mix(in srgb, var(--tenant-success) 16%, var(--tenant-panel-stroke))', background: 'color-mix(in srgb, var(--tenant-success) 4%, var(--card))', color: 'var(--tenant-text-secondary)' }}
                        >
                          {afterStr}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
