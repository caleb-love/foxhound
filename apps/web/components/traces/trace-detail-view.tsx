'use client';

import { useState } from 'react';
import type { Span, Trace } from '@foxhound/types';
import { VerdictBar, generateTraceVerdict, InlineAction, InlineActionBar, CopyButton, MetricChip, MetricStrip, WaterfallTimeline, SplitPane } from '@/components/investigation';
import { SpanDetailPanel } from './span-detail-panel';
import { getPromptMetadata, getPromptDetailHref, getSuggestedCompareHref } from '@/lib/trace-utils';
import { GitCompare, Play, BookOpen, FlaskConical, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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

export function TraceDetailView({ trace, baseHref = '' }: TraceDetailViewProps) {
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const llmCallCount = trace.spans.filter((span: Span) => span.kind === 'llm_call').length;
  const toolCallCount = trace.spans.filter((span: Span) => span.kind === 'tool_call').length;
  const errorCount = trace.spans.filter((span: Span) => span.status === 'error').length;
  const totalCost = getTraceCost(trace);
  const { promptName, promptVersion } = getPromptMetadata(trace);

  const compareHref = getSuggestedCompareHref(baseHref, trace);
  const promptHref = getPromptDetailHref(baseHref, promptName);
  const verdict = generateTraceVerdict(trace);

  const handleSpanClick = (span: Span) => {
    setSelectedSpan(span);
    setIsPanelOpen(true);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setTimeout(() => setSelectedSpan(null), 300);
  };

  return (
    <div className="space-y-4">
      {/* Back navigation */}
      <Link
        href={`${baseHref}/traces`}
        className="inline-flex items-center gap-1.5 text-sm text-tenant-text-muted transition-colors hover:text-tenant-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Traces
      </Link>

      {/* Verdict bar: the single most important element */}
      <VerdictBar
        severity={verdict.severity}
        headline={verdict.headline}
        summary={verdict.summary}
        actions={
          <InlineActionBar>
            <InlineAction href={compareHref} variant="primary">
              <GitCompare className="h-3.5 w-3.5" />
              Compare
            </InlineAction>
            <InlineAction href={`${baseHref}/replay/${trace.id}`} variant="secondary">
              <Play className="h-3.5 w-3.5" />
              Replay
            </InlineAction>
            {promptHref ? (
              <InlineAction href={promptHref} variant="secondary">
                <BookOpen className="h-3.5 w-3.5" />
                Prompt {promptVersion !== undefined ? `v${promptVersion}` : ''}
              </InlineAction>
            ) : null}
            <InlineAction href={`${baseHref}/datasets?sourceTrace=${trace.id}`} variant="ghost">
              <FlaskConical className="h-3.5 w-3.5" />
              Add to eval
            </InlineAction>
            <CopyButton text={trace.id} label={`ID: ${trace.id.slice(0, 12)}...`} />
          </InlineActionBar>
        }
      />

      {/* Compact metric strip */}
      <MetricStrip>
        <MetricChip label="Duration" value={formatDuration(trace)} />
        <MetricChip label="Spans" value={`${trace.spans.length}`} />
        <MetricChip
          label="Errors"
          value={String(errorCount)}
          accent={errorCount > 0 ? 'danger' : 'success'}
        />
        <MetricChip label="Cost" value={`$${totalCost.toFixed(4)}`} />
        <MetricChip
          label="LLM"
          value={`${llmCallCount} calls`}
        />
        <MetricChip
          label="Tools"
          value={`${toolCallCount} calls`}
        />
        {promptName ? (
          <MetricChip label="Prompt" value={`${promptName}${promptVersion !== undefined ? ` v${promptVersion}` : ''}`} />
        ) : null}
      </MetricStrip>

      {/* Main content: waterfall + inspector split pane */}
      <SplitPane
        defaultSplit={62}
        minPaneWidth={300}
        left={
          <WaterfallTimeline
            spans={trace.spans}
            selectedSpanId={selectedSpan?.spanId}
            onSelectSpan={handleSpanClick}
            className="rounded-none border-0"
          />
        }
        right={
          selectedSpan ? (
            <SpanInlineInspector span={selectedSpan} />
          ) : (
            <div className="flex h-full min-h-[400px] items-center justify-center p-6 text-center">
              <div>
                <div className="text-sm font-medium text-tenant-text-muted">Click a span in the waterfall</div>
                <div className="mt-1 text-xs text-tenant-text-muted">to inspect its details here</div>
              </div>
            </div>
          )
        }
      />

      {/* Collapsible metadata */}
      <details
        className="rounded-[var(--tenant-radius-panel)] border"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-tenant-text-secondary hover:text-tenant-text-primary">
          Raw metadata
        </summary>
        <div className="border-t px-4 py-3" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
          <pre className="overflow-auto text-xs font-mono text-tenant-text-muted">
            {JSON.stringify(trace.metadata, null, 2)}
          </pre>
        </div>
      </details>

      {/* Sheet panel for full detail (still useful for mobile / deep dive) */}
      <SpanDetailPanel
        span={selectedSpan}
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
      />
    </div>
  );
}

/* ---------- Inline inspector for split-pane right side ---------- */

function SpanInlineInspector({ span }: { span: Span }) {
  const duration = span.endTimeMs ? span.endTimeMs - span.startTimeMs : 0;
  const isLlmCall = span.kind === 'llm_call';
  const isToolCall = span.kind === 'tool_call';
  const model = isLlmCall && typeof span.attributes.model === 'string' ? span.attributes.model : null;
  const inputTokens = isLlmCall && typeof span.attributes.input_tokens === 'number' ? span.attributes.input_tokens : null;
  const outputTokens = isLlmCall && typeof span.attributes.output_tokens === 'number' ? span.attributes.output_tokens : null;
  const cost = typeof span.attributes.cost === 'number' ? span.attributes.cost : null;
  const toolName = isToolCall && typeof span.attributes.tool === 'string' ? span.attributes.tool : null;

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div
        className="sticky top-0 z-10 border-b px-4 py-3"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 96%, var(--background))' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: span.status === 'error' ? 'var(--tenant-danger)' : 'var(--tenant-accent)' }}
          />
          <span className="truncate text-sm font-semibold text-tenant-text-primary">{span.name}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-tenant-text-muted">
          <span className="uppercase">{span.kind.replace('_', ' ')}</span>
          <span>·</span>
          <span
            className="font-semibold"
            style={{ color: span.status === 'error' ? 'var(--tenant-danger)' : 'var(--tenant-success)' }}
          >
            {span.status}
          </span>
          <span>·</span>
          <span className="font-mono">{(duration / 1000).toFixed(3)}s</span>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Key facts grid */}
        <div className="grid grid-cols-2 gap-2">
          <InspectorFact label="Duration" value={`${(duration / 1000).toFixed(3)}s`} />
          <InspectorFact label="Status" value={span.status} accent={span.status === 'error' ? 'danger' : 'success'} />
          {model ? <InspectorFact label="Model" value={model} accent="accent" /> : null}
          {cost !== null ? <InspectorFact label="Cost" value={`$${cost.toFixed(4)}`} /> : null}
          {inputTokens !== null ? <InspectorFact label="Input tokens" value={inputTokens.toLocaleString()} /> : null}
          {outputTokens !== null ? <InspectorFact label="Output tokens" value={outputTokens.toLocaleString()} /> : null}
          {toolName ? <InspectorFact label="Tool" value={toolName} accent="accent" /> : null}
        </div>

        {/* Timing */}
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">Timing</div>
          <div className="rounded-[var(--tenant-radius-panel-tight)] border p-3 text-xs" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
            <div className="flex justify-between text-tenant-text-secondary">
              <span>Started</span>
              <span className="font-mono text-tenant-text-primary">{new Date(span.startTimeMs).toLocaleTimeString()}</span>
            </div>
            {span.endTimeMs ? (
              <div className="mt-1 flex justify-between text-tenant-text-secondary">
                <span>Ended</span>
                <span className="font-mono text-tenant-text-primary">{new Date(span.endTimeMs).toLocaleTimeString()}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* IDs */}
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">IDs</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between rounded border px-2 py-1.5" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
              <span className="text-tenant-text-muted">Span</span>
              <span className="font-mono text-tenant-text-secondary">{span.spanId}</span>
            </div>
            {span.parentSpanId ? (
              <div className="flex items-center justify-between rounded border px-2 py-1.5" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
                <span className="text-tenant-text-muted">Parent</span>
                <span className="font-mono text-tenant-text-secondary">{span.parentSpanId}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Attributes */}
        {Object.keys(span.attributes || {}).length > 0 ? (
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">
              Attributes
            </div>
            <pre
              className="max-h-[320px] overflow-auto rounded-[var(--tenant-radius-panel-tight)] border p-3 text-[11px] leading-5 font-mono"
              style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-secondary)' }}
            >
              {JSON.stringify(span.attributes, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InspectorFact({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'danger' | 'success' | 'accent' | 'warning';
}) {
  const colorMap: Record<string, string> = {
    danger: 'var(--tenant-danger)',
    success: 'var(--tenant-success)',
    accent: 'var(--tenant-accent)',
    warning: 'var(--tenant-warning)',
  };

  return (
    <div
      className="rounded-[var(--tenant-radius-control-tight)] border px-3 py-2"
      style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
    >
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">{label}</div>
      <div
        className="mt-0.5 truncate text-sm font-semibold"
        style={{ color: accent ? colorMap[accent] : 'var(--tenant-text-primary)' }}
      >
        {value}
      </div>
    </div>
  );
}
