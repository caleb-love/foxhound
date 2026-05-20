'use client';

import { SegmentAwareLink } from '@/components/layout/segment-aware-link';
import { cn } from '@/lib/utils';
import {
  KIND_LABEL,
  type DecisionsQueueEntryKind,
  type OpinionatedSuggestion,
} from '@/lib/decisions-queue-types';
import { OpinionatedSuggestionPanel } from '@/components/decisions/opinionated-suggestion-panel';

export type ActionSeverity = 'critical' | 'warning' | 'healthy';

export interface ActionQueueAction {
  label: string;
  href: string;
}

export interface ActionQueueItem {
  title: string;
  context: string;
  severity: ActionSeverity;
  agentIds: string[];
  actions: ActionQueueAction[];
  /** Issue / Insight / Action — defaults to 'issue' when omitted. */
  kind?: DecisionsQueueEntryKind;
  /** Only valid when kind === 'action'. */
  suggestion?: OpinionatedSuggestion;
}

interface ActionQueueProps {
  items: ActionQueueItem[];
  /** Maximum items to show before truncating */
  limit?: number;
}

const severityDot: Record<ActionSeverity, string> = {
  critical: '#f87171',
  warning: '#fbbf24',
  healthy: '#34d399',
};

const severityBorder: Record<ActionSeverity, string> = {
  critical: 'rgba(248,113,113,0.24)',
  warning: 'rgba(251,191,36,0.16)',
  healthy: 'rgba(52,211,153,0.12)',
};

const severityBg: Record<ActionSeverity, string> = {
  critical: 'rgba(248,113,113,0.04)',
  warning: 'rgba(251,191,36,0.02)',
  healthy: 'transparent',
};

const kindBadgeColor: Record<DecisionsQueueEntryKind, { fg: string; bg: string }> = {
  issue: { fg: '#fca5a5', bg: 'rgba(248,113,113,0.12)' },
  insight: { fg: '#fcd34d', bg: 'rgba(251,191,36,0.12)' },
  action: { fg: '#86efac', bg: 'rgba(52,211,153,0.14)' },
};

function sortByOperatorValue(a: ActionQueueItem, b: ActionQueueItem): number {
  // Actions first (highest-leverage move an operator can take), then issues by
  // severity, then insights last.
  const kindRank: Record<DecisionsQueueEntryKind, number> = { action: 0, issue: 1, insight: 2 };
  const aKind = a.kind ?? 'issue';
  const bKind = b.kind ?? 'issue';
  if (kindRank[aKind] !== kindRank[bKind]) return kindRank[aKind] - kindRank[bKind];
  const sevRank: Record<ActionSeverity, number> = { critical: 0, warning: 1, healthy: 2 };
  return sevRank[a.severity] - sevRank[b.severity];
}

export function ActionQueue({ items, limit = 6 }: ActionQueueProps) {
  const sorted = [...items].sort(sortByOperatorValue);
  const visible = sorted.slice(0, limit);
  const hiddenCount = sorted.length - visible.length;

  return (
    <div
      className="rounded-2xl border"
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        background: 'var(--card)',
        boxShadow: 'var(--tenant-shadow-panel)',
      }}
    >
      <div
        className="flex items-baseline justify-between px-5 pt-4 pb-2"
        role="region"
        aria-label="Decisions queue"
      >
        <h2
          className="text-base font-semibold text-tenant-text-primary"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Decisions queue
        </h2>
        <span className="text-[11px] uppercase tracking-[0.14em] text-tenant-text-muted">
          Issue · Insight · Action
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
        {visible.map((item) => {
          const kind: DecisionsQueueEntryKind = item.kind ?? 'issue';
          const kindColors = kindBadgeColor[kind];
          return (
            <div
              key={item.title}
              className="px-5 py-3.5"
              style={{
                borderLeft: `3px solid ${severityBorder[item.severity]}`,
                background: severityBg[item.severity],
              }}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: severityDot[item.severity] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-[0.14em]"
                      style={{ color: kindColors.fg, background: kindColors.bg }}
                    >
                      {KIND_LABEL[kind]}
                    </span>
                    <span className="text-sm font-medium text-tenant-text-primary">
                      {item.title}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] leading-relaxed text-tenant-text-secondary">
                    {item.context}
                  </div>
                  {kind === 'action' && item.suggestion ? (
                    <div className="mt-2.5">
                      <OpinionatedSuggestionPanel suggestion={item.suggestion} />
                    </div>
                  ) : null}
                  {item.actions.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.actions.map((action) => (
                        <SegmentAwareLink
                          key={action.href}
                          href={action.href}
                          className={cn(
                            'inline-flex items-center rounded-md border px-2 py-1 text-[12px] font-medium transition-colors',
                            'hover:bg-white/[0.04]',
                          )}
                        >
                          <span style={{ color: 'var(--tenant-accent)' }}>{action.label}</span>
                        </SegmentAwareLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 ? (
        <div
          className="px-5 py-2.5 text-center text-[12px] font-medium text-tenant-text-muted"
          style={{ borderTop: '1px solid var(--tenant-panel-stroke)' }}
        >
          +{hiddenCount} more item{hiddenCount > 1 ? 's' : ''}
        </div>
      ) : null}
    </div>
  );
}

