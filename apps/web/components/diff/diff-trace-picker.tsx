'use client';

import { useMemo, useState } from 'react';
import type { Trace } from '@foxhound/types';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

interface DiffTracePickerProps {
  traces: Trace[];
  traceAId: string;
  traceBId: string;
  onSelectTraceA: (traceId: string) => void;
  onSelectTraceB: (traceId: string) => void;
  onSwap: () => void;
}

function describeTrace(trace: Trace) {
  const hasError = trace.spans.some((span) => span.status === 'error');
  const durationSeconds = trace.endTimeMs ? ((trace.endTimeMs - trace.startTimeMs) / 1000).toFixed(2) : '—';
  const promptName = typeof trace.metadata?.prompt_name === 'string' ? trace.metadata.prompt_name : undefined;

  return {
    hasError,
    durationSeconds,
    promptName,
    storyLabel: typeof trace.metadata?.story_label === 'string' ? trace.metadata.story_label : trace.id,
  };
}

export function DiffTracePicker({
  traces,
  traceAId,
  traceBId,
  onSelectTraceA,
  onSelectTraceB,
  onSwap,
}: DiffTracePickerProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return traces;

    return traces.filter((trace) => {
      const { storyLabel, promptName } = describeTrace(trace);
      return `${trace.id} ${trace.agentId} ${trace.sessionId ?? ''} ${storyLabel} ${promptName ?? ''}`
        .toLowerCase()
        .includes(normalized);
    });
  }, [query, traces]);

  return (
    <div
      className="rounded-[var(--tenant-radius-panel)] border p-4"
      style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
            Compare picker
          </div>
          <div className="mt-1 text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>
            Replace baseline or comparison in-place, then keep investigating without leaving Run Diff.
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onSwap}>
          Swap A ↔ B
        </Button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-[var(--tenant-radius-panel-tight)] border p-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
            Baseline, A
          </div>
          <div className="mt-1 font-mono text-sm" style={{ color: 'var(--tenant-text-primary)' }}>{traceAId}</div>
        </div>
        <div className="rounded-[var(--tenant-radius-panel-tight)] border p-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
            Comparison, B
          </div>
          <div className="mt-1 font-mono text-sm" style={{ color: 'var(--tenant-text-primary)' }}>{traceBId}</div>
        </div>
      </div>

      <div className="mt-4 rounded-[var(--tenant-radius-panel-tight)] border" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
        <Command>
          <CommandInput placeholder="Search traces by id, agent, session, or story..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No traces match this search.</CommandEmpty>
            <CommandGroup heading="Available traces">
              {filtered.map((trace) => {
                const { hasError, durationSeconds, promptName, storyLabel } = describeTrace(trace);
                return (
                  <CommandItem key={trace.id} value={`${trace.id} ${trace.agentId} ${storyLabel}`}>
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{storyLabel}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {trace.agentId} · {trace.sessionId ?? 'no session'} · {hasError ? 'error path' : 'healthy path'} · {durationSeconds}s{promptName ? ` · ${promptName}` : ''}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button type="button" variant="outline" size="xs" onClick={() => onSelectTraceA(trace.id)}>
                          Set A
                        </Button>
                        <Button type="button" variant="outline" size="xs" onClick={() => onSelectTraceB(trace.id)}>
                          Set B
                        </Button>
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </div>
  );
}
