'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    trace_support_refund_v17_baseline: 'trace_support_refund_v18_regression',
    trace_support_refund_v18_regression: 'trace_support_refund_v19_fix',
    trace_support_refund_v19_fix: 'trace_support_refund_v18_regression',
    trace_damage_receipt_v18_hallucination: 'trace_support_refund_v17_baseline',
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold">Trace investigation</h1>
            <Badge variant={hasError ? 'destructive' : 'default'}>
              {hasError ? 'Error path' : 'Healthy path'}
            </Badge>
            <Badge variant="outline">{trace.agentId}</Badge>
          </div>
          <div className="font-mono text-sm text-muted-foreground">{trace.id}</div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Use this view to understand what happened, identify the likely source of behavior changes,
            and jump directly into comparison or prompt review workflows.
          </p>
        </div>

        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Recommended investigation actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <a href={compareHref} className="rounded-lg border p-3 transition-colors hover:bg-muted/40">
              <div className="font-medium">Compare against another run</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Open Run Diff and compare this trace with a healthy or newer execution.
              </p>
            </a>
            <a href={`${baseHref}/traces/${trace.id}`} className="rounded-lg border p-3 transition-colors hover:bg-muted/40">
              <div className="font-medium">Review trace timeline</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Inspect execution state changes and identify the transition point before failure directly in the trace timeline.
              </p>
            </a>
            <a
              href={promptHref ?? '#'}
              aria-disabled={!promptHref}
              className={`rounded-lg border p-3 transition-colors ${promptHref ? 'hover:bg-muted/40' : 'pointer-events-none opacity-60'}`}
            >
              <div className="font-medium">Inspect prompt history</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {promptName
                  ? `Prompt ${promptName}${promptVersion ? ` (version ${promptVersion})` : ''} is linked to this trace. Use prompt history to verify whether the failure aligns with a recent prompt change.`
                  : 'Prompt metadata is not attached to this trace yet.'}
              </p>
            </a>
            <a
              href={promptDiffHref ?? '#'}
              aria-disabled={!promptDiffHref}
              className={`rounded-lg border p-3 transition-colors ${promptDiffHref ? 'hover:bg-muted/40' : 'pointer-events-none opacity-60'}`}
            >
              <div className="font-medium">Compare prompt versions</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {promptDiffHref
                  ? `Open prompt diff around version ${promptVersion} to inspect the likely change that influenced this run.`
                  : 'Prompt version data is required before comparing prompt revisions.'}
              </p>
            </a>
            <a href={`${baseHref}/datasets?sourceTrace=${trace.id}`} className="rounded-lg border p-3 transition-colors hover:bg-muted/40">
              <div className="font-medium">Add to evaluation workflow</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Use this failure pattern to seed a dataset, then move into evaluator and experiment workflows.
              </p>
            </a>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'var(--tenant-text-muted)' }}>Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: 'var(--tenant-text-primary)' }}>{formatDuration(trace)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'var(--tenant-text-muted)' }}>Total spans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: 'var(--tenant-text-primary)' }}>{trace.spans.length}</div>
            <p className="mt-1 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>{llmCallCount} LLM · {toolCallCount} tool</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'var(--tenant-text-muted)' }}>Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: 'var(--tenant-text-primary)' }}>{errorCount}</div>
            <p className="mt-1 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>Spans with error status in this execution.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'var(--tenant-text-muted)' }}>Estimated cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: 'var(--tenant-text-primary)' }}>${totalCost.toFixed(4)}</div>
            <p className="mt-1 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>Derived from span-level cost attributes.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'var(--tenant-text-muted)' }}>Prompt context</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="truncate text-sm font-medium" style={{ color: 'var(--tenant-text-primary)' }}>
              {promptName ? promptName : 'No prompt metadata'}
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
              {promptVersion ? `Version ${promptVersion}` : 'Prompt version unavailable'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Execution Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <TraceTimeline spans={trace.spans} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="metadata">
          <Card>
            <CardHeader>
              <CardTitle>Trace Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto rounded-lg p-4 text-sm" style={{ background: 'var(--tenant-panel-alt)', color: 'var(--tenant-text-secondary)' }}>
                {JSON.stringify(trace.metadata, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
