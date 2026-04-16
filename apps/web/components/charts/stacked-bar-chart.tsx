'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { ChartPanel } from './chart-shell';
import type { ChartStatusTone } from './chart-types';

export interface StackedBarDrillIn {
  href?: string;
  onClick?: () => void;
}

export interface StackedBarDatum {
  label: string;
  healthy?: number;
  warning?: number;
  critical?: number;
  drillIn?: StackedBarDrillIn;
}

function toneColor(tone: ChartStatusTone) {
  if (tone === 'healthy') return '#34d399';
  if (tone === 'warning') return '#fbbf24';
  if (tone === 'critical') return '#f87171';
  return '#38bdf8';
}

export function StackedBarChart({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: StackedBarDatum[];
}) {
  return (
    <ChartPanel title={title} description={description}>
      <div className="h-72 rounded-[var(--tenant-radius-panel)] border p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
            onClick={(state) => {
              const maybePayload = state && typeof state === 'object' && 'activePayload' in state
                ? (state as { activePayload?: Array<{ payload?: StackedBarDatum }> }).activePayload
                : undefined;
              const payload = maybePayload?.[0]?.payload;
              if (!payload?.drillIn) return;
              if (payload.drillIn.onClick) {
                payload.drillIn.onClick();
                return;
              }
              if (payload.drillIn.href) {
                window.location.href = payload.drillIn.href;
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--tenant-panel-stroke)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--tenant-text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--tenant-text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: 'var(--tenant-panel)',
                border: '1px solid var(--tenant-panel-stroke)',
                borderRadius: '0.5rem',
                color: 'var(--tenant-text-primary)',
                fontSize: '0.8rem',
              }}
            />
            <Bar dataKey="healthy" stackId="a" fill={toneColor('healthy')} radius={[4, 4, 0, 0]} />
            <Bar dataKey="warning" stackId="a" fill={toneColor('warning')} radius={[4, 4, 0, 0]} />
            <Bar dataKey="critical" stackId="a" fill={toneColor('critical')} radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`${entry.label}-${index}`} cursor={entry.drillIn ? 'pointer' : 'default'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
}
