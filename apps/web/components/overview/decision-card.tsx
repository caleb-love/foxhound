'use client';

import { SegmentAwareLink } from '@/components/layout/segment-aware-link';

export type DecisionStatus = 'on-track' | 'watch' | 'attention';

export interface DecisionCardProps {
  title: string;
  status: DecisionStatus;
  evidence: string;
  recommendation: string;
  href: string;
  cta: string;
}

const statusConfig = {
  'on-track': {
    stripe: '#34d399',
    label: 'ON TRACK',
    labelColor: '#34d399',
    bg: 'rgba(52,211,153,0.03)',
  },
  watch: {
    stripe: '#fbbf24',
    label: 'WATCH',
    labelColor: '#fbbf24',
    bg: 'rgba(251,191,36,0.03)',
  },
  attention: {
    stripe: '#f87171',
    label: 'ATTENTION',
    labelColor: '#f87171',
    bg: 'rgba(248,113,113,0.04)',
  },
} as const;

export function DecisionCard({ title, status, evidence, recommendation, href, cta }: DecisionCardProps) {
  const config = statusConfig[status];

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        borderLeft: `3px solid ${config.stripe}`,
        background: config.bg,
      }}
    >
      {/* Status badge */}
      <div
        className="mb-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold tracking-[0.14em]"
        style={{ color: config.labelColor, background: `${config.stripe}14` }}
      >
        {config.label}
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-tenant-text-primary">{title}</h3>

      {/* Evidence */}
      <p className="mt-1.5 text-[13px] leading-relaxed text-tenant-text-secondary">
        {evidence}
      </p>

      {/* Recommendation */}
      <p className="mt-2 text-[13px] font-medium" style={{ color: 'var(--tenant-accent)' }}>
        Recommendation: {recommendation}
      </p>

      {/* Action */}
      <div className="mt-3">
        <SegmentAwareLink
          href={href}
          className="inline-flex items-center rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-white/[0.04]"
        >
          <span style={{ color: 'var(--tenant-text-primary)' }}>{cta}</span>
        </SegmentAwareLink>
      </div>
    </div>
  );
}
