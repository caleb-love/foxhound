'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { Trace } from '@foxhound/types';
import { MetricTile } from '@/components/charts/metric-tile';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { PageContainer, PageHeader, RecordBody, SectionPanel } from '@/components/system/page';
import { WorkbenchPanel } from '@/components/system/workbench';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { getSandboxPromptDetailHref, getSandboxReplayHref, getSandboxSessionHref, getSandboxRootHref } from '@/lib/sandbox-routes';

interface ReplayIndexViewProps {
  traces: Trace[];
  baseHref?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
}

const replayFilters: DashboardFilterDefinition[] = [
  {
    key: 'searchQuery',
    kind: 'search',
    label: 'Search',
    placeholder: 'Search replay targets, agents, sessions, or story labels...',
  },
  {
    key: 'status',
    kind: 'single-select',
    label: 'Status',
    options: [
      { value: 'all', label: 'All statuses' },
      { value: 'success', label: 'Healthy paths' },
      { value: 'error', label: 'Error paths' },
    ],
  },
  {
    key: 'agentIds',
    kind: 'multi-select',
    label: 'Agents',
    options: [],
  },
  {
    key: 'dateRange',
    kind: 'date-preset',
    label: 'Date range',
    presets: [
      { label: 'Last 24h', hours: 24 },
      { label: 'Last 7d', hours: 24 * 7 },
      { label: 'Last 30d', hours: 24 * 30 },
    ],
  },
];

function getPromptMetadata(trace: Trace): { promptName?: string; promptVersion?: string | number } {
  const promptName = typeof trace.metadata?.prompt_name === 'string'
    ? trace.metadata.prompt_name
    : typeof trace.metadata?.promptName === 'string'
      ? trace.metadata.promptName
      : undefined;

  const promptVersion =
    typeof trace.metadata?.prompt_version === 'string' || typeof trace.metadata?.prompt_version === 'number'
      ? trace.metadata.prompt_version
      : typeof trace.metadata?.promptVersion === 'string' || typeof trace.metadata?.promptVersion === 'number'
        ? trace.metadata.promptVersion
        : undefined;

  return { promptName, promptVersion };
}

function getReplayHref(baseHref: string, traceId: string) {
  return baseHref === getSandboxRootHref() ? getSandboxReplayHref(traceId) : `${baseHref}/replay/${traceId}`;
}

function getTraceHref(baseHref: string, traceId: string) {
  return `${baseHref}/traces/${traceId}`;
}

function getPromptHref(baseHref: string, promptName?: string) {
  if (!promptName) return null;
  if (baseHref === getSandboxRootHref()) {
    return getSandboxPromptDetailHref(promptName);
  }
  return `${baseHref}/prompts?focus=${encodeURIComponent(promptName)}`;
}

function getSessionHref(baseHref: string, sessionId?: string) {
  if (!sessionId) return null;
  if (baseHref === getSandboxRootHref()) {
    return getSandboxSessionHref(sessionId);
  }
  return `${baseHref}/sessions/${sessionId}`;
}

