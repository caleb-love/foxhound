'use client';

import type { ExecutiveVerdict } from '@/lib/verdict-engine';
import { Blaze } from '@/components/system/blaze';

const ragConfig = {
  green: {
    color: '#34d399',
    glow: 'rgba(52,211,153,0.25)',
    bg: 'rgba(52,211,153,0.06)',
    border: 'rgba(52,211,153,0.18)',
    label: 'GREEN',
  },
  amber: {
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.25)',
    bg: 'rgba(251,191,36,0.06)',
    border: 'rgba(251,191,36,0.18)',
    label: 'AMBER',
  },
  red: {
    color: '#f87171',
    glow: 'rgba(248,113,113,0.25)',
    bg: 'rgba(248,113,113,0.06)',
    border: 'rgba(248,113,113,0.18)',
    label: 'RED',
  },
} as const;

interface RagIndicatorProps {
  verdict: ExecutiveVerdict;
  /** e.g. "Week of Apr 14, 2026" */
  periodLabel?: string;
  /** e.g. "Generated 8:02am PT" */
  generatedAt?: string;
}

export function RagIndicator({ verdict, periodLabel, generatedAt }: RagIndicatorProps) {
  const config = ragConfig[verdict.rag];

  return (
    <div
      role="status"
      aria-label={`Platform status: ${config.label}. ${verdict.headline}`}
      className="rounded-2xl p-7 md:p-8"
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        boxShadow: '0 24px 60px -30px rgba(15,23,42,0.12)',
      }}
    >
      {/* Eyebrow row — Blaze + orientation + status. */}
      <div className="flex items-center justify-between gap-3">
        <div
          className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--tenant-text-muted)' }}
        >
          <Blaze tone="severity" color={config.color} />
          <span style={{ color: config.color }}>Executive Summary</span>
          <span aria-hidden style={{ opacity: 0.5 }}>·</span>
          <span>Week-over-week posture</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background: config.color,
              boxShadow: `0 0 12px ${config.glow}, 0 0 3px ${config.glow}`,
            }}
            aria-hidden
          />
          <span
            className="text-[11px] font-bold tracking-[0.18em]"
            style={{ color: config.color }}
          >
            {config.label}
          </span>
        </div>
      </div>

      {/* Headline */}
      <h1
        className="mt-5 text-2xl md:text-[28px] font-semibold leading-[1.15] tracking-tight text-tenant-text-primary"
        style={{ fontFamily: 'var(--font-heading), Outfit, ui-sans-serif, system-ui' }}
      >
        {verdict.headline}
      </h1>

      {/* Subheadline */}
      <p className="mt-2 max-w-[78ch] text-[14px] leading-[1.55] text-tenant-text-secondary">
        {verdict.subheadline}
      </p>

      {/* Timestamp row */}
      {(periodLabel || generatedAt) ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-tenant-text-muted">
          {periodLabel ? <span>{periodLabel}</span> : null}
          {periodLabel && generatedAt ? <span aria-hidden style={{ opacity: 0.5 }}>·</span> : null}
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
