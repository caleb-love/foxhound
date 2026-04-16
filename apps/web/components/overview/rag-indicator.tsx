'use client';

import type { ExecutiveVerdict } from '@/lib/verdict-engine';

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
      className="rounded-2xl p-6 text-center"
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
      }}
    >
      {/* RAG circle + label */}
      <div className="flex items-center justify-center gap-3">
        <div
          className="h-5 w-5 rounded-full"
          style={{
            background: config.color,
            boxShadow: `0 0 16px ${config.glow}, 0 0 4px ${config.glow}`,
          }}
        />
        <span
          className="text-xl font-bold tracking-[0.14em]"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
      </div>

      {/* Headline */}
      <h1
        className="mx-auto mt-3 max-w-lg text-lg font-semibold tracking-tight text-tenant-text-primary"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {verdict.headline}
      </h1>

      {/* Subheadline */}
      <p className="mt-1.5 text-sm text-tenant-text-secondary">
        {verdict.subheadline}
      </p>

      {/* Timestamp row */}
      {(periodLabel || generatedAt) ? (
        <div className="mt-3 flex items-center justify-center gap-4 text-[11px] font-medium uppercase tracking-[0.12em] text-tenant-text-muted">
          {periodLabel ? <span>{periodLabel}</span> : null}
          {periodLabel && generatedAt ? <span>·</span> : null}
          {generatedAt ? <span>{generatedAt}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
