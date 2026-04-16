import type { Span, Trace } from '@foxhound/types';
import { AlertCircle, ArrowRight, CheckCircle2, Info, Lightbulb } from 'lucide-react';

interface InsightsPanelProps {
  costDelta: number;
  costPercentage: number;
  durationDelta: number;
  durationPercentage: number;
  spanDiff: {
    added: Span[];
    removed: Span[];
    modified: Span[];
    unchanged: Span[];
  };
  traceA?: Trace;
  traceB?: Trace;
}

interface Insight {
  severity: 'critical' | 'warning' | 'success' | 'info';
  finding: string;
  action: string;
}

function generateInsights(
  costDelta: number,
  costPercentage: number,
  durationDelta: number,
  durationPercentage: number,
  spanDiff: InsightsPanelProps['spanDiff'],
  traceA?: Trace,
  traceB?: Trace,
): Insight[] {
  const insights: Insight[] = [];

  // Overall assessment first
  const errorsA = traceA?.spans.filter((s) => s.status === 'error').length ?? 0;
  const errorsB = traceB?.spans.filter((s) => s.status === 'error').length ?? 0;
  const newErrors = errorsB - errorsA;

  if (newErrors > 0) {
    const errorSpans = traceB?.spans.filter((s) => s.status === 'error') ?? [];
    const firstError = errorSpans[0];
    insights.push({
      severity: 'critical',
      finding: `${newErrors} new error${newErrors > 1 ? 's' : ''} introduced${firstError ? ` (first: ${firstError.name})` : ''}.`,
      action: firstError
        ? `Investigate the ${firstError.name} span. Check whether a prompt change or input schema change caused the failure.`
        : 'Open the comparison trace to inspect the error spans.',
    });
  }

  if (costDelta > 0 && durationDelta > 0) {
    insights.push({
      severity: 'warning',
      finding: `Both cost (+${costPercentage.toFixed(0)}%) and latency (+${durationPercentage.toFixed(0)}%) regressed.`,
      action: 'Identify the most expensive new or modified span and check whether it can use a cheaper model or fewer tokens.',
    });
  } else if (costDelta < 0 && durationDelta < 0) {
    insights.push({
      severity: 'success',
      finding: `Cost down ${Math.abs(costPercentage).toFixed(0)}% and latency down ${Math.abs(durationPercentage).toFixed(0)}%.`,
      action: 'Validate this improvement with an eval dataset before promoting to production.',
    });
  }

  // Cost-specific
  if (Math.abs(costDelta) > 0.01) {
    if (costDelta > 0) {
      // Find the most expensive new or modified span in B
      const expensiveSpans = [...spanDiff.added, ...spanDiff.modified]
        .filter((s) => typeof s.attributes.cost === 'number')
        .sort((a, b) => ((b.attributes.cost as number) || 0) - ((a.attributes.cost as number) || 0));
      const top = expensiveSpans[0];

      insights.push({
        severity: 'warning',
        finding: `Cost increased by $${costDelta.toFixed(4)} (+${costPercentage.toFixed(0)}% per run).`,
        action: top
          ? `The ${top.name} span costs $${((top.attributes.cost as number) || 0).toFixed(4)}. Consider using a lighter model or reducing context window size.`
          : 'Review span-level cost breakdown to find the source of the increase.',
      });
    } else {
      insights.push({
        severity: 'success',
        finding: `Cost reduced by $${Math.abs(costDelta).toFixed(4)} (${Math.abs(costPercentage).toFixed(0)}% savings per run).`,
        action: 'Confirm quality was not sacrificed by running the comparison trace through your eval suite.',
      });
    }
  }

  // Duration-specific
  if (Math.abs(durationDelta) > 0.5) {
    if (durationDelta > 0) {
      insights.push({
        severity: 'warning',
        finding: `Latency increased by ${durationDelta.toFixed(2)}s (+${durationPercentage.toFixed(0)}%).`,
        action: 'Check for new sequential spans that could run in parallel, or models with higher latency.',
      });
    } else {
      insights.push({
        severity: 'success',
        finding: `Latency improved by ${Math.abs(durationDelta).toFixed(2)}s (${Math.abs(durationPercentage).toFixed(0)}% faster).`,
        action: 'Good improvement. Validate output quality is maintained at the faster speed.',
      });
    }
  }

  // Structural changes
  if (spanDiff.added.length > 0) {
    const names = spanDiff.added.slice(0, 3).map((s) => s.name).join(', ');
    const more = spanDiff.added.length > 3 ? ` and ${spanDiff.added.length - 3} more` : '';
    insights.push({
      severity: 'info',
      finding: `${spanDiff.added.length} new span${spanDiff.added.length > 1 ? 's' : ''}: ${names}${more}.`,
      action: 'Review whether these new steps are intentional additions or symptoms of a retry loop.',
    });
  }

  if (spanDiff.removed.length > 0) {
    const names = spanDiff.removed.slice(0, 3).map((s) => s.name).join(', ');
    insights.push({
      severity: 'info',
      finding: `${spanDiff.removed.length} span${spanDiff.removed.length > 1 ? 's' : ''} removed: ${names}.`,
      action: 'Verify the removed steps are no longer needed and not silently dropped by an error.',
    });
  }

  if (spanDiff.modified.length > 0) {
    insights.push({
      severity: 'info',
      finding: `${spanDiff.modified.length} span${spanDiff.modified.length > 1 ? 's' : ''} changed in duration or cost.`,
      action: 'Expand the waterfall diff to see which spans changed and by how much.',
    });
  }

  if (insights.length === 0) {
    insights.push({
      severity: 'info',
      finding: 'No significant differences detected.',
      action: 'The runs are functionally equivalent. Minor timing variations are within normal range.',
    });
  }

  return insights;
}

