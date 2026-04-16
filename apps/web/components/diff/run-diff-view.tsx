'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Trace, Span } from '@foxhound/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { DetailActionPanel, DetailHeader, CompareContextCard, ActionCard, StatusBadge } from '@/components/system/detail';
import { getSandboxRootHref } from '@/lib/sandbox-routes';
import { useCompareStore } from '@/lib/stores/compare-store';
import { MetricsDelta } from './metrics-delta';
import { TimelineDiff } from './timeline-diff';
import { InsightsPanel } from './insights-panel';
import { DiffTracePicker } from './diff-trace-picker';
import { getPromptMetadata, getPromptDetailHref, getPromptDiffHref } from '@/lib/trace-utils';

interface RunDiffViewProps {
  traceA: Trace;
  traceB: Trace;
  backHref?: string;
  availableTraces?: Trace[];
}

type SpanFingerprint = {
  name: string;
  kind: string;
  occurrence: number;
};

function buildSpanFingerprintKey({ name, kind, occurrence }: SpanFingerprint): string {
  return `${kind}:${name}:${occurrence}`;
}

function getSpanFingerprint(trace: Trace, span: Span): string {
  let occurrence = 0;

  for (const candidate of trace.spans) {
    if (candidate.kind === span.kind && candidate.name === span.name) {
      occurrence += 1;
    }

    if (candidate.spanId === span.spanId) {
      return buildSpanFingerprintKey({ name: span.name, kind: span.kind, occurrence });
    }
  }

  return buildSpanFingerprintKey({ name: span.name, kind: span.kind, occurrence: 1 });
}

