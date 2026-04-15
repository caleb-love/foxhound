'use client';

import { SessionReplay } from './session-replay';
import type { Trace } from '@foxhound/types';
import { getSandboxPromptDetailHref, getSandboxPromptDiffHref, getSandboxRootHref } from '@/lib/sandbox-routes';
import { ActionCard, DetailActionPanel, DetailHeader, EvidenceCard, StatusBadge, SummaryStatCard } from '@/components/system/detail';

interface ReplayDetailViewProps {
  trace: Trace;
  baseHref?: string;
}

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

export function ReplayDetailView({ trace, baseHref = '' }: ReplayDetailViewProps) {
  const hasError = trace.spans.some((span) => span.status === 'error');
  const { promptName, promptVersion } = getPromptMetadata(trace);
  const promptHistoryHref = baseHref === getSandboxRootHref()
    ? getSandboxPromptDetailHref(promptName)
    : promptName
      ? `${baseHref}/prompts?focus=${encodeURIComponent(promptName)}`
      : null;
  const promptDiffHref = baseHref === getSandboxRootHref()
    ? getSandboxPromptDiffHref(promptName, Number(promptVersion) - 1, promptVersion)
    : promptName && promptVersion
      ? `${baseHref}/prompts?focus=${encodeURIComponent(promptName)}&version=${encodeURIComponent(String(promptVersion))}`
      : null;

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] xl:items-start">
        <div className="space-y-4">
          <DetailHeader
            title="Session Replay"
            subtitle="Step through execution in order to see how agent state evolved, where attributes changed, and what happened immediately before a failure or unexpected behavior shift."
            primaryBadge={<StatusBadge status={hasError ? 'Error path' : 'Healthy path'} variant={hasError ? 'critical' : 'healthy'} />}
            secondaryBadge={<StatusBadge status={trace.agentId} variant="neutral" />}
          />
          <div
            className="rounded-[var(--tenant-radius-panel)] border px-4 py-3"
            style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
              Replay id
            </div>
            <div className="mt-2 font-mono text-sm" style={{ color: 'var(--tenant-text-primary)' }}>{trace.id}</div>
          </div>
        </div>

        <DetailActionPanel title="Replay context and next actions">
          <ActionCard
            href={`${baseHref}/traces/${trace.id}`}
            title="Open trace detail"
            description="Inspect the same run through the trace detail workflow to review metadata, summary metrics, and timeline context."
          />
          <ActionCard
            href={`${baseHref}/traces`}
            title="Prepare a comparison workflow"
            description="Use replay to find the interesting transition point, then return to traces and launch Run Diff with a baseline or recovery run for direct comparison."
          />
          <ActionCard
            href={promptHistoryHref ?? '#'}
            title="Review prompt history"
            description={promptName
              ? `${promptName}${promptVersion ? ` · version ${promptVersion}` : ''} is linked to this replay. Review history to check whether prompt changes explain the behavior shift.`
              : 'Prompt metadata is not attached to this trace yet.'}
            disabled={!promptHistoryHref}
          />
          <ActionCard
            href={promptDiffHref ?? '#'}
            title="Compare prompt versions"
            description={promptDiffHref
              ? 'Open prompt comparison for the linked prompt versions to validate the likely behavior change.'
              : 'Prompt diff is available when prompt metadata includes a comparable version boundary.'}
            disabled={!promptDiffHref}
          />
        </DetailActionPanel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard
          label="Total spans"
          value={String(trace.spans.length)}
          supportingText="Replay scrubs one completed execution timeline."
        />
        <SummaryStatCard
          label="Errors"
          value={String(trace.spans.filter((span) => span.status === 'error').length)}
          supportingText="Failed steps visible in playback and state transitions."
        />
        <SummaryStatCard
          label="Prompt context"
          value={promptName ? promptName : 'No prompt metadata'}
          supportingText={promptVersion ? `Version ${promptVersion}` : 'Prompt version unavailable'}
        />
        <SummaryStatCard
          label="Recommended use"
          value="Replay first"
          supportingText="Use replay to find the transition point before switching to diff or prompt analysis."
        />
      </div>

      <EvidenceCard title="Replay timeline" contentClassName="p-0 app-panel-surface">
        <div className="h-[720px]">
          <SessionReplay trace={trace} />
        </div>
      </EvidenceCard>
    </div>
  );
}
