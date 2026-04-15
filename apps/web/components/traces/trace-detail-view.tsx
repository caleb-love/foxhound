'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActionCard, DetailActionPanel, DetailHeader, StatusBadge, SummaryStatCard } from '@/components/system/detail';
import { TraceTimeline } from './trace-timeline';
import type { Span, Trace } from '@foxhound/types';

interface TraceDetailViewProps {
  trace: Trace;
  baseHref?: string;
}

function formatDuration(trace: Trace): string {
  if (!trace.endTimeMs) return 'In progress';
  return `${((trace.endTimeMs - trace.startTimeMs) / 1000).toFixed(2)}s`;
}

function getTraceCost(trace: Trace): number {
  return trace.spans.reduce((sum, span) => {
    const cost = span.attributes.cost;
    return sum + (typeof cost === 'number' ? cost : 0);
  }, 0);
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

function getPromptDetailHref(baseHref: string, promptName?: string): string | null {
  if (!promptName) return null;

  const promptIdByName: Record<string, string> = {
    'support-reply': 'prompt_support_reply',
    'refund-policy-check': 'prompt_refund_policy_check',
    'escalation-triage': 'prompt_escalation_triage',
  };

  const promptId = promptIdByName[promptName];
  return promptId ? `${baseHref}/prompts/${promptId}` : null;
}

function getPromptDiffHref(baseHref: string, promptName?: string, promptVersion?: string | number): string | null {
  if (!promptName || promptVersion === undefined) return null;

  const promptIdByName: Record<string, string> = {
    'support-reply': 'prompt_support_reply',
    'refund-policy-check': 'prompt_refund_policy_check',
    'escalation-triage': 'prompt_escalation_triage',
  };

  const promptId = promptIdByName[promptName];
  if (!promptId) return null;

  const version = Number(promptVersion);
  if (Number.isNaN(version)) return null;

  const baselineVersion = version > 1 ? version - 1 : version;
  return `${baseHref}/prompts/${promptId}/diff?versionA=${baselineVersion}&versionB=${version}`;
}

function getSuggestedCompareHref(baseHref: string, trace: Trace): string {
  const traceId = trace.id;
  const comparisons: Record<string, string> = {
    trace_returns_exception_v17_baseline: 'trace_returns_exception_v18_regression',
    trace_returns_exception_v18_regression: 'trace_returns_exception_v19_fix',
    trace_returns_exception_v19_fix: 'trace_returns_exception_v18_regression',
    trace_damage_receipt_v18_hallucination: 'trace_returns_exception_v17_baseline',
    trace_vip_chargeback_v18_missed_escalation: 'trace_vip_chargeback_v19_restored_escalation',
    trace_vip_chargeback_v19_restored_escalation: 'trace_vip_chargeback_v18_missed_escalation',
    trace_kb_timeout_failed: 'trace_kb_timeout_recovered',
    trace_kb_timeout_recovered: 'trace_kb_timeout_failed',
  };

  const comparisonTraceId = comparisons[traceId];
  return comparisonTraceId
    ? `${baseHref}/diff?a=${traceId}&b=${comparisonTraceId}`
    : `${baseHref}/traces`;
}

export function TraceDetailView({ trace, baseHref = '' }: TraceDetailViewProps) {
  const hasError = trace.spans.some((span: Span) => span.status === 'error');
  const llmCallCount = trace.spans.filter((span: Span) => span.kind === 'llm_call').length;
  const toolCallCount = trace.spans.filter((span: Span) => span.kind === 'tool_call').length;
  const errorCount = trace.spans.filter((span: Span) => span.status === 'error').length;
  const totalCost = getTraceCost(trace);
  const { promptName, promptVersion } = getPromptMetadata(trace);

  const compareHref = getSuggestedCompareHref(baseHref, trace);
  const promptHref = getPromptDetailHref(baseHref, promptName);
  const promptDiffHref = getPromptDiffHref(baseHref, promptName, promptVersion);

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] xl:items-start">
        <div className="space-y-4">
          <DetailHeader
            title={typeof trace.metadata?.story_label === 'string' ? trace.metadata.story_label : 'Trace investigation'}
            subtitle={typeof trace.metadata?.story_summary === 'string'
              ? trace.metadata.story_summary
              : 'Use this view to understand what happened, identify the most likely source of behavior change, and jump directly into comparison, prompt review, or evaluation follow-up.'}
            primaryBadge={<StatusBadge status={hasError ? 'Error path' : 'Healthy path'} variant={hasError ? 'critical' : 'healthy'} />}
            secondaryBadge={<StatusBadge status={trace.agentId} variant="neutral" />}
          />
          <div
            className="rounded-[var(--tenant-radius-panel)] border px-4 py-3"
            style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
              Trace id
            </div>
            <div className="mt-2 font-mono text-sm" style={{ color: 'var(--tenant-text-primary)' }}>{trace.id}</div>
          </div>
        </div>

        <DetailActionPanel title="Recommended investigation actions">
          <ActionCard
            href={compareHref}
            title="Compare against another run"
            description="Open Run Diff and compare this trace with a healthy or newer execution."
          />
          <ActionCard
            href={`${baseHref}/traces/${trace.id}`}
            title="Review trace timeline"
            description="Inspect execution state changes and identify the transition point before failure directly in the trace timeline."
          />
          <ActionCard
            href={promptHref ?? '#'}
            title="Inspect prompt history"
            description={promptName
              ? `Prompt ${promptName}${promptVersion ? ` (version ${promptVersion})` : ''} is linked to this trace. Use prompt history to verify whether the failure aligns with a recent prompt change.`
              : 'Prompt metadata is not attached to this trace yet.'}
            disabled={!promptHref}
          />
          <ActionCard
            href={promptDiffHref ?? '#'}
            title="Compare prompt versions"
            description={promptDiffHref
              ? `Open prompt diff around version ${promptVersion} to inspect the likely change that influenced this run.`
              : 'Prompt version data is required before comparing prompt revisions.'}
            disabled={!promptDiffHref}
          />
          <ActionCard
            href={`${baseHref}/datasets?sourceTrace=${trace.id}`}
            title="Add to evaluation workflow"
            description="Use this failure pattern to seed a dataset, then move into evaluator and experiment workflows."
          />
        </DetailActionPanel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryStatCard label="Duration" value={formatDuration(trace)} />
        <SummaryStatCard label="Total spans" value={String(trace.spans.length)} supportingText={`${llmCallCount} LLM · ${toolCallCount} tool`} />
        <SummaryStatCard label="Errors" value={String(errorCount)} supportingText="Spans with error status in this execution." />
        <SummaryStatCard label="Estimated cost" value={`$${totalCost.toFixed(4)}`} supportingText="Derived from span-level cost attributes." />
        <SummaryStatCard
          label="Prompt context"
          value={promptName ? promptName : 'No prompt metadata'}
          supportingText={promptVersion
            ? `Version ${promptVersion}${typeof trace.metadata?.status_label === 'string' ? ` · ${trace.metadata.status_label}` : ''}`
            : typeof trace.metadata?.status_label === 'string'
              ? String(trace.metadata.status_label)
              : 'Prompt version unavailable'}
        />
      </div>

      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="rounded-[var(--tenant-radius-panel)] border px-1.5 py-1.5" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline">
          <Card className="app-panel-surface">
            <CardHeader>
              <CardTitle>Execution Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <TraceTimeline spans={trace.spans} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="metadata">
          <Card className="app-panel-surface">
            <CardHeader>
              <CardTitle>Trace Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto rounded-[var(--tenant-radius-panel-tight)] border p-4 text-sm" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-inset)', color: 'var(--tenant-text-secondary)' }}>
                {JSON.stringify(trace.metadata, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
