import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tenantStyles } from '@/components/sandbox/primitives';

interface MetricsDeltaProps {
  label: string;
  valueA: number;
  valueB: number;
  delta: number;
  percentage?: number;
  format: 'currency' | 'duration' | 'number';
  lowerIsBetter?: boolean;
}

export function MetricsDelta({
  label,
  valueA,
  valueB,
  delta,
  percentage,
  format,
  lowerIsBetter = false,
}: MetricsDeltaProps) {
  const formatValue = (value: number) => {
    switch (format) {
      case 'currency':
        return `$${value.toFixed(4)}`;
      case 'duration':
        return `${value.toFixed(2)}s`;
      case 'number':
        return value.toString();
    }
  };
  
  const formatDelta = (value: number) => {
    const sign = value > 0 ? '+' : '';
    switch (format) {
      case 'currency':
        return `${sign}$${value.toFixed(4)}`;
      case 'duration':
        return `${sign}${value.toFixed(2)}s`;
      case 'number':
        return `${sign}${value}`;
    }
  };
  
  // Determine if this is an improvement
  const isImprovement = lowerIsBetter
    ? delta < 0  // Lower is better (errors, cost, duration)
    : delta > 0;  // Higher is better (rare)
  
  const isNeutral = Math.abs(delta) < 0.001;
  
  const icon = isNeutral ? (
    <Minus className="h-5 w-5" />
  ) : isImprovement ? (
    <TrendingDown className="h-5 w-5" />
  ) : (
    <TrendingUp className="h-5 w-5" />
  );
  
  const colorClass = isNeutral
    ? 'var(--tenant-text-secondary)'
    : isImprovement
    ? 'var(--tenant-success)'
    : 'var(--tenant-danger)';
  
  const bgColor = isNeutral
    ? 'color-mix(in srgb, var(--card) 88%, var(--background))'
    : isImprovement
    ? 'color-mix(in srgb, var(--tenant-success) 12%, var(--card))'
    : 'color-mix(in srgb, var(--tenant-danger) 12%, var(--card))';

  return (
    <div className="p-4 md:p-5" style={tenantStyles.panel}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--tenant-text-muted)' }}>{label}</div>
          <div className="mt-2 text-2xl font-semibold tracking-[-0.03em]" style={{ color: 'var(--tenant-text-primary)' }}>{formatValue(valueB)}</div>
        </div>
        <div className="rounded-[var(--tenant-radius-control-tight)] border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em]" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-secondary)' }}>
          B vs A
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-[var(--tenant-radius-panel-tight)] border p-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
            <div style={{ color: 'var(--tenant-text-muted)' }}>Baseline</div>
            <div className="mt-1 font-mono font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{formatValue(valueA)}</div>
          </div>
          <div className="rounded-[var(--tenant-radius-panel-tight)] border p-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}>
            <div style={{ color: 'var(--tenant-text-muted)' }}>Comparison</div>
            <div className="mt-1 font-mono font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{formatValue(valueB)}</div>
          </div>
        </div>
        
        <div className={cn('mt-1 rounded-[var(--tenant-radius-panel-tight)] p-3')} style={{ background: bgColor }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div style={{ color: colorClass }}>{icon}</div>
              <span className="text-sm font-semibold" style={{ color: colorClass }}>
                {formatDelta(delta)}
              </span>
            </div>
            {percentage !== undefined && !isNaN(percentage) && Math.abs(percentage) > 0.1 && (
              <span className="text-sm font-medium" style={{ color: colorClass }}>
                {percentage > 0 ? '+' : ''}{percentage.toFixed(1)}%
              </span>
            )}
          </div>
          {!isNeutral && (
            <div className="mt-1 text-xs" style={{ color: 'var(--tenant-text-secondary)' }}>
              {isImprovement ? (
                <span>✅ Improved</span>
              ) : (
                <span>⚠️ Regression</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