export function ReplayIndexView({
  traces,
  baseHref = '',
  eyebrow = 'Investigate',
  title = 'Session Replay',
  description = 'Browse replayable runs, isolate failure paths and behavior shifts, and jump directly into trace detail, prompt context, and comparison workflows without relying on a single curated hero path.',
}: ReplayIndexViewProps) {
  const filters = useSegmentStore((state) => state.currentFilters);

  const filterDefinitions = useMemo(() => {
    const options = Array.from(new Set(traces.map((trace) => trace.agentId))).sort().map((agentId) => ({ value: agentId, label: agentId }));
    return replayFilters.map((definition) => (
      definition.key === 'agentIds'
        ? { ...definition, options }
        : definition
    ));
  }, [traces]);

  const replayRows = useMemo(() => {
    return traces.map((trace) => {
      const hasError = trace.spans.some((span) => span.status === 'error');
      const { promptName, promptVersion } = getPromptMetadata(trace);
      const storyLabel = typeof trace.metadata?.story_label === 'string' ? trace.metadata.story_label : trace.id;
      const storySummary = typeof trace.metadata?.story_summary === 'string'
        ? trace.metadata.story_summary
        : `Replay ${trace.spans.length} spans for ${trace.agentId}.`;

      return {
        trace,
        hasError,
        storyLabel,
        storySummary,
        promptName,
        promptVersion,
      };
    });
  }, [traces]);

  const filteredRows = filterByDashboardScope(replayRows, filters, {
    searchableText: (item) => `${item.trace.id} ${item.trace.agentId} ${item.trace.sessionId ?? ''} ${item.storyLabel} ${item.storySummary} ${item.promptName ?? ''}`,
    status: (item) => (item.hasError ? 'error' : 'success'),
    severity: (item) => (item.hasError ? 'critical' : 'healthy'),
    agentIds: (item) => [item.trace.agentId],
  });

  const metrics = useMemo(() => {
    const errorRuns = traces.filter((trace) => trace.spans.some((span) => span.status === 'error')).length;
    const uniqueAgents = new Set(traces.map((trace) => trace.agentId)).size;
    const promptLinked = traces.filter((trace) => {
      const { promptName } = getPromptMetadata(trace);
      return Boolean(promptName);
    }).length;

    return [
      {
        label: 'Replay targets',
        value: String(traces.length),
        supportingText: 'All runs available through the replay workflow right now.',
      },
      {
        label: 'Error paths',
        value: String(errorRuns),
        supportingText: 'Runs with one or more failing spans worth reconstructing step-by-step.',
      },
      {
        label: 'Agents',
        value: String(uniqueAgents),
        supportingText: 'Distinct agent workflows represented in the replay corpus.',
      },
      {
        label: 'Prompt-linked',
        value: String(promptLinked),
        supportingText: 'Runs carrying prompt metadata for fast prompt-history pivots.',
      },
    ];
  }, [traces]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      >
        <div
          className="inline-flex items-center rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]"
          style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)', color: 'var(--tenant-text-secondary)' }}
        >
          Replay workbench
        </div>
      </PageHeader>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.24fr)_minmax(320px,0.76fr)]">
        <SectionPanel
          title="Read replay posture before opening an investigation path"
          description="This page should act like a replay index, not a hero gallery. Show the available replay corpus first, then let operators narrow by workflow, time, or status before opening a specific run."
        >
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} supportingText={metric.supportingText} />
            ))}
          </section>
        </SectionPanel>

        <SectionPanel
          title="Filter replay posture"
          description="Slice by status, agent, or date range before widening into trace detail, prompt history, or compare flows."
        >
          <DashboardFilterBar definitions={filterDefinitions} />
        </SectionPanel>
      </section>

      <WorkbenchPanel
        title="Replay index"
        description="Use replay to reconstruct state changes in order, then branch into trace detail, prompt history, or compare workflows without losing the investigation thread."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredRows.map(({ trace, hasError, storyLabel, storySummary, promptName, promptVersion }) => {
            const replayHref = getReplayHref(baseHref, trace.id);
            const traceHref = getTraceHref(baseHref, trace.id);
            const promptHref = getPromptHref(baseHref, promptName);
            const sessionHref = getSessionHref(baseHref, trace.sessionId);

            return (
              <div
                key={trace.id}
                className="rounded-[var(--tenant-radius-panel)] border p-5"
                style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-panel) 92%, transparent)', boxShadow: 'var(--tenant-shadow-panel)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
                      {hasError ? 'Error path' : 'Healthy path'} · {trace.agentId}
                    </div>
                    <div className="mt-2 text-lg font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>
                      <Link href={replayHref} className="transition-colors hover:underline">
                        {storyLabel}
                      </Link>
                    </div>
                    <div className="mt-2 max-w-[62ch]">
                      <RecordBody>{storySummary}</RecordBody>
                    </div>
                  </div>
                  <Link
                    href={replayHref}
                    className="rounded-[var(--tenant-radius-control-tight)] border px-3 py-2 text-sm font-medium transition-colors"
                    style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-panel-alt) 94%, transparent)', color: 'var(--tenant-accent)' }}
                  >
                    Open replay
                  </Link>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>Trace</div>
                    <div className="mt-1 font-mono text-sm" style={{ color: 'var(--tenant-text-primary)' }}>{trace.id}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>Session</div>
                    <div className="mt-1 font-mono text-sm" style={{ color: 'var(--tenant-text-primary)' }}>{trace.sessionId ?? 'No session id'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>Spans</div>
                    <div className="mt-1 text-sm" style={{ color: 'var(--tenant-text-primary)' }}>{trace.spans.length} total, {trace.spans.filter((span) => span.status === 'error').length} errors</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>Prompt context</div>
                    <div className="mt-1 text-sm" style={{ color: 'var(--tenant-text-primary)' }}>
                      {promptName ? `${promptName}${promptVersion !== undefined ? ` · v${promptVersion}` : ''}` : 'Prompt metadata unavailable'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={traceHref} className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-panel-alt) 94%, transparent)', color: 'var(--tenant-text-primary)' }}>
                    Trace detail
                  </Link>
                  {sessionHref ? (
                    <Link href={sessionHref} className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-panel-alt) 94%, transparent)', color: 'var(--tenant-text-primary)' }}>
                      Session
                    </Link>
                  ) : null}
                  {promptHref ? (
                    <Link href={promptHref} className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-panel-alt) 94%, transparent)', color: 'var(--tenant-text-primary)' }}>
                      Prompt context
                    </Link>
                  ) : null}
                  <Link href={`${baseHref}/traces`} className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-panel-alt) 94%, transparent)', color: 'var(--tenant-text-primary)' }}>
                    Compare from traces
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </WorkbenchPanel>
    </PageContainer>
  );
}
