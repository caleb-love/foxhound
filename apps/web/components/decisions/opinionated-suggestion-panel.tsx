'use client';

import { useState } from 'react';
import {
  FRAMEWORK_LABEL,
  type OpinionatedSuggestion,
} from '@/lib/decisions-queue-types';

export interface OpinionatedSuggestionPanelProps {
  suggestion: OpinionatedSuggestion;
  /**
   * Optional heading rendered above the framework badge. Use on standalone
   * surfaces (e.g. Regressions, Budgets) to frame the panel. Omit when the
   * panel is embedded inside an existing card that already names it.
   */
  heading?: string;
  /** Initial expanded state of the diff. Defaults to collapsed. */
  defaultExpanded?: boolean;
}

/**
 * Renders a single opinionated suggestion: framework badge + summary +
 * collapsible diff + expected impact. Shared between the decisions queue on
 * the Fleet Overview, the executive decision cards, and any detail page that
 * surfaces a suggestion inline (Regressions, Budgets, Prompts).
 */
export function OpinionatedSuggestionPanel({
  suggestion,
  heading,
  defaultExpanded = false,
}: OpinionatedSuggestionPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div
      className="rounded-lg border px-3 py-2.5"
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        background: 'color-mix(in srgb, var(--card) 92%, var(--background))',
      }}
    >
      {heading ? (
        <div
          className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: 'var(--tenant-text-muted)' }}
        >
          {heading}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{
            borderColor: 'var(--tenant-panel-stroke)',
            color: 'var(--tenant-text-secondary)',
          }}
        >
          {FRAMEWORK_LABEL[suggestion.framework]}
        </span>
        <span className="text-[12px] font-medium text-tenant-text-primary">
          {suggestion.summary}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1.5 text-[11px] font-medium text-tenant-accent hover:underline"
        aria-expanded={expanded}
      >
        {expanded ? 'Hide proposed diff' : 'Show proposed diff'}
      </button>
      {expanded ? (
        <pre
          className="mt-2 overflow-x-auto rounded-md border px-3 py-2 text-[11px] leading-relaxed"
          style={{
            borderColor: 'var(--tenant-panel-stroke)',
            background: 'color-mix(in srgb, var(--card) 70%, #000000 12%)',
            color: 'var(--tenant-text-secondary)',
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          }}
        >
          {suggestion.diff}
        </pre>
      ) : null}
      <div className="mt-2 text-[11px]" style={{ color: 'var(--tenant-text-muted)' }}>
        Expected impact: {suggestion.expectedImpact}
      </div>
    </div>
  );
}
