import { ChartPanel, ChartRecord } from './chart-shell';
import type { ChartStatusTone } from './chart-types';

export interface DiffMetricItem {
  label: string;
  baseline: string;
  comparison: string;
  delta: string;
  tone?: ChartStatusTone;
}

export function DiffScorecard({
  title,
  description,
  metrics,
}: {
  title: string;
  description: string;
  metrics: DiffMetricItem[];
}) {
  return (
    <ChartPanel title={title} description={description}>
      <div className="grid gap-4 md:grid-cols-2">
        {metrics.map((metric) => (
          <ChartRecord
            key={metric.label}
            title={metric.label}
            status={metric.tone}
            description={
              <div className="grid gap-3 text-sm md:grid-cols-3" style={{ color: 'var(--tenant-text-secondary)' }}>
                <div className="rounded-[var(--tenant-radius-panel-tight)] border p-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--tenant-text-muted)' }}>Baseline</div>
                  <div className="mt-1" style={{ color: 'var(--tenant-text-primary)' }}>{metric.baseline}</div>
                </div>
                <div className="rounded-[var(--tenant-radius-panel-tight)] border p-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--tenant-text-muted)' }}>Current</div>
                  <div className="mt-1" style={{ color: 'var(--tenant-text-primary)' }}>{metric.comparison}</div>
                </div>
                <div className="rounded-[var(--tenant-radius-panel-tight)] border p-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)' }}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--tenant-text-muted)' }}>Delta</div>
                  <div className="mt-1" style={{ color: 'var(--tenant-text-primary)' }}>{metric.delta}</div>
                </div>
              </div>
            }
          />
        ))}
      </div>
    </ChartPanel>
  );
}
