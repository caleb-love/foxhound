'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Trace, Span } from '@foxhound/types';
import Link from 'next/link';
import { ArrowLeft, GitCompare, BookOpen, Play, Pause, SkipBack, SkipForward, ChevronsLeft, ChevronsRight, Eye } from 'lucide-react';
import { getSandboxPromptDetailHref, getSandboxRootHref } from '@/lib/sandbox-routes';
import { getPromptMetadata } from '@/lib/trace-utils';
import { InlineAction, CopyButton, MetricChip, MetricStrip } from '@/components/investigation';
import { StateDiff } from './state-diff';

interface ReplayDetailViewProps {
  trace: Trace;
  baseHref?: string;
}

interface ReplayState {
  currentIndex: number;
  isPlaying: boolean;
  speed: number;
}

function buildExecutionState(completedSpans: Span[]) {
  let totalCost = 0;
  let totalTokens = 0;
  let errorCount = 0;

  completedSpans.forEach((span) => {
    if (span.status === 'error') errorCount++;
    const cost = span.attributes.cost as number | undefined;
    const inputTokens = span.attributes.input_tokens as number | undefined;
    const outputTokens = span.attributes.output_tokens as number | undefined;
    if (cost) totalCost += cost;
    if (inputTokens) totalTokens += inputTokens;
    if (outputTokens) totalTokens += outputTokens;
  });

  return { totalCost, totalTokens, errorCount, stepCount: completedSpans.length };
}

