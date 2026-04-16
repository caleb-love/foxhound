'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ChartPanel } from './chart-shell';
import type { TrendSeries } from './chart-types';
import { SegmentAwareLink } from '@/components/layout/segment-aware-link';

function toneColor(tone: TrendSeries['tone']): string {
  if (tone === 'healthy') return '#34d399';
  if (tone === 'warning') return '#fbbf24';
  if (tone === 'critical') return '#f87171';
  return '#38bdf8';
}

export function TrendChart({
  title,
  description,
  series,
}: {
  title: string;
  description: string;
  series: TrendSeries[];
}) {
  return (
    <ChartPanel title={title} description={description}>
      <div className="space-y-5">
        {series.map((entry) => {
          const color = toneColor(entry.tone);
          const gradientId = `gradient-${entry.id}`;

          return (
            <div
              key={entry.id}
              className="rounded-[var(--tenant-radius-panel)] border p-4"
              style={{
                borderColor: 'var(--tenant-panel-stroke)',
                background: 'var(--tenant-panel-strong)',
              }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: color, boxShadow: `0 0 8px ${color}60` }}
                  />
                  <div className="text-sm font-medium text-tenant-text-primary">
                    {entry.label}
                  </div>
                </div>
                <div
                  className="rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums"
                  style={{
                    borderColor: `${color}30`,
                    background: `${color}12`,
                    color,
                  }}
                >
                  {entry.values.at(-1)?.value ?? 0}
                </div>
              </div>

              {entry.href && entry.cta ? (
                <div className="mb-3 flex justify-end">
                  <SegmentAwareLink
                    href={entry.href}
                    className="inline-flex items-center rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-white/[0.04]"
                  >
                    <span style={{ color: 'var(--tenant-accent)' }}>{entry.cta}</span>
                  </SegmentAwareLink>
                </div>
              ) : null}

              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={entry.values}
                    margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                  >
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--tenant-panel-stroke)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'var(--tenant-text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--tenant-text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--tenant-panel)',
                        border: '1px solid var(--tenant-panel-stroke)',
                        borderRadius: '0.5rem',
                        backdropFilter: 'blur(12px)',
                        color: 'var(--tenant-text-primary)',
                        fontSize: '0.8rem',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      }}
                      labelStyle={{ color: 'var(--tenant-text-secondary)', fontWeight: 600 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={color}
                      strokeWidth={2}
                      fill={`url(#${gradientId})`}
                      dot={{ r: 3, fill: color, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: color, stroke: `${color}40`, strokeWidth: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </ChartPanel>
  );
}
