'use client';

import { useMemo, useState } from 'react';
import type { Span } from '@foxhound/types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Copy, Plus } from 'lucide-react';

interface SpanDetailPanelProps {
  span: Span | null;
  isOpen: boolean;
  onClose: () => void;
}

const SPAN_KIND_LABELS: Record<string, string> = {
  llm_call: 'LLM Call',
  tool_call: 'Tool Call',
  agent_step: 'Agent Step',
  workflow: 'Workflow',
  custom: 'Custom',
};

const SPAN_KIND_BADGE_BG: Record<string, string> = {
  llm_call: 'color-mix(in srgb, var(--tenant-accent) 14%, white)',
  tool_call: 'color-mix(in srgb, var(--tenant-success) 14%, white)',
  agent_step: 'color-mix(in srgb, var(--tenant-accent) 10%, white)',
  workflow: 'color-mix(in srgb, var(--tenant-text-muted) 12%, white)',
  custom: 'var(--tenant-panel-alt)',
};

const SPAN_KIND_ACCENT: Record<string, string> = {
  llm_call: 'var(--tenant-accent)',
  tool_call: 'var(--tenant-success)',
  agent_step: 'color-mix(in srgb, var(--tenant-accent) 72%, var(--tenant-text-secondary))',
  workflow: 'color-mix(in srgb, var(--tenant-accent) 58%, var(--tenant-text-muted))',
  custom: 'var(--tenant-text-muted)',
};

function formatDurationMs(startTimeMs: number, endTimeMs?: number | null): string {
  if (!endTimeMs) return 'In progress';
  return `${((endTimeMs - startTimeMs) / 1000).toFixed(3)}s`;
}

function formatDateTime(value: number): string {
  return new Date(value).toLocaleString();
}

