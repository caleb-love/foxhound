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
  llm_call: 'color-mix(in srgb, var(--tenant-accent) 14%, var(--card))',
  tool_call: 'color-mix(in srgb, var(--tenant-success) 14%, var(--card))',
  agent_step: 'color-mix(in srgb, var(--tenant-accent) 10%, var(--card))',
  workflow: 'color-mix(in srgb, var(--tenant-text-muted) 12%, var(--card))',
  custom: 'color-mix(in srgb, var(--card) 88%, var(--background))',
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

function EvidenceRow({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'accent';
}) {
  return (
    <div
      className="flex items-start justify-between gap-4 rounded-[var(--tenant-radius-panel-tight)] border px-4 py-3"
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        background: tone === 'accent'
          ? 'color-mix(in srgb, var(--tenant-accent) 12%, var(--card))'
          : 'color-mix(in srgb, var(--card) 88%, var(--background))',
      }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
        {label}
      </div>
      <div className="min-w-0 text-right text-[15px] font-semibold tracking-[-0.02em]" style={{ color: 'var(--tenant-text-primary)' }}>
        {value}
      </div>
    </div>
  );
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

  const summaryRows = [
    { label: 'Duration', value: duration },
    { label: 'Status', value: span.status === 'error' ? 'Error' : span.status === 'ok' ? 'Ok' : span.status },
    { label: 'Kind', value: SPAN_KIND_LABELS[span.kind] || span.kind },
    { label: 'Started', value: new Date(span.startTimeMs).toLocaleTimeString() },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        className="w-[min(96vw,760px)] overflow-y-auto border-l p-0 sm:w-[min(88vw,760px)] sm:max-w-none"
        style={{
          borderColor: 'var(--tenant-panel-stroke)',
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--card) 98%, var(--background)), color-mix(in srgb, var(--card) 92%, var(--background)))',
          boxShadow: '-24px 0 72px color-mix(in srgb, black 18%, transparent)',
        }}
      >
        <SheetHeader
          className="border-b px-5 py-5 sm:px-6 sm:py-6"
          style={{
            borderColor: 'var(--tenant-panel-stroke)',
            background: 'linear-gradient(180deg, color-mix(in srgb, var(--card) 98%, var(--background)), color-mix(in srgb, var(--card) 92%, var(--background)))',
          }}
        >
          <div className="space-y-5 pr-12 sm:pr-10">
            <div className="flex items-start gap-4">
              <div
                className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                style={{ background: accent, boxShadow: `0 0 0 7px color-mix(in srgb, ${accent} 14%, transparent)` }}
              />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="text-[1.55rem] font-semibold tracking-[-0.03em] sm:text-[1.7rem]" style={{ color: 'var(--tenant-text-primary)' }}>
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
                <SheetDescription className="max-w-2xl text-[15px] leading-7 sm:text-base" style={{ color: 'var(--tenant-text-secondary)' }}>
                  Trace the execution evidence for this span, inspect the structured attributes, and capture the exact unit you want to compare or escalate.
                </SheetDescription>
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>
                    Span id
                  </span>
                  <span
                    className="max-w-full overflow-hidden rounded-[var(--tenant-radius-control-tight)] border px-3 py-1.5 font-mono text-sm"
                    style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-primary)' }}
                  >
                    {span.spanId}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              {summaryRows.map((item, index) => (
                <EvidenceRow
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  tone={index === 0 ? 'accent' : 'default'}
                />
              ))}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
          {(isLlmCall || isToolCall) && (
            <section className="rounded-[var(--tenant-radius-panel)] border p-4 sm:p-5" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
              <div className="mb-4">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>Focus details</h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>
                  Primary execution data surfaced first, so the inspector reads like evidence review, not a cramped admin form.
                </p>
              </div>

              {isLlmCall ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {llmModel ? <EvidenceRow label="Model" value={llmModel} tone="accent" /> : null}
                  {inputTokens !== null ? <EvidenceRow label="Input tokens" value={inputTokens.toLocaleString()} /> : null}
                  {outputTokens !== null ? <EvidenceRow label="Output tokens" value={outputTokens.toLocaleString()} /> : null}
                  {cost !== null ? <EvidenceRow label="Cost" value={`$${cost.toFixed(4)}`} /> : null}
                </div>
              ) : null}

              {isToolCall ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {toolName ? <EvidenceRow label="Tool name" value={toolName} tone="accent" /> : null}
                  {toolResults !== null ? <EvidenceRow label="Results" value={String(toolResults)} /> : null}
                </div>
              ) : null}
            </section>
          )}

          <section className="rounded-[var(--tenant-radius-panel)] border p-4 sm:p-5" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
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
                style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
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
              className="max-h-[28rem] overflow-auto rounded-[var(--tenant-radius-panel-tight)] border p-3 text-[11px] leading-6 sm:p-4 sm:text-xs"
              style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-inset)', color: 'var(--tenant-text-secondary)' }}
            >
              {jsonAttributes}
            </pre>
          </section>

          <section className="rounded-[var(--tenant-radius-panel)] border p-4 sm:p-5" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>Timing</h3>
            <div className="mt-4 grid gap-3">
              <EvidenceRow label="Started" value={formatDateTime(span.startTimeMs)} />
              {span.endTimeMs ? <EvidenceRow label="Ended" value={formatDateTime(span.endTimeMs)} /> : null}
            </div>
          </section>

          <section className="rounded-[var(--tenant-radius-panel)] border p-4 sm:p-5" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>Actions</h3>
            <div className="mt-4 flex flex-col gap-2.5">
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
      </SheetContent>
    </Sheet>
  );
}
