'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { PageWarningState } from '@/components/ui/page-state';
import type { PromptResponse, PromptVersionResponse } from '@foxhound/api-client';
import { InlineAction, InlineActionBar, CopyButton, MetricChip, MetricStrip } from '@/components/investigation';
import { VersionImpactStrip, type VersionMetrics, type VersionImpact } from '@/components/prompts/version-impact-strip';
import { computeWordDiff } from '@/lib/word-diff';
import { ArrowLeft, GitCompare, Eye, FlaskConical } from 'lucide-react';

interface PromptDetailViewProps {
  prompt: PromptResponse;
  versions: PromptVersionResponse[];
  /** Per-version performance metrics keyed by version number */
  performanceByVersion?: Record<number, VersionMetrics>;
  /** Overall prompt performance metrics */
  promptMetrics?: { traceCount: number; errorRate: number; avgCostUsd: number };
  baseHref?: string;
}

export function PromptDetailView({ prompt, versions, performanceByVersion, promptMetrics, baseHref = '' }: PromptDetailViewProps) {
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions],
  );

  const latestVersion = sortedVersions[0] ?? null;
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(latestVersion?.id ?? null);
  const selectedVersion = sortedVersions.find((v) => v.id === selectedVersionId) ?? latestVersion;
  const selectedIndex = sortedVersions.findIndex((v) => v.id === selectedVersionId);
  const previousVersion = selectedIndex >= 0 && selectedIndex < sortedVersions.length - 1
    ? sortedVersions[selectedIndex + 1]
    : null;

  const compareHref = latestVersion && sortedVersions[1]
    ? `${baseHref}/prompts/${prompt.id}/diff?versionA=${sortedVersions[1].version}&versionB=${latestVersion.version}`
    : null;

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

      {/* Prompt hero */}
      <div
        className="rounded-[var(--tenant-radius-panel)] border p-4"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 94%, var(--background))' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-tenant-text-primary">{prompt.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-tenant-text-muted">{prompt.id}</span>
              {latestVersion ? (
                <Badge variant="outline" className="text-[10px]">v{latestVersion.version}</Badge>
              ) : null}
              {(latestVersion?.labels ?? []).map((label) => (
                <Badge key={label} variant="secondary" className="text-[10px]">{label}</Badge>
              ))}
            </div>
          </div>
          <InlineActionBar>
            {compareHref ? (
              <InlineAction href={compareHref} variant="primary">
                <GitCompare className="h-3.5 w-3.5" />
                Compare latest
              </InlineAction>
            ) : null}
            <InlineAction href={`${baseHref}/traces`} variant="secondary">
              <Eye className="h-3.5 w-3.5" />
              Linked traces
            </InlineAction>
            <InlineAction href={`${baseHref}/experiments`} variant="ghost">
              <FlaskConical className="h-3.5 w-3.5" />
              Experiments
            </InlineAction>
            <CopyButton text={prompt.id} label="Copy ID" />
          </InlineActionBar>
        </div>
      </div>

      {/* Metrics */}
      <MetricStrip>
        <MetricChip label="Versions" value={String(sortedVersions.length)} />
        <MetricChip label="Latest" value={latestVersion ? `v${latestVersion.version}` : 'None'} />
        {promptMetrics ? (
          <>
            <MetricChip label="Traces" value={promptMetrics.traceCount.toLocaleString()} />
            <MetricChip
              label="Error rate"
              value={`${(promptMetrics.errorRate * 100).toFixed(1)}%`}
              accent={promptMetrics.errorRate > 0.05 ? 'danger' : promptMetrics.errorRate > 0.02 ? 'warning' : 'success'}
            />
            <MetricChip label="Avg cost" value={`$${promptMetrics.avgCostUsd.toFixed(4)}`} />
          </>
        ) : (
          <MetricChip
            label="Labels"
            value={latestVersion?.labels?.length ? latestVersion.labels.join(', ') : 'None'}
          />
        )}
      </MetricStrip>

      {sortedVersions.length === 0 ? (
        <PageWarningState
          title="No prompt versions yet"
          message="Create at least two versions before comparing prompt changes."
        />
      ) : (
        /* Split pane: version timeline (left) + content (right) */
        <div
          className="flex overflow-hidden rounded-[var(--tenant-radius-panel)] border"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}
        >
          {/* Version timeline (left rail) */}
          <div
            className="w-[220px] shrink-0 overflow-y-auto border-r"
            style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 92%, var(--background))' }}
          >
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">
              Version history
            </div>
            <div className="space-y-px pb-4">
              {sortedVersions.map((version) => {
                const isSelected = version.id === selectedVersionId;
                return (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => setSelectedVersionId(version.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
                    style={{
                      background: isSelected ? 'color-mix(in srgb, var(--tenant-accent) 12%, var(--card))' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--tenant-accent)' : '3px solid transparent',
                    }}
                  >
                    <div
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: isSelected ? 'var(--tenant-accent)' : 'var(--tenant-panel-stroke)' }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold text-tenant-text-primary">v{version.version}</span>
                        {(version.labels ?? []).map((label) => (
                          <span
                            key={label}
                            className="rounded px-1 py-0.5 text-[8px] font-bold uppercase"
                            style={{ background: 'color-mix(in srgb, var(--tenant-success) 14%, var(--card))', color: 'var(--tenant-success)' }}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                      <div className="text-[10px] text-tenant-text-muted">
                        {new Date(version.createdAt).toLocaleDateString()}
                        {version.model ? ` · ${version.model}` : ''}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content pane (right) */}
          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            {selectedVersion ? (
              <div className="space-y-4">
                {/* Version header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-tenant-text-primary">
                      Version {selectedVersion.version}
                    </h3>
                    <div className="mt-0.5 text-xs text-tenant-text-muted">
                      {selectedVersion.model ?? 'No model specified'} · Created {new Date(selectedVersion.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {previousVersion ? (
                    <Link
                      href={`${baseHref}/prompts/${prompt.id}/diff?versionA=${previousVersion.version}&versionB=${selectedVersion.version}`}
                      className="rounded-[var(--tenant-radius-control-tight)] border px-3 py-1.5 text-xs font-medium transition-colors hover:border-[color:var(--tenant-accent)]"
                      style={{ borderColor: 'var(--tenant-panel-stroke)', color: 'var(--tenant-accent)' }}
                    >
                      <GitCompare className="mr-1 inline h-3 w-3" />
                      Diff vs v{previousVersion.version}
                    </Link>
                  ) : null}
                </div>

                {/* Labels */}
                {(selectedVersion.labels ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {(selectedVersion.labels ?? []).map((label) => (
                      <Badge key={label} variant="secondary">{label}</Badge>
                    ))}
                  </div>
                ) : null}

                {/* Prompt content */}
                <pre
                  className="overflow-x-auto rounded-[var(--tenant-radius-panel-tight)] border p-4 text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-secondary)' }}
                >
                  {selectedVersion.content}
                </pre>

                {/* Performance impact strip */}
                {(() => {
                  if (!performanceByVersion || !previousVersion) return null;
                  const before = performanceByVersion[previousVersion.version];
                  const after = performanceByVersion[selectedVersion.version];
                  if (!before || !after) return null;
                  const impact: VersionImpact = {
                    fromVersion: previousVersion.version,
                    toVersion: selectedVersion.version,
                    before,
                    after,
                  };
                  return <VersionImpactStrip impact={impact} />;
                })()}

                {/* Inline auto-diff against previous version */}
                {previousVersion && previousVersion.content !== selectedVersion.content ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">
                        Changes from v{previousVersion.version}
                      </span>
                      <Link
                        href={`${baseHref}/prompts/${prompt.id}/diff?versionA=${previousVersion.version}&versionB=${selectedVersion.version}`}
                        className="text-[11px] font-medium hover:underline"
                        style={{ color: 'var(--tenant-accent)' }}
                      >
                        Full diff view
                      </Link>
                    </div>
                    <div
                      className="overflow-x-auto rounded-[var(--tenant-radius-panel-tight)] border p-3 text-[13px] leading-relaxed whitespace-pre-wrap font-mono"
                      style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 92%, var(--background))' }}
                    >
                      {computeWordDiff(previousVersion.content, selectedVersion.content).map((seg, idx) => {
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
                ) : previousVersion && previousVersion.content === selectedVersion.content ? (
                  <div className="text-[11px] text-tenant-text-muted">
                    Content identical to v{previousVersion.version}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-tenant-text-muted">
                Select a version to view its content.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