export function ReplayDetailView({ trace, baseHref = '' }: ReplayDetailViewProps) {
  const spans = [...trace.spans].sort((a, b) => a.startTimeMs - b.startTimeMs);
  const hasError = spans.some((s) => s.status === 'error');
  const { promptName } = getPromptMetadata(trace);
  const errorCount = spans.filter((s) => s.status === 'error').length;

  const promptHistoryHref = baseHref === getSandboxRootHref()
    ? getSandboxPromptDetailHref(promptName)
    : promptName ? `${baseHref}/prompts?focus=${encodeURIComponent(promptName)}` : null;

  const [state, setState] = useState<ReplayState>({ currentIndex: 0, isPlaying: false, speed: 1 });

  const safeIndex = Math.min(state.currentIndex, Math.max(spans.length - 1, 0));
  const currentSpan = spans[safeIndex];
  const previousSpan = safeIndex > 0 ? spans[safeIndex - 1] : null;
  const completedSpans = spans.slice(0, safeIndex + 1);
  const execState = buildExecutionState(completedSpans);
  const progress = spans.length > 1 ? (safeIndex / (spans.length - 1)) * 100 : 100;

  // Auto-play
  useEffect(() => {
    if (!state.isPlaying) return;
    const interval = setInterval(() => {
      setState((prev) => {
        if (prev.currentIndex >= spans.length - 1) return { ...prev, isPlaying: false };
        return { ...prev, currentIndex: prev.currentIndex + 1 };
      });
    }, 1000 / state.speed);
    return () => clearInterval(interval);
  }, [state.isPlaying, state.speed, spans.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          setState((p) => ({ ...p, isPlaying: !p.isPlaying }));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setState((p) => ({ ...p, currentIndex: Math.min(p.currentIndex + 1, spans.length - 1), isPlaying: false }));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setState((p) => ({ ...p, currentIndex: Math.max(p.currentIndex - 1, 0), isPlaying: false }));
          break;
        case '1': setState((p) => ({ ...p, speed: 0.5 })); break;
        case '2': setState((p) => ({ ...p, speed: 1 })); break;
        case '3': setState((p) => ({ ...p, speed: 2 })); break;
        case '4': setState((p) => ({ ...p, speed: 4 })); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [spans.length]);

  const seekTo = useCallback((index: number) => {
    setState((p) => ({ ...p, currentIndex: index, isPlaying: false }));
  }, []);

  if (spans.length === 0 || !currentSpan) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-tenant-text-muted">
        No replay steps available for this trace.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] min-h-[600px] flex-col">
      {/* Compact header bar */}
      <div
        className="flex flex-wrap items-center gap-3 border-b px-4 py-2"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 94%, var(--background))' }}
      >
        <Link
          href={`${baseHref}/replay`}
          className="inline-flex items-center gap-1 text-sm text-tenant-text-muted hover:text-tenant-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Replay
        </Link>
        <div className="h-4 w-px" style={{ background: 'var(--tenant-panel-stroke)' }} />
        <span className="text-sm font-semibold text-tenant-text-primary">{trace.agentId}</span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
          style={{
            background: hasError ? 'color-mix(in srgb, var(--tenant-danger) 14%, var(--card))' : 'color-mix(in srgb, var(--tenant-success) 14%, var(--card))',
            color: hasError ? 'var(--tenant-danger)' : 'var(--tenant-success)',
          }}
        >
          {hasError ? `${errorCount} error${errorCount > 1 ? 's' : ''}` : 'Healthy'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <InlineAction href={`${baseHref}/traces/${trace.id}`} variant="ghost">
            <Eye className="h-3 w-3" /> Trace
          </InlineAction>
          <InlineAction href={`${baseHref}/traces`} variant="ghost">
            <GitCompare className="h-3 w-3" /> Compare
          </InlineAction>
          {promptHistoryHref ? (
            <InlineAction href={promptHistoryHref} variant="ghost">
              <BookOpen className="h-3 w-3" /> Prompt
            </InlineAction>
          ) : null}
          <CopyButton text={trace.id} label="ID" />
        </div>
      </div>

      {/* Transport controls (ALWAYS VISIBLE, sticky) */}
      <div
        className="flex items-center gap-3 border-b px-4 py-2"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 96%, var(--background))' }}
      >
        {/* Playback buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => seekTo(0)}
            className="flex h-7 w-7 items-center justify-center rounded text-tenant-text-muted hover:bg-[color:color-mix(in_srgb,var(--tenant-accent)_8%,var(--card))] hover:text-tenant-text-primary"
            title="Go to start"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => seekTo(Math.max(safeIndex - 1, 0))}
            disabled={safeIndex === 0}
            className="flex h-7 w-7 items-center justify-center rounded text-tenant-text-muted hover:bg-[color:color-mix(in_srgb,var(--tenant-accent)_8%,var(--card))] hover:text-tenant-text-primary disabled:opacity-30"
            title="Step back (←)"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setState((p) => ({ ...p, isPlaying: !p.isPlaying }))}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            style={{ background: 'var(--tenant-accent)', color: 'var(--background)' }}
            title="Play/Pause (Space)"
          >
            {state.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => seekTo(Math.min(safeIndex + 1, spans.length - 1))}
            disabled={safeIndex >= spans.length - 1}
            className="flex h-7 w-7 items-center justify-center rounded text-tenant-text-muted hover:bg-[color:color-mix(in_srgb,var(--tenant-accent)_8%,var(--card))] hover:text-tenant-text-primary disabled:opacity-30"
            title="Step forward (→)"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => seekTo(spans.length - 1)}
            className="flex h-7 w-7 items-center justify-center rounded text-tenant-text-muted hover:bg-[color:color-mix(in_srgb,var(--tenant-accent)_8%,var(--card))] hover:text-tenant-text-primary"
            title="Go to end"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>

        {/* Step counter */}
        <span className="shrink-0 font-mono text-xs text-tenant-text-muted">
          {safeIndex + 1}/{spans.length}
        </span>

        {/* Progress bar */}
        <div className="relative flex-1">
          <div className="h-2 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--tenant-accent) 12%, var(--card))' }}>
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${progress}%`, background: 'var(--tenant-accent)' }}
            />
          </div>
          {/* Minimap: small colored dots for each span */}
          <div className="absolute inset-x-0 -bottom-2 flex gap-px">
            {spans.map((span, idx) => (
              <button
                key={span.spanId}
                type="button"
                onClick={() => seekTo(idx)}
                className="h-1.5 flex-1 rounded-full transition-all"
                style={{
                  background: idx <= safeIndex
                    ? span.status === 'error' ? 'var(--tenant-danger)' : 'var(--tenant-accent)'
                    : 'color-mix(in srgb, var(--tenant-panel-stroke) 48%, transparent)',
                  opacity: idx === safeIndex ? 1 : 0.6,
                }}
                title={`${span.name} (${span.status})`}
              />
            ))}
          </div>
          {/* Hidden range input for scrubbing */}
          <input
            type="range"
            min="0"
            max={spans.length - 1}
            value={safeIndex}
            onChange={(e) => seekTo(parseInt(e.target.value))}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
          />
        </div>

        {/* Speed controls */}
        <div className="flex items-center gap-0.5">
          {[0.5, 1, 2, 4].map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => setState((p) => ({ ...p, speed }))}
              className="rounded px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors"
              style={state.speed === speed
                ? { background: 'var(--tenant-accent)', color: 'var(--background)' }
                : { color: 'var(--tenant-text-muted)' }}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Runtime stats */}
        <MetricStrip className="hidden lg:flex">
          <MetricChip label="Cost" value={`$${execState.totalCost.toFixed(4)}`} />
          <MetricChip label="Tokens" value={execState.totalTokens.toLocaleString()} />
          {execState.errorCount > 0 ? (
            <MetricChip label="Errors" value={String(execState.errorCount)} accent="danger" />
          ) : null}
        </MetricStrip>
      </div>

      {/* Main content: split pane (execution flow + inspector) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane: Execution flow */}
        <div className="w-[320px] shrink-0 overflow-y-auto border-r" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 96%, var(--background))' }}>
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">
            Execution flow
          </div>
          <div className="space-y-px pb-4">
            {spans.map((span, idx) => {
              const isCompleted = idx < safeIndex;
              const isCurrent = idx === safeIndex;
              const isFuture = idx > safeIndex;
              const isError = span.status === 'error';
              const duration = span.endTimeMs ? span.endTimeMs - span.startTimeMs : 0;

              return (
                <button
                  key={span.spanId}
                  type="button"
                  onClick={() => seekTo(idx)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors"
                  style={{
                    background: isCurrent
                      ? 'color-mix(in srgb, var(--tenant-accent) 12%, var(--card))'
                      : 'transparent',
                    borderLeft: isCurrent ? '3px solid var(--tenant-accent)' : '3px solid transparent',
                    opacity: isFuture ? 0.45 : 1,
                  }}
                >
                  {/* Status indicator */}
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {isCompleted && isError ? (
                      <span className="text-[11px] font-bold" style={{ color: 'var(--tenant-danger)' }}>✗</span>
                    ) : isCompleted ? (
                      <span className="text-[11px] font-bold" style={{ color: 'var(--tenant-success)' }}>✓</span>
                    ) : isCurrent ? (
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: isError ? 'var(--tenant-danger)' : 'var(--tenant-accent)', boxShadow: `0 0 0 3px color-mix(in srgb, ${isError ? 'var(--tenant-danger)' : 'var(--tenant-accent)'} 20%, transparent)` }} />
                    ) : (
                      <div className="h-2 w-2 rounded-full" style={{ background: 'var(--tenant-panel-stroke)' }} />
                    )}
                  </div>

                  {/* Span info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span
                        className="truncate text-[12px] font-medium"
                        style={{ color: isCurrent ? 'var(--tenant-text-primary)' : isFuture ? 'var(--tenant-text-muted)' : 'var(--tenant-text-secondary)' }}
                      >
                        {span.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-tenant-text-muted">
                      <span>{span.kind.replace('_', ' ')}</span>
                      {!isFuture ? (
                        <>
                          <span>·</span>
                          <span className="font-mono">{(duration / 1000).toFixed(2)}s</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* Step number */}
                  <span className="shrink-0 font-mono text-[10px] text-tenant-text-muted">{idx + 1}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right pane: Inspector */}
        <div className="flex-1 overflow-y-auto p-4" style={{ background: 'var(--card)' }}>
          <div className="mx-auto max-w-3xl space-y-4">
            {/* Current span header */}
            <div
              className="rounded-[var(--tenant-radius-panel)] border-2 p-4"
              style={{
                borderColor: currentSpan.status === 'error' ? 'var(--tenant-danger)' : 'var(--tenant-accent)',
                background: currentSpan.status === 'error'
                  ? 'color-mix(in srgb, var(--tenant-danger) 8%, var(--card))'
                  : 'color-mix(in srgb, var(--tenant-accent) 8%, var(--card))',
              }}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: currentSpan.status === 'error' ? 'var(--tenant-danger)' : 'var(--tenant-accent)' }}>
                Step {safeIndex + 1} of {spans.length}
              </div>
              <div className="mt-1 text-lg font-semibold text-tenant-text-primary">{currentSpan.name}</div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-secondary)', border: '1px solid var(--tenant-panel-stroke)' }}>
                  {currentSpan.kind.replace('_', ' ')}
                </span>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                  style={{
                    background: currentSpan.status === 'error' ? 'color-mix(in srgb, var(--tenant-danger) 14%, var(--card))' : 'color-mix(in srgb, var(--tenant-success) 14%, var(--card))',
                    color: currentSpan.status === 'error' ? 'var(--tenant-danger)' : 'var(--tenant-success)',
                  }}
                >
                  {currentSpan.status}
                </span>
                {currentSpan.endTimeMs ? (
                  <span className="font-mono text-sm text-tenant-text-secondary">
                    {((currentSpan.endTimeMs - currentSpan.startTimeMs) / 1000).toFixed(3)}s
                  </span>
                ) : null}
                {typeof currentSpan.attributes.cost === 'number' ? (
                  <span className="font-mono text-sm" style={{ color: 'var(--tenant-warning)' }}>
                    ${(currentSpan.attributes.cost as number).toFixed(4)}
                  </span>
                ) : null}
                {typeof currentSpan.attributes.model === 'string' ? (
                  <span className="text-xs text-tenant-text-muted">{currentSpan.attributes.model as string}</span>
                ) : null}
              </div>
            </div>

            {/* State diff from previous step */}
            <StateDiff previousSpan={previousSpan} currentSpan={currentSpan} />

            {/* Attributes */}
            {Object.keys(currentSpan.attributes || {}).length > 0 ? (
              <div className="space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">
                  Attributes
                </div>
                <pre
                  className="max-h-[300px] overflow-auto rounded-[var(--tenant-radius-panel-tight)] border p-3 text-[11px] leading-5 font-mono"
                  style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-secondary)' }}
                >
                  {JSON.stringify(currentSpan.attributes, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
