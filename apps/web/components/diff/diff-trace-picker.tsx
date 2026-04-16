'use client';

import { useMemo, useState } from 'react';
import type { Trace } from '@foxhound/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown } from 'lucide-react';

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
  const storyLabel = typeof trace.metadata?.story_label === 'string' ? trace.metadata.story_label : trace.id;
  return { hasError, durationSeconds, promptName, storyLabel };
}

function TraceDropdown({
  label,
  currentId,
  traces,
  onSelect,
}: {
  label: string;
  currentId: string;
  traces: Trace[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return traces;
    return traces.filter((t) => {
      const { storyLabel, promptName } = describeTrace(t);
      return `${t.id} ${t.agentId} ${t.sessionId ?? ''} ${storyLabel} ${promptName ?? ''}`.toLowerCase().includes(q);
    });
  }, [query, traces]);

  const currentTrace = traces.find((t) => t.id === currentId);
  const currentLabel = currentTrace
    ? describeTrace(currentTrace).storyLabel
    : currentId.slice(0, 16);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex items-center gap-1.5 rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-[color:color-mix(in_srgb,var(--tenant-accent)_32%,var(--tenant-panel-stroke))]"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-primary)' }}
      >
        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: 'color-mix(in srgb, var(--tenant-accent) 16%, var(--card))', color: 'var(--tenant-accent)' }}>
          {label}
        </span>
        <span className="max-w-[160px] truncate">{currentLabel}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-tenant-text-muted" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0"
        align="start"
        style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}
      >
        {/* Search */}
        <div className="border-b px-3 py-2" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
          <input
            type="text"
            placeholder="Search traces..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-tenant-text-primary placeholder:text-tenant-text-muted outline-none"
            autoFocus
          />
        </div>

        {/* Results */}
        <div className="max-h-[280px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-tenant-text-muted">No traces match</div>
          ) : (
            filtered.slice(0, 30).map((trace) => {
              const { hasError, durationSeconds, storyLabel } = describeTrace(trace);
              const isCurrent = trace.id === currentId;

              return (
                <button
                  key={trace.id}
                  type="button"
                  onClick={() => {
                    onSelect(trace.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[color:color-mix(in_srgb,var(--tenant-accent)_6%,var(--card))]"
                  style={isCurrent ? { background: 'color-mix(in srgb, var(--tenant-accent) 10%, var(--card))' } : undefined}
                >
                  <div
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: hasError ? 'var(--tenant-danger)' : 'var(--tenant-success)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-tenant-text-primary">{storyLabel}</div>
                    <div className="truncate text-[10px] text-tenant-text-muted">
                      {trace.agentId} · {durationSeconds}s · {trace.spans.length} spans
                    </div>
                  </div>
                  {isCurrent ? (
                    <span className="shrink-0 text-[9px] font-bold uppercase text-tenant-accent">Current</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {filtered.length > 30 ? (
          <div className="border-t px-3 py-1.5 text-center text-[10px] text-tenant-text-muted" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
            Showing 30 of {filtered.length} — narrow with search
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function DiffTracePicker({
  traces,
  traceAId,
  traceBId,
  onSelectTraceA,
  onSelectTraceB,
  onSwap,
}: DiffTracePickerProps) {
  if (traces.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TraceDropdown label="A" currentId={traceAId} traces={traces} onSelect={onSelectTraceA} />
      <TraceDropdown label="B" currentId={traceBId} traces={traces} onSelect={onSelectTraceB} />
    </div>
  );
}
