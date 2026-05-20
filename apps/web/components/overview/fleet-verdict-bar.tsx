'use client';

import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { SegmentAwareLink } from '@/components/layout/segment-aware-link';
import type { FleetVerdict } from '@/lib/verdict-engine';
import { cn } from '@/lib/utils';
import { Blaze } from '@/components/system/blaze';

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
      role="status"
      aria-label={`Fleet status: ${verdict.severity}. ${verdict.headline}`}
      className="rounded-2xl p-6 md:p-7"
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        boxShadow:
          verdict.severity === 'critical'
            ? '0 24px 60px -30px rgba(220,38,38,0.18)'
            : verdict.severity === 'warning'
              ? '0 24px 60px -30px rgba(251,191,36,0.16)'
              : '0 24px 60px -30px rgba(15,23,42,0.10)',
      }}
    >
      {/* Eyebrow — Blaze + orientation per DESIGN.md §"Page composition". */}
      <div
        className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: 'var(--tenant-text-muted)' }}
      >
        <Blaze tone="severity" color={config.iconColor} />
        <span style={{ color: config.iconColor }}>Fleet Overview</span>
        <span aria-hidden style={{ opacity: 0.5 }}>·</span>
        <span>{verdict.severity === 'healthy' ? 'On track' : verdict.severity === 'warning' ? 'Watch' : 'Attention'}</span>
      </div>

      {/* Headline row */}
      <div className="flex items-start gap-3">
        <Icon
          className="mt-1.5 h-6 w-6 shrink-0"
          style={{ color: config.iconColor }}
        />
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl md:text-[28px] font-semibold leading-[1.15] tracking-tight"
            style={{
              color: config.headlineColor,
              fontFamily: 'var(--font-heading), Outfit, ui-sans-serif, system-ui',
            }}
          >
            {verdict.headline}
          </h1>
          <p className="mt-2 text-[14px] leading-[1.55] text-tenant-text-secondary max-w-[78ch]">
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
