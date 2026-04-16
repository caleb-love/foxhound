'use client';

import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { PremiumActionLink, PremiumActions, PremiumMetricCard } from '@/components/sandbox/primitives';
import type { MetricTileData } from './chart-types';

export function MetricTile({ label, value, supportingText, sparklineData, href }: MetricTileData) {
  return (
    <div className="flex h-full flex-col gap-3">
      <PremiumMetricCard className="h-full" label={label} value={value} supportingText={supportingText ?? ''}>
        {sparklineData && sparklineData.length > 1 ? (
          <div className="mt-3 h-10 w-full opacity-70">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--tenant-accent)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--tenant-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--tenant-accent)"
                  strokeWidth={1.5}
                  fill={`url(#spark-${label})`}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </PremiumMetricCard>
      {href ? (
        <PremiumActions>
          <PremiumActionLink href={href}>Open</PremiumActionLink>
        </PremiumActions>
      ) : null}
    </div>
  );
}
