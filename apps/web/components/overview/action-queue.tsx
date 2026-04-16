'use client';

import { SegmentAwareLink } from '@/components/layout/segment-aware-link';
import { cn } from '@/lib/utils';

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

function sortBySeverity(a: ActionQueueItem, b: ActionQueueItem): number {
  const order: Record<ActionSeverity, number> = { critical: 0, warning: 1, healthy: 2 };
  return order[a.severity] - order[b.severity];
}

export function ActionQueue({ items, limit = 6 }: ActionQueueProps) {
  const sorted = [...items].sort(sortBySeverity);
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
      <div className="px-5 pt-4 pb-2" role="region" aria-label="Action queue">
        <h2
          className="text-base font-semibold text-tenant-text-primary"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Action queue
        </h2>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--tenant-panel-stroke)' }}>
        {visible.map((item) => (
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
                <div className="text-sm font-medium text-tenant-text-primary">{item.title}</div>
                <div className="mt-0.5 text-[13px] leading-relaxed text-tenant-text-secondary">
                  {item.context}
                </div>
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
        ))}
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
