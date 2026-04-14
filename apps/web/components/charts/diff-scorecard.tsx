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
              <div className="grid gap-2 text-sm md:grid-cols-3" style={{ color: 'var(--tenant-text-secondary)' }}>
                <div>
                  <div className="text-xs" style={{ color: 'var(--tenant-text-muted)' }}>Baseline</div>
                  <div>{metric.baseline}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: 'var(--tenant-text-muted)' }}>Current</div>
                  <div>{metric.comparison}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: 'var(--tenant-text-muted)' }}>Delta</div>
                  <div>{metric.delta}</div>
                </div>
              </div>
            }
          />
        ))}
      </div>
    </ChartPanel>
  );
}
