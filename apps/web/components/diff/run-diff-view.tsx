'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Trace, Span } from '@foxhound/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowLeftRight, Check, Download, BookOpen, Eye } from 'lucide-react';
import { VerdictBar, generateDiffVerdict, InlineAction, InlineActionBar, ComparisonBar } from '@/components/investigation';
import { getSandboxRootHref } from '@/lib/sandbox-routes';
import { useCompareStore } from '@/lib/stores/compare-store';
import { InsightsPanel } from './insights-panel';
import { exportDiffAsMarkdown, copyToClipboard } from '@/lib/export-diff';
import { WaterfallDiff } from './waterfall-diff';
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
  const [exportCopied, setExportCopied] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setComparePair(traceA.id, traceB.id), 0);
    return () => clearTimeout(timer);
  }, [traceA.id, traceB.id, setComparePair]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const costA = traceA.spans.reduce((sum, span) => sum + ((span.attributes.cost as number) || 0), 0);
    const costB = traceB.spans.reduce((sum, span) => sum + ((span.attributes.cost as number) || 0), 0);
    const costDelta = costB - costA;
    const costPercentage = costA > 0 ? ((costDelta / costA) * 100) : 0;

    const durationA = traceA.endTimeMs ? (traceA.endTimeMs - traceA.startTimeMs) / 1000 : 0;
    const durationB = traceB.endTimeMs ? (traceB.endTimeMs - traceB.startTimeMs) / 1000 : 0;
    const durationDelta = durationB - durationA;
    const durationPercentage = durationA > 0 ? ((durationDelta / durationA) * 100) : 0;

    const spanCountA = traceA.spans.length;
    const spanCountB = traceB.spans.length;
    const spanDelta = spanCountB - spanCountA;

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
    const spansAMap = new Map(traceA.spans.map((span) => [getSpanFingerprint(traceA, span), span]));
    const spansBMap = new Map(traceB.spans.map((span) => [getSpanFingerprint(traceB, span), span]));

    const added: Span[] = [];
    const removed: Span[] = [];
    const modified: Span[] = [];
    const unchanged: Span[] = [];

    spansBMap.forEach((spanB, fingerprint) => {
      const spanA = spansAMap.get(fingerprint);
      if (!spanA) {
        added.push(spanB);
      } else {
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
  const promptHistoryHref = promptNameB ?? promptNameA
    ? isSandbox
      ? getPromptDetailHref(basePrefix, promptNameB ?? promptNameA)
      : `${basePrefix}/prompts?focus=${encodeURIComponent(String(promptNameB ?? promptNameA))}`
    : null;
  const promptDiffHref = promptNameA && promptNameB && promptNameA === promptNameB
    ? isSandbox
      ? getPromptDiffHref(basePrefix, promptNameA, promptVersionA, promptVersionB)
      : `${basePrefix}/prompts?focus=${encodeURIComponent(String(promptNameA))}&baseline=${encodeURIComponent(String(promptVersionA))}&comparison=${encodeURIComponent(String(promptVersionB))}`
    : null;

  const verdict = generateDiffVerdict({
    costDelta: metrics.cost.delta,
    costPercentage: metrics.cost.percentage,
    durationDelta: metrics.duration.delta,
    durationPercentage: metrics.duration.percentage,
    errorDelta: metrics.errors.delta,
    addedSpans: spanDiff.added.length,
    removedSpans: spanDiff.removed.length,
    modifiedSpans: spanDiff.modified.length,
  });

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

  const storyLabelA = typeof traceA.metadata?.story_label === 'string' ? traceA.metadata.story_label : traceA.id.slice(0, 12);
  const storyLabelB = typeof traceB.metadata?.story_label === 'string' ? traceB.metadata.story_label : traceB.id.slice(0, 12);

  return (
    <div className="space-y-4">
      {/* Back navigation */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-tenant-text-muted transition-colors hover:text-tenant-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Traces
      </Link>

      {/* Verdict */}
      <VerdictBar
        severity={verdict.severity}
        headline={verdict.headline}
        summary={verdict.summary}
        actions={
          <InlineActionBar>
            <InlineAction href={`${basePrefix}/traces/${traceA.id}`} variant="secondary">
              <Eye className="h-3.5 w-3.5" />
              Baseline
            </InlineAction>
            <InlineAction href={`${basePrefix}/traces/${traceB.id}`} variant="secondary">
              <Eye className="h-3.5 w-3.5" />
              Comparison
            </InlineAction>
            {promptHistoryHref ? (
              <InlineAction href={promptHistoryHref} variant="secondary">
                <BookOpen className="h-3.5 w-3.5" />
                Prompt history
              </InlineAction>
            ) : null}
            {promptDiffHref ? (
              <InlineAction href={promptDiffHref} variant="secondary">
                <BookOpen className="h-3.5 w-3.5" />
                Prompt diff
              </InlineAction>
            ) : null}
            <InlineAction href="#" variant="ghost" onClick={() => {
              const md = exportDiffAsMarkdown(traceA, traceB, metrics, spanDiff, verdict);
              copyToClipboard(md);
              setExportCopied(true);
              setTimeout(() => setExportCopied(false), 2000);
            }}>
              {exportCopied ? <Check className="h-3.5 w-3.5" style={{ color: 'var(--tenant-success)' }} /> : <Download className="h-3.5 w-3.5" />}
              {exportCopied ? 'Copied!' : 'Export'}
            </InlineAction>
          </InlineActionBar>
        }
      />

      {/* Trace pair strip */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-[var(--tenant-radius-panel)] border px-4 py-3"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-full bg-[color:color-mix(in_srgb,var(--tenant-accent)_16%,var(--card))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-tenant-accent">A</span>
          <span className="truncate text-sm font-medium text-tenant-text-primary">{storyLabelA}</span>
          <span className="text-xs text-tenant-text-muted">{traceA.agentId}</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" onClick={handleSwap}>
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span className="text-xs">Swap</span>
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-full bg-[color:color-mix(in_srgb,var(--tenant-accent)_16%,var(--card))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-tenant-accent">B</span>
          <span className="truncate text-sm font-medium text-tenant-text-primary">{storyLabelB}</span>
          <span className="text-xs text-tenant-text-muted">{traceB.agentId}</span>
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
      </div>

      {/* Visual comparison bars */}
      <div
        className="grid gap-4 rounded-[var(--tenant-radius-panel)] border p-4 sm:grid-cols-2 xl:grid-cols-4"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}
      >
        <ComparisonBar label="Cost" valueA={metrics.cost.valueA} valueB={metrics.cost.valueB} format="currency" lowerIsBetter />
        <ComparisonBar label="Latency" valueA={metrics.duration.valueA} valueB={metrics.duration.valueB} format="duration" lowerIsBetter />
        <ComparisonBar label="Spans" valueA={metrics.spans.valueA} valueB={metrics.spans.valueB} format="number" lowerIsBetter={false} />
        <ComparisonBar label="Errors" valueA={metrics.errors.valueA} valueB={metrics.errors.valueB} format="number" lowerIsBetter />
      </div>

      {/* Prescriptive insights */}
      <InsightsPanel
        costDelta={metrics.cost.delta}
        costPercentage={metrics.cost.percentage}
        durationDelta={metrics.duration.delta}
        durationPercentage={metrics.duration.percentage}
        spanDiff={spanDiff}
        traceA={traceA}
        traceB={traceB}
      />

      {/* Unified waterfall diff */}
      <WaterfallDiff
        traceA={traceA}
        traceB={traceB}
        spanDiff={spanDiff}
      />
    </div>
  );
}
