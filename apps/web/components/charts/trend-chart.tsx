import { ChartPanel } from './chart-shell';
import type { TrendSeries } from './chart-types';

function maxValue(series: TrendSeries[]): number {
  return Math.max(1, ...series.flatMap((entry) => entry.values.map((point) => point.value)));
}

function toneClasses(tone: TrendSeries['tone']) {
  if (tone === 'healthy') return 'bg-emerald-400/80';
  if (tone === 'warning') return 'bg-amber-400/80';
  if (tone === 'critical') return 'bg-rose-400/80';
  return 'bg-sky-400/80';
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
  const peak = maxValue(series);

  return (
    <ChartPanel title={title} description={description}>
      <div className="space-y-4">
        {series.map((entry) => (
          <div key={entry.id} className="space-y-2 rounded-2xl border p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium" style={{ color: 'var(--tenant-text-primary)' }}>
                {entry.label}
              </div>
              <div className="text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
                Latest: {entry.values.at(-1)?.value ?? 0}
              </div>
            </div>
            <div className="flex items-end gap-2" aria-label={`${entry.label} trend`}>
              {entry.values.map((point) => (
                <div key={`${entry.id}-${point.label}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div
                    className={`w-full rounded-t-md ${toneClasses(entry.tone)}`}
                    style={{ height: `${Math.max(12, (point.value / peak) * 120)}px` }}
                    title={`${point.label}: ${point.value}`}
                  />
                  <div className="text-[11px]" style={{ color: 'var(--tenant-text-muted)' }}>
                    {point.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ChartPanel>
  );
}