export function RunDiffView({ traceA, traceB, backHref = '/traces', availableTraces = [] }: RunDiffViewProps) {
  const router = useRouter();
  const { setComparePair, setTraceSlot, swapComparePair } = useCompareStore();
  const localTraceAId = traceA.id;
  const localTraceBId = traceB.id;

  useEffect(() => {
    const timer = setTimeout(() => setComparePair(traceA.id, traceB.id), 0);
    return () => clearTimeout(timer);
  }, [traceA.id, traceB.id, setComparePair]);
  // Calculate metrics
  const metrics = useMemo(() => {
    // Cost calculation
    const costA = traceA.spans.reduce((sum, span) => {
      const cost = span.attributes.cost as number | undefined;
      return sum + (cost || 0);
    }, 0);
    
    const costB = traceB.spans.reduce((sum, span) => {
      const cost = span.attributes.cost as number | undefined;
      return sum + (cost || 0);
    }, 0);
    
    const costDelta = costB - costA;
    const costPercentage = costA > 0 ? ((costDelta / costA) * 100) : 0;
    
    // Duration calculation
    const durationA = traceA.endTimeMs
      ? (traceA.endTimeMs - traceA.startTimeMs) / 1000
      : 0;
    const durationB = traceB.endTimeMs
      ? (traceB.endTimeMs - traceB.startTimeMs) / 1000
      : 0;
    
    const durationDelta = durationB - durationA;
    const durationPercentage = durationA > 0 ? ((durationDelta / durationA) * 100) : 0;
    
    // Span count
    const spanCountA = traceA.spans.length;
    const spanCountB = traceB.spans.length;
    const spanDelta = spanCountB - spanCountA;
    
    // Error count
    const errorsA = traceA.spans.filter(s => s.status === 'error').length;
    const errorsB = traceB.spans.filter(s => s.status === 'error').length;
    const errorDelta = errorsB - errorsA;
    
    return {
      cost: { valueA: costA, valueB: costB, delta: costDelta, percentage: costPercentage },
      duration: { valueA: durationA, valueB: durationB, delta: durationDelta, percentage: durationPercentage },
      spans: { valueA: spanCountA, valueB: spanCountB, delta: spanDelta },
      errors: { valueA: errorsA, valueB: errorsB, delta: errorDelta },
    };
  }, [traceA, traceB]);
  
  // Span diff computation
  const spanDiff = useMemo(() => {
    // Map spans by name for comparison
    const spansAMap = new Map(traceA.spans.map((span) => [getSpanFingerprint(traceA, span), span]));
    const spansBMap = new Map(traceB.spans.map((span) => [getSpanFingerprint(traceB, span), span]));
    
    const added: Span[] = [];
    const removed: Span[] = [];
    const modified: Span[] = [];
    const unchanged: Span[] = [];
    
    // Check what's in B
    spansBMap.forEach((spanB, fingerprint) => {
      const spanA = spansAMap.get(fingerprint);
      
      if (!spanA) {
        // Only in B = added
        added.push(spanB);
      } else {
        // In both - check if modified
        const durationA = spanA.endTimeMs ? spanA.endTimeMs - spanA.startTimeMs : 0;
        const durationB = spanB.endTimeMs ? spanB.endTimeMs - spanB.startTimeMs : 0;
        const costA = (spanA.attributes.cost as number) || 0;
        const costB = (spanB.attributes.cost as number) || 0;
        
        if (Math.abs(durationB - durationA) > 100 || Math.abs(costB - costA) > 0.001) {
          modified.push(spanB);
        } else {
          unchanged.push(spanB);
        }
      }
    });
    
    // Check what's only in A
    spansAMap.forEach((spanA, fingerprint) => {
      if (!spansBMap.has(fingerprint)) {
        removed.push(spanA);
      }
    });
    
    return { added, removed, modified, unchanged };
  }, [traceA, traceB]);

  const { promptName: promptNameA, promptVersion: promptVersionA } = getPromptMetadata(traceA);
  const { promptName: promptNameB, promptVersion: promptVersionB } = getPromptMetadata(traceB);
  const sandboxTracesHref = `${getSandboxRootHref()}/traces`;
  const isSandbox = backHref === sandboxTracesHref;
  const basePrefix = isSandbox ? getSandboxRootHref() : '';
  const hasPromptLink = Boolean(promptNameA || promptNameB);
  const promptHistoryHref = isSandbox
    ? getPromptDetailHref(basePrefix, promptNameB ?? promptNameA)
    : promptNameB ?? promptNameA
      ? `${basePrefix}/prompts?focus=${encodeURIComponent(String(promptNameB ?? promptNameA))}`
      : null;
  const promptDiffHref = promptNameA && promptNameB && promptNameA === promptNameB
    ? isSandbox
      ? getPromptDiffHref(basePrefix, promptNameA, promptVersionA, promptVersionB)
      : `${basePrefix}/prompts?focus=${encodeURIComponent(String(promptNameA))}&baseline=${encodeURIComponent(String(promptVersionA))}&comparison=${encodeURIComponent(String(promptVersionB))}`
    : null;
  const narrative =
    metrics.errors.delta > 0
      ? 'The comparison run introduced more failing spans and should be treated as a likely regression candidate.'
      : metrics.duration.delta < 0 && metrics.cost.delta < 0
        ? 'The comparison run is cheaper and faster, suggesting an improvement worth validating before promotion.'
        : 'Use the span-level diff below to understand how behavior changed between the baseline and comparison runs.';

  const navigateToPair = (nextTraceAId: string, nextTraceBId: string) => {
    const params = new URLSearchParams({ a: nextTraceAId, b: nextTraceBId });
    router.push(`${basePrefix}/diff?${params.toString()}`);
  };

  const handleSelectTraceA = (nextTraceAId: string) => {
    setTraceSlot('a', nextTraceAId);
    navigateToPair(nextTraceAId, localTraceBId);
  };

  const handleSelectTraceB = (nextTraceBId: string) => {
    setTraceSlot('b', nextTraceBId);
    navigateToPair(localTraceAId, nextTraceBId);
  };

  const handleSwap = () => {
    swapComparePair();
    navigateToPair(localTraceBId, localTraceAId);
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] xl:items-start">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <Link href={backHref}>
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Traces
              </Button>
            </Link>
            <div className="space-y-2">
              <DetailHeader
                title="Run Diff"
                subtitle={narrative}
                primaryBadge={<StatusBadge status="Baseline vs comparison" variant="neutral" />}
              />
              <p className="text-sm text-tenant-text-muted">
                Comparing {traceA.agentId} runs to explain what changed, why it mattered, and which realistic support story this diff belongs to.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <CompareContextCard
              label="Baseline (A)"
              id={typeof traceA.metadata?.story_label === 'string' ? String(traceA.metadata.story_label) : traceA.id}
              meta={[
                `Agent: ${traceA.agentId}`,
                typeof traceA.metadata?.status_label === 'string' ? `Story status: ${traceA.metadata.status_label}` : `Trace ID: ${traceA.id}`,
                promptNameA ? `Prompt: ${promptNameA}${promptVersionA ? ` · v${promptVersionA}` : ''}` : 'Prompt context unavailable',
              ]}
            />
            <CompareContextCard
              label="Comparison (B)"
              id={typeof traceB.metadata?.story_label === 'string' ? String(traceB.metadata.story_label) : traceB.id}
              meta={[
                `Agent: ${traceB.agentId}`,
                typeof traceB.metadata?.status_label === 'string' ? `Story status: ${traceB.metadata.status_label}` : `Trace ID: ${traceB.id}`,
                promptNameB ? `Prompt: ${promptNameB}${promptVersionB ? ` · v${promptVersionB}` : ''}` : 'Prompt context unavailable',
              ]}
            />
          </div>
        </div>

        <DetailActionPanel title="Recommended next actions">
          <ActionCard
            href={`${basePrefix}/traces/${traceA.id}`}
            title="Inspect baseline trace"
            description="Review the last known-good execution and its timeline in detail."
          />
          <ActionCard
            href={`${basePrefix}/traces/${traceB.id}`}
            title="Inspect comparison trace"
            description="Open the changed run directly to inspect metadata, spans, and prompt context."
          />
          <ActionCard
            href={promptHistoryHref ?? '#'}
            title="Review prompt history"
            description={hasPromptLink
              ? `Compare prompt context${promptNameA ? ` (${promptNameA}${promptVersionA ? ` v${promptVersionA}` : ''})` : ''}${promptNameB ? ` and (${promptNameB}${promptVersionB ? ` v${promptVersionB}` : ''})` : ''} to determine whether prompt changes explain the run divergence.`
              : 'Prompt metadata is not attached to these traces yet.'}
            disabled={!promptHistoryHref}
          />
          <ActionCard
            href={promptDiffHref ?? '#'}
            title="Compare prompt versions"
            description={promptDiffHref
              ? `Jump directly into prompt comparison for ${promptNameA} between v${promptVersionA} and v${promptVersionB}.`
              : 'Prompt diff is available when both runs share a prompt name with distinct versions.'}
            disabled={!promptDiffHref}
          />
        </DetailActionPanel>
      </div>
      
      {availableTraces.length > 0 ? (
        <DiffTracePicker
          traces={availableTraces}
          traceAId={localTraceAId}
          traceBId={localTraceBId}
          onSelectTraceA={handleSelectTraceA}
          onSelectTraceB={handleSelectTraceB}
          onSwap={handleSwap}
        />
      ) : null}

      {/* Metrics Comparison */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricsDelta
          label="Cost"
          valueA={metrics.cost.valueA}
          valueB={metrics.cost.valueB}
          delta={metrics.cost.delta}
          percentage={metrics.cost.percentage}
          format="currency"
        />
        <MetricsDelta
          label="Duration"
          valueA={metrics.duration.valueA}
          valueB={metrics.duration.valueB}
          delta={metrics.duration.delta}
          percentage={metrics.duration.percentage}
          format="duration"
        />
        <MetricsDelta
          label="Spans"
          valueA={metrics.spans.valueA}
          valueB={metrics.spans.valueB}
          delta={metrics.spans.delta}
          format="number"
        />
        <MetricsDelta
          label="Errors"
          valueA={metrics.errors.valueA}
          valueB={metrics.errors.valueB}
          delta={metrics.errors.delta}
          format="number"
          lowerIsBetter
        />
      </div>
      
      {/* Insights */}
      <InsightsPanel
        costDelta={metrics.cost.delta}
        costPercentage={metrics.cost.percentage}
        durationDelta={metrics.duration.delta}
        durationPercentage={metrics.duration.percentage}
        spanDiff={spanDiff}
      />
      
      {/* Timeline Diff */}
      <TimelineDiff
        traceA={traceA}
        traceB={traceB}
        spanDiff={spanDiff}
      />
    </div>
  );
}