const SEVERITY_ICON: Record<string, typeof AlertCircle> = {
  critical: AlertCircle,
  warning: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

const SEVERITY_COLORS: Record<string, { accent: string; bg: string; border: string }> = {
  critical: {
    accent: 'var(--tenant-danger)',
    bg: 'color-mix(in srgb, var(--tenant-danger) 8%, var(--card))',
    border: 'color-mix(in srgb, var(--tenant-danger) 20%, var(--tenant-panel-stroke))',
  },
  warning: {
    accent: 'var(--tenant-warning)',
    bg: 'color-mix(in srgb, var(--tenant-warning) 8%, var(--card))',
    border: 'color-mix(in srgb, var(--tenant-warning) 20%, var(--tenant-panel-stroke))',
  },
  success: {
    accent: 'var(--tenant-success)',
    bg: 'color-mix(in srgb, var(--tenant-success) 8%, var(--card))',
    border: 'color-mix(in srgb, var(--tenant-success) 20%, var(--tenant-panel-stroke))',
  },
  info: {
    accent: 'var(--tenant-accent)',
    bg: 'color-mix(in srgb, var(--tenant-accent) 6%, var(--card))',
    border: 'color-mix(in srgb, var(--tenant-accent) 16%, var(--tenant-panel-stroke))',
  },
};

export function InsightsPanel({
  costDelta,
  costPercentage,
  durationDelta,
  durationPercentage,
  spanDiff,
  traceA,
  traceB,
}: InsightsPanelProps) {
  const insights = generateInsights(costDelta, costPercentage, durationDelta, durationPercentage, spanDiff, traceA, traceB);

  return (
    <div
      className="rounded-[var(--tenant-radius-panel)] border p-4"
      style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--card)' }}
    >
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-tenant-accent" />
        <h3 className="text-sm font-semibold text-tenant-text-primary">Insights and recommended actions</h3>
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.14em] text-tenant-text-muted">
          {insights.length} finding{insights.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {insights.map((insight, index) => {
          const Icon = SEVERITY_ICON[insight.severity] || Info;
          const colors = SEVERITY_COLORS[insight.severity] || SEVERITY_COLORS.info;

          return (
            <div
              key={index}
              className="rounded-[var(--tenant-radius-panel-tight)] border p-3"
              style={{ background: colors.bg, borderColor: colors.border }}
            >
              <div className="flex items-start gap-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: colors.accent }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-tenant-text-primary">{insight.finding}</p>
                  <div className="mt-1.5 flex items-start gap-1.5 text-[13px] text-tenant-text-secondary">
                    <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" style={{ color: colors.accent }} />
                    <span>{insight.action}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
