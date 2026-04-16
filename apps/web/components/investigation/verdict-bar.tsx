'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type VerdictSeverity = 'critical' | 'warning' | 'success' | 'info' | 'neutral';

interface VerdictBarProps {
  severity: VerdictSeverity;
  headline: string;
  summary: string;
  actions?: ReactNode;
  className?: string;
}

const SEVERITY_CONFIG: Record<VerdictSeverity, {
  icon: typeof AlertTriangle;
  accentVar: string;
  bgMix: string;
  borderMix: string;
  label: string;
}> = {
  critical: {
    icon: AlertTriangle,
    accentVar: 'var(--tenant-danger)',
    bgMix: 'color-mix(in srgb, var(--tenant-danger) 8%, var(--card))',
    borderMix: 'color-mix(in srgb, var(--tenant-danger) 24%, var(--tenant-panel-stroke))',
    label: 'Error detected',
  },
  warning: {
    icon: TrendingUp,
    accentVar: 'var(--tenant-warning)',
    bgMix: 'color-mix(in srgb, var(--tenant-warning) 8%, var(--card))',
    borderMix: 'color-mix(in srgb, var(--tenant-warning) 24%, var(--tenant-panel-stroke))',
    label: 'Regression',
  },
  success: {
    icon: CheckCircle2,
    accentVar: 'var(--tenant-success)',
    bgMix: 'color-mix(in srgb, var(--tenant-success) 8%, var(--card))',
    borderMix: 'color-mix(in srgb, var(--tenant-success) 24%, var(--tenant-panel-stroke))',
    label: 'Healthy',
  },
  info: {
    icon: Info,
    accentVar: 'var(--tenant-accent)',
    bgMix: 'color-mix(in srgb, var(--tenant-accent) 8%, var(--card))',
    borderMix: 'color-mix(in srgb, var(--tenant-accent) 24%, var(--tenant-panel-stroke))',
    label: 'Info',
  },
  neutral: {
    icon: TrendingDown,
    accentVar: 'var(--tenant-text-secondary)',
    bgMix: 'color-mix(in srgb, var(--card) 88%, var(--background))',
    borderMix: 'var(--tenant-panel-stroke)',
    label: 'No significant change',
  },
};

export function VerdictBar({ severity, headline, summary, actions, className }: VerdictBarProps) {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;

  return (
    <div
      className={cn('rounded-[var(--tenant-radius-panel)] border p-4 sm:p-5', className)}
      style={{ background: config.bgMix, borderColor: config.borderMix }}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: `color-mix(in srgb, ${config.accentVar} 16%, transparent)` }}
        >
          <Icon className="h-4 w-4" style={{ color: config.accentVar }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: config.accentVar }}
            >
              {config.label}
            </span>
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-tenant-text-primary sm:text-xl">
            {headline}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-tenant-text-secondary">
            {summary}
          </p>
          {actions ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------- Verdict generation helpers ---------- */

export function generateTraceVerdict(trace: {
  spans: Array<{ status: string; name: string; kind: string; startTimeMs: number; endTimeMs?: number; attributes: Record<string, unknown> }>;
  startTimeMs: number;
  endTimeMs?: number;
}): { severity: VerdictSeverity; headline: string; summary: string } {
  const errorSpans = trace.spans.filter((s) => s.status === 'error');
  const totalDuration = trace.endTimeMs ? ((trace.endTimeMs - trace.startTimeMs) / 1000).toFixed(2) : 'in progress';
  const totalCost = trace.spans.reduce((sum, s) => {
    const cost = s.attributes.cost;
    return sum + (typeof cost === 'number' ? cost : 0);
  }, 0);
  const llmCalls = trace.spans.filter((s) => s.kind === 'llm_call').length;

  if (errorSpans.length > 0) {
    const firstError = errorSpans[0];
    const errorIndex = trace.spans.indexOf(firstError) + 1;
    return {
      severity: 'critical',
      headline: `${firstError.name} failed at step ${errorIndex}/${trace.spans.length}`,
      summary: `${errorSpans.length} error${errorSpans.length > 1 ? 's' : ''} across ${trace.spans.length} spans. Total duration: ${totalDuration}s. Cost: $${totalCost.toFixed(4)} across ${llmCalls} LLM call${llmCalls !== 1 ? 's' : ''}.`,
    };
  }

  return {
    severity: 'success',
    headline: `All ${trace.spans.length} steps completed successfully`,
    summary: `Healthy execution in ${totalDuration}s. Cost: $${totalCost.toFixed(4)} across ${llmCalls} LLM call${llmCalls !== 1 ? 's' : ''}.`,
  };
}

export function generateDiffVerdict(metrics: {
  costDelta: number;
  costPercentage: number;
  durationDelta: number;
  durationPercentage: number;
  errorDelta: number;
  addedSpans: number;
  removedSpans: number;
  modifiedSpans: number;
}): { severity: VerdictSeverity; headline: string; summary: string } {
  const parts: string[] = [];

  if (metrics.errorDelta > 0) {
    parts.push(`${metrics.errorDelta} new error${metrics.errorDelta > 1 ? 's' : ''}`);
  }
  if (Math.abs(metrics.costPercentage) > 10) {
    parts.push(`cost ${metrics.costDelta > 0 ? 'up' : 'down'} ${Math.abs(metrics.costPercentage).toFixed(0)}%`);
  }
  if (Math.abs(metrics.durationPercentage) > 10) {
    parts.push(`latency ${metrics.durationDelta > 0 ? 'up' : 'down'} ${Math.abs(metrics.durationPercentage).toFixed(0)}%`);
  }

  if (metrics.errorDelta > 0) {
    return {
      severity: 'critical',
      headline: 'Regression detected',
      summary: `The comparison run introduced ${parts.join(', ')}. ${metrics.addedSpans > 0 ? `${metrics.addedSpans} new span${metrics.addedSpans > 1 ? 's' : ''} added.` : ''} ${metrics.modifiedSpans > 0 ? `${metrics.modifiedSpans} span${metrics.modifiedSpans > 1 ? 's' : ''} modified.` : ''}`.trim(),
    };
  }

  if (metrics.costDelta > 0 && metrics.durationDelta > 0) {
    return {
      severity: 'warning',
      headline: 'Performance regression',
      summary: `Both cost and latency increased: ${parts.join(', ')}. Review span-level changes to identify the root cause.`,
    };
  }

  if (metrics.costDelta < 0 && metrics.durationDelta < 0) {
    return {
      severity: 'success',
      headline: 'Improvement confirmed',
      summary: `The comparison run is faster and cheaper: ${parts.join(', ')}. Validate with an eval before promoting.`,
    };
  }

  if (parts.length === 0) {
    return {
      severity: 'neutral',
      headline: 'No significant differences',
      summary: 'The two runs are functionally equivalent. Minor variations in timing are within normal range.',
    };
  }

  return {
    severity: 'info',
    headline: 'Mixed results',
    summary: `Trade-offs detected: ${parts.join(', ')}. Review the span-level diff to determine the net impact.`,
  };
}
