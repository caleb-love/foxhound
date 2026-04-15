'use client';

import { useState, useEffect } from 'react';
import type { Trace, Span } from '@foxhound/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StateDiff } from './state-diff';
import { tenantStyles } from '@/components/sandbox/primitives';

interface ReplayState {
  currentSpanIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
}

interface SessionReplayProps {
  trace: Trace;
}

export function SessionReplay({ trace }: SessionReplayProps) {
  // Sort spans by start time
  const spans = [...trace.spans].sort((a, b) => a.startTimeMs - b.startTimeMs);

  const [state, setState] = useState<ReplayState>({
    currentSpanIndex: 0,
    isPlaying: false,
    playbackSpeed: 1,
  });

  const safeSpanIndex = Math.min(state.currentSpanIndex, Math.max(spans.length - 1, 0));
  const currentSpan = spans[safeSpanIndex];
  const previousSpan = safeSpanIndex > 0 ? spans[safeSpanIndex - 1] : null;
  const progress = (safeSpanIndex / Math.max(spans.length - 1, 1)) * 100;

  // Auto-play logic
  useEffect(() => {
    if (!state.isPlaying) return;

    const interval = setInterval(() => {
      setState((prev) => {
        if (prev.currentSpanIndex >= spans.length - 1) {
          return { ...prev, isPlaying: false };
        }
        return { ...prev, currentSpanIndex: prev.currentSpanIndex + 1 };
      });
    }, 1000 / state.playbackSpeed);

    return () => clearInterval(interval);
  }, [state.isPlaying, state.playbackSpeed, spans.length]);

  const togglePlay = () => {
    setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const seekTo = (index: number) => {
    setState((prev) => ({ ...prev, currentSpanIndex: index, isPlaying: false }));
  };

  const stepForward = () => {
    setState((prev) => ({
      ...prev,
      currentSpanIndex: Math.min(prev.currentSpanIndex + 1, spans.length - 1),
      isPlaying: false,
    }));
  };

  const stepBackward = () => {
    setState((prev) => ({
      ...prev,
      currentSpanIndex: Math.max(prev.currentSpanIndex - 1, 0),
      isPlaying: false,
    }));
  };

  const setSpeed = (speed: number) => {
    setState((prev) => ({ ...prev, playbackSpeed: speed }));
  };

  // Get execution state at current point
  const completedSpans = spans.slice(0, safeSpanIndex + 1);
  const executionState = buildExecutionState(completedSpans);

  if (spans.length === 0 || !currentSpan) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm" style={{ color: 'var(--tenant-text-muted)' }}>
        No replay steps are available for this trace yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Playback Controls */}
      <div className="border-b px-6 py-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
              Playback controls
            </div>
            <div className="mt-1 text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>
              Scrub the run to inspect state transitions and isolate the exact step where behavior diverged.
            </div>
          </div>
          <div className="rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)', color: 'var(--tenant-text-secondary)' }}>
            Replay-first workflow
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Play/Pause */}
          <Button
            onClick={togglePlay}
            size="icon"
            className="h-9 w-9 rounded-full"
          >
            {state.isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>

          {/* Step Controls */}
          <Button
            onClick={stepBackward}
            disabled={state.currentSpanIndex === 0}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <SkipBack className="h-4 w-4" />
            Step
          </Button>
          <Button
            onClick={stepForward}
            disabled={state.currentSpanIndex >= spans.length - 1}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            Step
            <SkipForward className="h-4 w-4" />
          </Button>

          {/* Progress Bar & Counter */}
          <div className="flex flex-1 items-center gap-3">
            <span className="text-xs font-mono whitespace-nowrap" style={{ color: 'var(--tenant-text-muted)' }}>
              Step {safeSpanIndex + 1} / {spans.length}
            </span>
            <div className="relative h-2 w-full rounded-full" style={{ background: 'color-mix(in srgb, var(--tenant-accent) 12%, white)' }}>
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-200"
                style={{ width: `${progress}%`, background: 'var(--tenant-accent)' }}
              />
              {/* Clickable seek bar */}
              <input
                type="range"
                min="0"
                max={spans.length - 1}
                value={safeSpanIndex}
                onChange={(e) => seekTo(parseInt(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Speed Control */}
          <div className="flex gap-1">
            {[0.5, 1, 2, 4].map((speed) => (
              <button
                key={speed}
                onClick={() => setSpeed(speed)}
                className="px-2.5 py-1 text-xs font-mono rounded border transition-colors"
                style={state.playbackSpeed === speed ? { background: 'var(--tenant-accent)', color: 'var(--tenant-panel)', borderColor: 'var(--tenant-accent)' } : { background: 'var(--tenant-panel)', color: 'var(--tenant-text-secondary)', borderColor: 'var(--tenant-panel-stroke)' }}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Scrubber with Markers */}
      <div className="border-b px-6 py-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
        <div className="relative h-16">
          {/* Span markers */}
          <div className="absolute inset-x-0 top-0 flex items-start gap-px">
            {spans.map((span, index) => {
              const isActive = index === safeSpanIndex;
              const isCompleted = index < safeSpanIndex;
              
              return (
                <button
                  key={span.spanId}
                  onClick={() => seekTo(index)}
                  className={cn(
                    'flex-1 h-8 rounded-sm transition-all border-2'
                  )}
                  style={isActive ? { borderColor: 'var(--tenant-accent)', background: 'var(--tenant-accent-soft)', boxShadow: '0 0 0 2px color-mix(in srgb, var(--tenant-accent) 28%, transparent)' } : isCompleted ? { background: 'color-mix(in srgb, var(--tenant-accent) 12%, white)', borderColor: 'var(--tenant-panel-stroke)' } : { background: 'var(--tenant-panel)', borderColor: 'var(--tenant-panel-stroke)' }}
                  title={`${span.name} (${span.kind})`}
                />
              );
            })}
          </div>
          {/* Labels for current span */}
          <div className="absolute bottom-0 inset-x-0 text-center">
            <div className="text-xs font-medium" style={{ color: 'var(--tenant-text-secondary)' }}>
              {currentSpan.name}
            </div>
            <div className="text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
              {currentSpan.kind}
            </div>
          </div>
        </div>
      </div>

      {/* State Visualization */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Current Span Highlight */}
          <div className="rounded-[var(--tenant-radius-panel)] border-2 p-5" style={{ borderColor: 'var(--tenant-accent)', background: 'var(--tenant-accent-soft)' }}>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--tenant-accent)' }}>
              Currently Executing
            </div>
            <div className="mb-3 font-mono text-lg font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>
              {currentSpan.name}
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <span style={{ color: 'var(--tenant-text-muted)' }}>Type:</span>{' '}
                <Badge variant="secondary">{currentSpan.kind}</Badge>
              </div>
              <div>
                <span style={{ color: 'var(--tenant-text-muted)' }}>Status:</span>{' '}
                <Badge
                  variant={currentSpan.status === 'ok' ? 'default' : 'destructive'}
                  className={currentSpan.status === 'ok' ? '' : ''}
                  style={currentSpan.status === 'ok' ? { background: 'color-mix(in srgb, var(--tenant-success) 14%, white)', color: 'var(--tenant-success)' } : undefined}
                >
                  {currentSpan.status}
                </Badge>
              </div>
              {currentSpan.endTimeMs && (
                <div>
                  <span style={{ color: 'var(--tenant-text-muted)' }}>Duration:</span>{' '}
                  <span className="font-mono font-medium" style={{ color: 'var(--tenant-text-primary)' }}>
                    {((currentSpan.endTimeMs - currentSpan.startTimeMs) / 1000).toFixed(2)}s
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* State Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Agent State */}
            <StateCard title="Agent State" items={executionState.variables} />

            {/* Execution History */}
            <StateCard title="Execution History" items={executionState.history} />
          </div>

          {/* State Diff */}
          <StateDiff previousSpan={previousSpan} currentSpan={currentSpan} />

          {/* Current Span Attributes */}
          {Object.keys(currentSpan.attributes || {}).length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>
                Current Step Attributes
              </h3>
              <div className="rounded-[var(--tenant-radius-panel-tight)] border p-4" style={{ ...tenantStyles.panelAlt, borderColor: 'var(--tenant-panel-stroke)' }}>
                <pre className="overflow-x-auto text-xs font-mono" style={{ color: 'var(--tenant-text-secondary)' }}>
                  {JSON.stringify(currentSpan.attributes, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface StateItem {
  label: string;
  value: string;
  type?: 'success' | 'error' | 'neutral';
}

function StateCard({ title, items }: { title: string; items: StateItem[] }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>{title}</h3>
      <div className="divide-y overflow-hidden rounded-lg" style={tenantStyles.panel}>
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-4 py-3"
          >
            <span className="text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>{item.label}</span>
            <span
              className="text-sm font-mono font-medium"
              style={{ color: item.type === 'success' ? 'var(--tenant-success)' : item.type === 'error' ? 'var(--tenant-danger)' : 'var(--tenant-text-primary)' }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildExecutionState(completedSpans: Span[]) {
  const variables: StateItem[] = [];
  const history: StateItem[] = [];

  // Extract state from completed spans
  let totalCost = 0;
  let totalTokens = 0;
  let stepCount = 0;
  let errorCount = 0;

  completedSpans.forEach((span) => {
    stepCount++;
    if (span.status === 'error') errorCount++;

    // Extract cost and tokens
    const cost = span.attributes.cost as number | undefined;
    const inputTokens = span.attributes.input_tokens as number | undefined;
    const outputTokens = span.attributes.output_tokens as number | undefined;

    if (cost) totalCost += cost;
    if (inputTokens) totalTokens += inputTokens;
    if (outputTokens) totalTokens += outputTokens;

    // Add to history
    history.push({
      label: span.name,
      value: span.status === 'ok' ? '✓' : '✗',
      type: span.status === 'ok' ? 'success' : 'error',
    });
  });

  // Build current state
  variables.push({ label: 'Steps Completed', value: String(stepCount) });
  variables.push({ label: 'Total Cost', value: `$${totalCost.toFixed(4)}` });
  variables.push({ label: 'Total Tokens', value: totalTokens.toLocaleString() });
  variables.push({
    label: 'Error Count',
    value: String(errorCount),
    type: errorCount > 0 ? 'error' : 'success',
  });

  const lastSpan = completedSpans[completedSpans.length - 1];
  if (lastSpan?.attributes?.model) {
    variables.push({ label: 'Last Model', value: String(lastSpan.attributes.model) });
  }

  return { variables, history: history.slice(-5) }; // Show last 5 history items
}