export function SpanDetailPanel({ span, isOpen, onClose }: SpanDetailPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const jsonAttributes = useMemo(() => (span ? JSON.stringify(span.attributes, null, 2) : ''), [span]);

  if (!span) return null;

  const isLlmCall = span.kind === 'llm_call';
  const isToolCall = span.kind === 'tool_call';
  const accent = SPAN_KIND_ACCENT[span.kind] || SPAN_KIND_ACCENT.custom;
  const duration = formatDurationMs(span.startTimeMs, span.endTimeMs);

  const llmModel = isLlmCall && typeof span.attributes.model === 'string' ? span.attributes.model : null;
  const inputTokens = isLlmCall && typeof span.attributes.input_tokens === 'number' ? span.attributes.input_tokens : null;
  const outputTokens = isLlmCall && typeof span.attributes.output_tokens === 'number' ? span.attributes.output_tokens : null;
  const cost = isLlmCall && typeof span.attributes.cost === 'number' ? span.attributes.cost : null;

  const toolName = isToolCall && typeof span.attributes.tool === 'string' ? span.attributes.tool : null;
  const toolResults = isToolCall && typeof span.attributes.results === 'number' ? span.attributes.results : null;

  const highlightedMetrics = [
    { label: 'Duration', value: duration },
    { label: 'Status', value: span.status === 'error' ? 'Error' : span.status === 'ok' ? 'Ok' : span.status },
    { label: 'Kind', value: SPAN_KIND_LABELS[span.kind] || span.kind },
    { label: 'Started', value: new Date(span.startTimeMs).toLocaleTimeString() },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        className="w-[min(92vw,720px)] overflow-y-auto border-l p-0 sm:max-w-none"
        style={{
          borderColor: 'var(--tenant-panel-stroke)',
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--tenant-panel) 96%, transparent), color-mix(in srgb, var(--tenant-panel-strong) 92%, transparent))',
          boxShadow: '-24px 0 80px color-mix(in srgb, black 18%, transparent)',
        }}
      >
        <SheetHeader className="border-b px-6 py-5" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-panel) 72%, transparent)' }}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-start gap-3 pr-10">
              <div
                className="mt-1 h-3 w-3 rounded-full shadow-sm"
                style={{ background: accent, boxShadow: `0 0 0 6px color-mix(in srgb, ${accent} 16%, transparent)` }}
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="text-[1.35rem] font-semibold tracking-[-0.02em]" style={{ color: 'var(--tenant-text-primary)' }}>
                    {span.name}
                  </SheetTitle>
                  <Badge
                    className="border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]"
                    style={{ borderColor: 'var(--tenant-panel-stroke)', background: SPAN_KIND_BADGE_BG[span.kind] || SPAN_KIND_BADGE_BG.custom, color: 'var(--tenant-text-primary)' }}
                  >
                    {SPAN_KIND_LABELS[span.kind] || span.kind}
                  </Badge>
                  <Badge
                    variant={span.status === 'error' ? 'destructive' : 'outline'}
                    className="px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]"
                  >
                    {span.status}
                  </Badge>
                </div>
                <SheetDescription className="text-sm leading-6" style={{ color: 'var(--tenant-text-secondary)' }}>
                  Trace the execution evidence for this span, inspect the structured attributes, and capture the exact unit you want to compare or escalate.
                </SheetDescription>
                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
                  <span>Span id</span>
                  <span className="font-mono normal-case tracking-normal text-sm" style={{ color: 'var(--tenant-text-primary)' }}>{span.spanId}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {highlightedMetrics.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[var(--tenant-radius-panel-tight)] border p-3.5"
                  style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
                    {item.label}
                  </div>
                  <div className="mt-2 text-base font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 px-6 py-6">
          {(isLlmCall || isToolCall) && (
            <section className="rounded-[var(--tenant-radius-panel)] border p-5" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>Focus details</h3>
                  <p className="mt-1 text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>
                    Primary execution data surfaced first, so the side panel reads like an investigation workspace rather than a raw JSON dump.
                  </p>
                </div>
              </div>

              {isLlmCall ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {llmModel ? (
                    <div className="rounded-[var(--tenant-radius-panel-tight)] border p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-accent) 8%, white)' }}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>Model</div>
                      <div className="mt-2 font-mono text-sm font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{llmModel}</div>
                    </div>
                  ) : null}
                  {inputTokens !== null ? (
                    <div className="rounded-[var(--tenant-radius-panel-tight)] border p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>Input tokens</div>
                      <div className="mt-2 text-lg font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>{inputTokens.toLocaleString()}</div>
                    </div>
                  ) : null}
                  {outputTokens !== null ? (
                    <div className="rounded-[var(--tenant-radius-panel-tight)] border p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>Output tokens</div>
                      <div className="mt-2 text-lg font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>{outputTokens.toLocaleString()}</div>
                    </div>
                  ) : null}
                  {cost !== null ? (
                    <div className="rounded-[var(--tenant-radius-panel-tight)] border p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-accent) 9%, white)' }}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>Cost</div>
                      <div className="mt-2 text-lg font-semibold" style={{ color: accent }}>${cost.toFixed(4)}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {isToolCall ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {toolName ? (
                    <div className="rounded-[var(--tenant-radius-panel-tight)] border p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-success) 9%, white)' }}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>Tool name</div>
                      <div className="mt-2 font-mono text-sm font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{toolName}</div>
                    </div>
                  ) : null}
                  {toolResults !== null ? (
                    <div className="rounded-[var(--tenant-radius-panel-tight)] border p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>Results</div>
                      <div className="mt-2 text-lg font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>{toolResults}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          )}

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_220px]">
            <div className="rounded-[var(--tenant-radius-panel)] border p-5" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>Attributes</h3>
                  <p className="mt-1 text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>
                    Full structured payload for debugging, export, and comparison.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(jsonAttributes, 'attributes')}
                  className="gap-2 rounded-[var(--tenant-radius-control-tight)] border"
                  style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}
                >
                  {copiedField === 'attributes' ? (
                    <>
                      <Check className="h-4 w-4" style={{ color: 'var(--tenant-success)' }} />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy JSON
                    </>
                  )}
                </Button>
              </div>
              <pre
                className="max-h-[28rem] overflow-auto rounded-[var(--tenant-radius-panel-tight)] border p-4 text-xs leading-6"
                style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-inset)', color: 'var(--tenant-text-secondary)' }}
              >
                {jsonAttributes}
              </pre>
            </div>

            <div className="space-y-6">
              <section className="rounded-[var(--tenant-radius-panel)] border p-5" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>Timing</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-[var(--tenant-radius-panel-tight)] border p-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
                    <div style={{ color: 'var(--tenant-text-muted)' }}>Started</div>
                    <div className="mt-1 font-mono" style={{ color: 'var(--tenant-text-primary)' }}>{formatDateTime(span.startTimeMs)}</div>
                  </div>
                  {span.endTimeMs ? (
                    <div className="rounded-[var(--tenant-radius-panel-tight)] border p-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
                      <div style={{ color: 'var(--tenant-text-muted)' }}>Ended</div>
                      <div className="mt-1 font-mono" style={{ color: 'var(--tenant-text-primary)' }}>{formatDateTime(span.endTimeMs)}</div>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="rounded-[var(--tenant-radius-panel)] border p-5" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>Actions</h3>
                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleCopy(span.spanId, 'spanId')}
                    className="justify-start gap-2 rounded-[var(--tenant-radius-control-tight)]"
                  >
                    {copiedField === 'spanId' ? (
                      <Check className="h-4 w-4" style={{ color: 'var(--tenant-success)' }} />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copy Span ID
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2 rounded-[var(--tenant-radius-control-tight)]"
                    disabled
                    title="Coming in Phase 4"
                  >
                    <Plus className="h-4 w-4" />
                    Add to Dataset
                    <Badge variant="secondary" className="ml-auto">Coming Soon</Badge>
                  </Button>
                </div>
              </section>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
