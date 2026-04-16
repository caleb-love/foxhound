'use client';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

export interface VersionMetrics {
  traceCount: number;
  errorRate: number;
  avgCostUsd: number;
  avgDurationMs: number;
}

export interface VersionImpact {
  fromVersion: number;
  toVersion: number;
  before: VersionMetrics;
  after: VersionMetrics;
}

interface VersionImpactStripProps {
  impact: VersionImpact | null;
}

interface DeltaDisplay {
  label: string;
  before: string;
  after: string;
  deltaLabel: string;
  isRegression: boolean;
  direction: 'up' | 'down' | 'flat';
}

function computeDeltas(impact: VersionImpact): DeltaDisplay[] {
  const deltas: DeltaDisplay[] = [];

  // Error rate
  const errorDiff = impact.after.errorRate - impact.before.errorRate;
  const errorPp = (errorDiff * 100).toFixed(1);
  deltas.push({
    label: 'Error rate',
    before: `${(impact.before.errorRate * 100).toFixed(1)}%`,
    after: `${(impact.after.errorRate * 100).toFixed(1)}%`,
    deltaLabel: errorDiff === 0 ? 'No change' : `${errorDiff > 0 ? '+' : ''}${errorPp}pp`,
    isRegression: errorDiff > 0.001,
    direction: errorDiff > 0.001 ? 'up' : errorDiff < -0.001 ? 'down' : 'flat',
  });

  // Cost
  const costDiff = impact.after.avgCostUsd - impact.before.avgCostUsd;
  const costPct = impact.before.avgCostUsd > 0
    ? ((costDiff / impact.before.avgCostUsd) * 100).toFixed(0)
    : '0';
  deltas.push({
    label: 'Avg cost',
    before: `$${impact.before.avgCostUsd.toFixed(4)}`,
    after: `$${impact.after.avgCostUsd.toFixed(4)}`,
    deltaLabel: Math.abs(costDiff) < 0.0001 ? 'No change' : `${costDiff > 0 ? '+' : ''}${costPct}%`,
    isRegression: costDiff > 0.0001,
    direction: costDiff > 0.0001 ? 'up' : costDiff < -0.0001 ? 'down' : 'flat',
  });

  // Latency
  const latDiff = impact.after.avgDurationMs - impact.before.avgDurationMs;
  const latPct = impact.before.avgDurationMs > 0
    ? ((latDiff / impact.before.avgDurationMs) * 100).toFixed(0)
    : '0';
  deltas.push({
    label: 'Avg latency',
    before: `${(impact.before.avgDurationMs / 1000).toFixed(2)}s`,
    after: `${(impact.after.avgDurationMs / 1000).toFixed(2)}s`,
    deltaLabel: Math.abs(latDiff) < 50 ? 'No change' : `${latDiff > 0 ? '+' : ''}${latPct}%`,
    isRegression: latDiff > 50,
    direction: latDiff > 50 ? 'up' : latDiff < -50 ? 'down' : 'flat',
  });

  // Trace volume
  const volDiff = impact.after.traceCount - impact.before.traceCount;
  deltas.push({
    label: 'Traces',
    before: impact.before.traceCount.toLocaleString(),
    after: impact.after.traceCount.toLocaleString(),
    deltaLabel: volDiff === 0 ? 'Same' : `${volDiff > 0 ? '+' : ''}${volDiff}`,
    isRegression: false,
    direction: volDiff > 0 ? 'up' : volDiff < 0 ? 'down' : 'flat',
  });

  return deltas;
}

function DeltaBadge({ delta }: { delta: DeltaDisplay }) {
  const Icon = delta.direction === 'up' ? ArrowUp : delta.direction === 'down' ? ArrowDown : Minus;
  const color = delta.isRegression
    ? 'var(--tenant-danger)'
    : delta.direction === 'flat'
      ? 'var(--tenant-text-muted)'
      : 'var(--tenant-success)';

  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <Icon className="h-2.5 w-2.5" />
      {delta.deltaLabel}
    </span>
  );
}

export function VersionImpactStrip({ impact }: VersionImpactStripProps) {
  if (!impact) return null;

  const deltas = computeDeltas(impact);
  const hasRegression = deltas.some((d) => d.isRegression);
  const hasImprovement = deltas.some((d) => d.direction === 'down' && !d.isRegression);

  return (
    <div
      role="region"
      aria-label={`Performance impact from version ${impact.fromVersion} to ${impact.toVersion}${hasRegression ? ': regression detected' : hasImprovement ? ': improvement detected' : ''}`}
      className="rounded-[var(--tenant-radius-panel-tight)] border p-3"
      style={{
        borderColor: hasRegression
          ? 'color-mix(in srgb, var(--tenant-danger) 20%, var(--tenant-panel-stroke))'
          : hasImprovement
            ? 'color-mix(in srgb, var(--tenant-success) 16%, var(--tenant-panel-stroke))'
            : 'var(--tenant-panel-stroke)',
        background: hasRegression
          ? 'color-mix(in srgb, var(--tenant-danger) 3%, var(--card))'
          : hasImprovement
            ? 'color-mix(in srgb, var(--tenant-success) 3%, var(--card))'
            : 'color-mix(in srgb, var(--card) 88%, var(--background))',
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">
          Impact: v{impact.fromVersion} → v{impact.toVersion}
        </span>
        {hasRegression ? (
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
            style={{ background: 'color-mix(in srgb, var(--tenant-danger) 14%, transparent)', color: 'var(--tenant-danger)' }}
          >
            Regression
          </span>
        ) : hasImprovement ? (
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
            style={{ background: 'color-mix(in srgb, var(--tenant-success) 14%, transparent)', color: 'var(--tenant-success)' }}
          >
            Improved
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-4">
        {deltas.map((delta) => (
          <div key={delta.label} className="min-w-0">
            <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">
              {delta.label}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-tenant-text-secondary">{delta.before}</span>
              <span className="text-[9px] text-tenant-text-muted">→</span>
              <span className="font-mono text-[11px] text-tenant-text-primary">{delta.after}</span>
              <DeltaBadge delta={delta} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
