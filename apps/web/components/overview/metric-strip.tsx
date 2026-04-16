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
  default: { value: 'var(--tenant-text-primary)', spark: 'var(--tenant-accent)' },
  healthy: { value: '#34d399', spark: '#34d399' },
  warning: { value: '#fbbf24', spark: '#fbbf24' },
  critical: { value: '#f87171', spark: '#f87171' },
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
      className={cn(
        'flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
        item.href && 'cursor-pointer hover:bg-white/[0.03]',
      )}
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        background: 'color-mix(in srgb, var(--card) 88%, var(--background))',
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">
          {item.label}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span
            className="text-2xl font-bold tabular-nums tracking-tight"
            style={{ color: colors.value }}
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
      <SegmentAwareLink href={item.href} className="flex flex-1">
        {content}
      </SegmentAwareLink>
    );
  }

  return content;
}

export function MetricStrip({ items }: MetricStripProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <MetricStripCell key={item.label} item={item} />
      ))}
    </div>
  );
}
