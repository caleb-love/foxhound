'use client';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { SegmentAwareLink } from '@/components/layout/segment-aware-link';
import type { MetricDelta } from '@/lib/verdict-engine';
import type { SparkPoint } from '@/components/charts/chart-types';
import { cn } from '@/lib/utils';

export interface MetricStripItem {
  label: string;
  value: string;
  delta?: MetricDelta | null;
  sparklineData?: SparkPoint[];
  href?: string;
  tone?: 'default' | 'healthy' | 'warning' | 'critical';
}

interface MetricStripProps {
  items: MetricStripItem[];
}

const toneColors = {
  default: {
    value: 'var(--tenant-text-primary)',
    spark: 'var(--tenant-accent)',
    background: 'color-mix(in srgb, var(--card) 88%, var(--background))',
    border: 'var(--tenant-panel-stroke)',
    stripe: 'transparent',
  },
  healthy: {
    value: '#0f766e',
    spark: '#34d399',
    background: 'color-mix(in srgb, var(--card) 92%, var(--background))',
    border: 'var(--tenant-panel-stroke)',
    stripe: 'rgba(52,211,153,0.55)',
  },
  warning: {
    value: '#b45309',
    spark: '#f59e0b',
    background: 'color-mix(in srgb, var(--card) 78%, rgba(251,191,36,0.10))',
    border: 'color-mix(in srgb, var(--tenant-panel-stroke) 60%, rgba(251,191,36,0.55))',
    stripe: 'rgba(245,158,11,0.85)',
  },
  critical: {
    value: '#b91c1c',
    spark: '#ef4444',
    background: 'color-mix(in srgb, var(--card) 70%, rgba(248,113,113,0.12))',
    border: 'color-mix(in srgb, var(--tenant-panel-stroke) 40%, rgba(248,113,113,0.70))',
    stripe: '#dc2626',
  },
} as const;

function DeltaBadge({ delta }: { delta: MetricDelta }) {
  const Icon = delta.direction === 'up' ? ArrowUp : delta.direction === 'down' ? ArrowDown : Minus;
  const color = delta.isRegression ? '#f87171' : delta.direction === 'flat' ? 'var(--tenant-text-muted)' : '#34d399';

  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
      style={{ color, background: `${color}14` }}
    >
      <Icon className="h-3 w-3" />
      {delta.label}
    </span>
  );
}

function MiniSparkline({ data, color }: { data: SparkPoint[]; color: string }) {
  if (data.length < 2) return null;

  return (
    <div className="h-6 w-16 opacity-60">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 1, right: 1, bottom: 1, left: 1 }}>
          <defs>
            <linearGradient id={`strip-spark-${color.replace(/[^a-z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#strip-spark-${color.replace(/[^a-z0-9]/g, '')})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricStripCell({ item }: { item: MetricStripItem }) {
  const tone = item.tone ?? 'default';
  const colors = toneColors[tone];

  const content = (
    <div
      aria-label={`${item.label}: ${item.value}${item.delta ? `, ${item.delta.label}` : ''}`}
      data-tone={tone}
      className={cn(
        'relative flex h-full min-w-0 items-center gap-3 overflow-hidden rounded-xl border px-4 py-3.5 transition-colors',
        item.href && 'cursor-pointer hover:bg-white/[0.03]',
      )}
      style={{
        borderColor: colors.border,
        background: colors.background,
      }}
    >
      {/* Tone stripe — silent for default, present for healthy/warning/critical. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
        style={{ background: colors.stripe }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">
          {item.label}
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span
            className="text-[28px] font-semibold leading-none tracking-tight"
            style={{
              color: colors.value,
              fontVariantNumeric: 'tabular-nums',
              fontFamily:
                'var(--font-mono), "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {item.value}
          </span>
          {item.delta ? <DeltaBadge delta={item.delta} /> : null}
        </div>
      </div>
      {item.sparklineData && item.sparklineData.length > 1 ? (
        <MiniSparkline data={item.sparklineData} color={colors.spark} />
      ) : null}
    </div>
  );

  if (item.href) {
    return (
      <SegmentAwareLink href={item.href} className="block h-full">
        {content}
      </SegmentAwareLink>
    );
  }

  return content;
}

export function MetricStrip({ items }: MetricStripProps) {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      role="group"
      aria-label="Key metrics"
    >
      {items.map((item) => (
        <MetricStripCell key={item.label} item={item} />
      ))}
    </div>
  );
}
