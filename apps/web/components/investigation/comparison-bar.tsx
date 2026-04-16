'use client';

import { cn } from '@/lib/utils';

type FormatType = 'currency' | 'duration' | 'number' | 'percentage';

interface ComparisonBarProps {
  label: string;
  valueA: number;
  valueB: number;
  format: FormatType;
  /** When true, a lower B value is "good" (e.g. cost, errors, latency). Default: true. */
  lowerIsBetter?: boolean;
  className?: string;
}

function formatValue(value: number, format: FormatType): string {
  switch (format) {
    case 'currency': return `$${value.toFixed(4)}`;
    case 'duration': return `${value.toFixed(2)}s`;
    case 'percentage': return `${value.toFixed(1)}%`;
    case 'number': return String(Math.round(value));
  }
}

function formatDelta(delta: number, format: FormatType): string {
  const sign = delta > 0 ? '+' : '';
  switch (format) {
    case 'currency': return `${sign}$${delta.toFixed(4)}`;
    case 'duration': return `${sign}${delta.toFixed(2)}s`;
    case 'percentage': return `${sign}${delta.toFixed(1)}%`;
    case 'number': return `${sign}${Math.round(delta)}`;
  }
}

export function ComparisonBar({
  label,
  valueA,
  valueB,
  format,
  lowerIsBetter = true,
  className,
}: ComparisonBarProps) {
  const delta = valueB - valueA;
  const percentage = valueA > 0 ? ((delta / valueA) * 100) : 0;
  const maxVal = Math.max(valueA, valueB, 0.0001);
  const widthA = (valueA / maxVal) * 100;
  const widthB = (valueB / maxVal) * 100;

  const isImprovement = lowerIsBetter ? delta < 0 : delta > 0;
  const isNeutral = Math.abs(delta) < 0.001;

  const deltaColor = isNeutral
    ? 'var(--tenant-text-muted)'
    : isImprovement
      ? 'var(--tenant-success)'
      : 'var(--tenant-danger)';

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {!isNeutral && Math.abs(percentage) > 0.5 ? (
            <span className="text-xs font-semibold" style={{ color: deltaColor }}>
              {percentage > 0 ? '+' : ''}{percentage.toFixed(0)}%
            </span>
          ) : null}
          <span className="text-xs font-medium" style={{ color: deltaColor }}>
            {isNeutral ? 'No change' : formatDelta(delta, format)}
          </span>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-[10px] font-semibold text-tenant-text-muted">A</span>
          <div className="relative h-5 flex-1 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--tenant-panel-stroke) 32%, transparent)' }}>
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(widthA, 2)}%`,
                background: 'color-mix(in srgb, var(--tenant-accent) 56%, var(--card))',
              }}
            />
          </div>
          <span className="w-20 shrink-0 text-right font-mono text-xs font-medium text-tenant-text-primary">
            {formatValue(valueA, format)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-[10px] font-semibold text-tenant-text-muted">B</span>
          <div className="relative h-5 flex-1 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--tenant-panel-stroke) 32%, transparent)' }}>
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(widthB, 2)}%`,
                background: isNeutral
                  ? 'color-mix(in srgb, var(--tenant-accent) 56%, var(--card))'
                  : isImprovement
                    ? 'color-mix(in srgb, var(--tenant-success) 64%, var(--card))'
                    : 'color-mix(in srgb, var(--tenant-danger) 64%, var(--card))',
              }}
            />
          </div>
          <span className="w-20 shrink-0 text-right font-mono text-xs font-medium text-tenant-text-primary">
            {formatValue(valueB, format)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* Compact metrics strip for Trace Detail */
interface MetricChipProps {
  label: string;
  value: string;
  accent?: 'default' | 'danger' | 'success' | 'warning';
}

export function MetricChip({ label, value, accent = 'default' }: MetricChipProps) {
  const accentColors: Record<string, string> = {
    default: 'var(--tenant-text-primary)',
    danger: 'var(--tenant-danger)',
    success: 'var(--tenant-success)',
    warning: 'var(--tenant-warning)',
  };

  return (
    <div
      className="flex items-center gap-2 rounded-[var(--tenant-radius-control-tight)] border px-3 py-2"
      style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))' }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">
        {label}
      </span>
      <span className="font-mono text-sm font-semibold" style={{ color: accentColors[accent] }}>
        {value}
      </span>
    </div>
  );
}

export function MetricStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  );
}
