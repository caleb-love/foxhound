'use client';

import { useState } from 'react';
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
import { Copy, Check, Plus } from 'lucide-react';

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

const SPAN_KIND_COLORS: Record<string, string> = {
  llm_call: 'color-mix(in srgb, var(--tenant-accent) 14%, white)',
  tool_call: 'color-mix(in srgb, var(--tenant-success) 14%, white)',
  agent_step: 'color-mix(in srgb, var(--tenant-accent) 14%, white)',
  workflow: 'color-mix(in srgb, var(--tenant-text-muted) 14%, white)',
  custom: 'var(--tenant-panel-alt)',
};

export function SpanDetailPanel({ span, isOpen, onClose }: SpanDetailPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!span) return null;

  const duration = span.endTimeMs
    ? ((span.endTimeMs - span.startTimeMs) / 1000).toFixed(3)
    : 'In progress';

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Extract LLM-specific attributes
  const isLlmCall = span.kind === 'llm_call';
  const llmModel = isLlmCall ? (span.attributes.model as string) : null;
  const inputTokens = isLlmCall ? (span.attributes.input_tokens as number) : null;
  const outputTokens = isLlmCall ? (span.attributes.output_tokens as number) : null;
  const cost = isLlmCall ? (span.attributes.cost as number) : null;

  // Extract tool-specific attributes
  const isToolCall = span.kind === 'tool_call';
  const toolName = isToolCall ? (span.attributes.tool as string) : null;
  const toolResults = isToolCall ? (span.attributes.results as number) : null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle className="text-xl">{span.name}</SheetTitle>
            <Badge className={SPAN_KIND_COLORS[span.kind] || SPAN_KIND_COLORS.custom}>
              {SPAN_KIND_LABELS[span.kind] || span.kind}
            </Badge>
            {span.status === 'error' && (
              <Badge variant="destructive">Error</Badge>
            )}
          </div>
          <SheetDescription>
            Span ID: {span.spanId}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
              <div className="text-sm" style={{ color: 'var(--tenant-text-muted)' }}>Duration</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--tenant-text-primary)' }}>{duration}s</div>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
              <div className="text-sm" style={{ color: 'var(--tenant-text-muted)' }}>Status</div>
              <div className="text-2xl font-bold capitalize" style={{ color: 'var(--tenant-text-primary)' }}>{span.status}</div>
            </div>
          </div>

          {/* LLM-specific info */}
          {isLlmCall && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--tenant-text-secondary)' }}>LLM Details</h3>
              <div className="space-y-2 rounded-lg border p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-accent) 10%, white)' }}>
                {llmModel && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>Model</span>
                    <span className="font-mono text-sm font-medium">{llmModel}</span>
                  </div>
                )}
                {inputTokens !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>Input Tokens</span>
                    <span className="font-mono text-sm font-medium">
                      {inputTokens.toLocaleString()}
                    </span>
                  </div>
                )}
                {outputTokens !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>Output Tokens</span>
                    <span className="font-mono text-sm font-medium">
                      {outputTokens.toLocaleString()}
                    </span>
                  </div>
                )}
                {cost !== null && (
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--tenant-text-secondary)' }}>Cost</span>
                    <span className="font-mono text-sm font-bold" style={{ color: 'var(--tenant-accent)' }}>
                      ${cost.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tool-specific info */}
          {isToolCall && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--tenant-text-secondary)' }}>Tool Details</h3>
              <div className="space-y-2 rounded-lg border p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-success) 10%, white)' }}>
                {toolName && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>Tool Name</span>
                    <span className="font-mono text-sm font-medium">{toolName}</span>
                  </div>
                )}
                {toolResults !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>Results</span>
                    <span className="font-mono text-sm font-medium">{toolResults}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All Attributes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--tenant-text-secondary)' }}>All Attributes</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(JSON.stringify(span.attributes, null, 2), 'attributes')}
                className="gap-2"
              >
                {copiedField === 'attributes' ? (
                  <>
                    <Check className="h-4 w-4" style={{ color: 'var(--tenant-success)' }} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy JSON
                  </>
                )}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-lg border p-4 text-xs" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)', color: 'var(--tenant-text-secondary)' }}>
              {JSON.stringify(span.attributes, null, 2)}
            </pre>
          </div>

          {/* Timing Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--tenant-text-secondary)' }}>Timing</h3>
            <div className="space-y-2 rounded-lg border p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--tenant-text-secondary)' }}>Started</span>
                <span className="font-mono">
                  {new Date(span.startTimeMs).toLocaleString()}
                </span>
              </div>
              {span.endTimeMs && (
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--tenant-text-secondary)' }}>Ended</span>
                  <span className="font-mono">
                    {new Date(span.endTimeMs).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 border-t pt-6">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--tenant-text-secondary)' }}>Actions</h3>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => handleCopy(span.spanId, 'spanId')}
                className="justify-start gap-2"
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
                className="justify-start gap-2"
                disabled
                title="Coming in Phase 4"
              >
                <Plus className="h-4 w-4" />
                Add to Dataset
                <Badge variant="secondary" className="ml-auto">
                  Coming Soon
                </Badge>
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
