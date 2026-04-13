import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    ? 'text-gray-600'
    : isImprovement
    ? 'text-green-600'
    : 'text-red-600';
  
  const bgClass = isNeutral
    ? 'bg-gray-50'
    : isImprovement
    ? 'bg-green-50'
    : 'bg-red-50';

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-sm font-medium text-gray-700 mb-3">{label}</div>
      
      <div className="space-y-2">
        {/* Values */}
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-gray-500">Trace A:</span>
          <span className="font-mono font-medium">{formatValue(valueA)}</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-gray-500">Trace B:</span>
          <span className="font-mono font-medium">{formatValue(valueB)}</span>
        </div>
        
        {/* Delta */}
        <div className={cn('mt-3 rounded-lg p-3', bgClass)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={colorClass}>{icon}</div>
              <span className={cn('text-sm font-semibold', colorClass)}>
                {formatDelta(delta)}
              </span>
            </div>
            {percentage !== undefined && !isNaN(percentage) && Math.abs(percentage) > 0.1 && (
              <span className={cn('text-sm font-medium', colorClass)}>
                {percentage > 0 ? '+' : ''}{percentage.toFixed(1)}%
              </span>
            )}
          </div>
          {!isNeutral && (
            <div className="mt-1 text-xs text-gray-600">
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
