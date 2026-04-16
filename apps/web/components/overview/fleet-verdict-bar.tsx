'use client';

import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { SegmentAwareLink } from '@/components/layout/segment-aware-link';
import type { FleetVerdict } from '@/lib/verdict-engine';
import { cn } from '@/lib/utils';

const severityConfig = {
  critical: {
    icon: XCircle,
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.24)',
    iconColor: '#f87171',
    headlineColor: '#fca5a5',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'rgba(251,191,36,0.06)',
    border: 'rgba(251,191,36,0.20)',
    iconColor: '#fbbf24',
    headlineColor: '#fde68a',
  },
  healthy: {
    icon: CheckCircle2,
    bg: 'rgba(52,211,153,0.06)',
    border: 'rgba(52,211,153,0.20)',
    iconColor: '#34d399',
    headlineColor: '#6ee7b7',
  },
} as const;

interface FleetVerdictBarProps {
  verdict: FleetVerdict;
  /** Extra elements rendered in the action row (e.g. filter toggle) */
  trailing?: React.ReactNode;
}

export function FleetVerdictBar({ verdict, trailing }: FleetVerdictBarProps) {
  const config = severityConfig[verdict.severity];
  const Icon = config.icon;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
      }}
    >
      {/* Headline row */}
      <div className="flex items-start gap-3">
        <Icon
          className="mt-0.5 h-5 w-5 shrink-0"
          style={{ color: config.iconColor }}
        />
        <div className="min-w-0 flex-1">
          <h1
            className="text-lg font-semibold tracking-tight"
            style={{ color: config.headlineColor }}
          >
            {verdict.headline}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-tenant-text-secondary">
            {verdict.narrative}
          </p>
        </div>
      </div>

      {/* Action row */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {verdict.actions.map((action) => (
          <SegmentAwareLink
            key={action.href}
            href={action.href}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors',
              'hover:bg-white/5',
            )}
          >
            <span style={{ color: 'var(--tenant-text-primary)' }}>{action.label}</span>
          </SegmentAwareLink>
        ))}
        {trailing}
      </div>
    </div>
  );
}
