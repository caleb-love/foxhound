import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tenantStyles } from '@/components/demo/dashboard-primitives';

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
    ? 'var(--tenant-panel-alt)'
    : isImprovement
    ? 'color-mix(in srgb, var(--tenant-success) 10%, white)'
    : 'color-mix(in srgb, var(--tenant-danger) 10%, white)';

  return (
    <div className="p-4" style={tenantStyles.panel}>
      <div className="mb-3 text-sm font-medium" style={{ color: 'var(--tenant-text-secondary)' }}>{label}</div>
      
      <div className="space-y-2">
        {/* Values */}
        <div className="flex items-baseline justify-between text-sm">
          <span style={{ color: 'var(--tenant-text-muted)' }}>Trace A:</span>
          <span className="font-mono font-medium">{formatValue(valueA)}</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span style={{ color: 'var(--tenant-text-muted)' }}>Trace B:</span>
          <span className="font-mono font-medium">{formatValue(valueB)}</span>
        </div>
        
        {/* Delta */}
        <div className={cn('mt-3 rounded-lg p-3')} style={{ background: bgColor }}>
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
