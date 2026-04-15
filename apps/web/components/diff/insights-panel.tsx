import type { Span } from '@foxhound/types';
import { Lightbulb, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { tenantStyles } from '@/components/sandbox/primitives';

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
}

export function InsightsPanel({
  costDelta,
  costPercentage,
  durationDelta,
  durationPercentage,
  spanDiff,
}: InsightsPanelProps) {
  const insights: Array<{
    type: 'success' | 'warning' | 'info';
    message: string;
  }> = [];
  
  // Cost insights
  if (Math.abs(costDelta) > 0.01) {
    if (costDelta < 0) {
      insights.push({
        type: 'success',
        message: `Cost reduced by ${Math.abs(costPercentage).toFixed(1)}% (saving $${Math.abs(costDelta).toFixed(4)} per trace)`,
      });
    } else {
      insights.push({
        type: 'warning',
        message: `Cost increased by ${costPercentage.toFixed(1)}% (+$${costDelta.toFixed(4)} per trace)`,
      });
    }
  }
  
  // Duration insights
  if (Math.abs(durationDelta) > 1) {
    if (durationDelta < 0) {
      insights.push({
        type: 'success',
        message: `Latency improved by ${Math.abs(durationPercentage).toFixed(1)}% (${Math.abs(durationDelta).toFixed(2)}s faster)`,
      });
    } else {
      insights.push({
        type: 'warning',
        message: `Latency regressed by ${durationPercentage.toFixed(1)}% (+${durationDelta.toFixed(2)}s slower)`,
      });
    }
  }
  
  // Span insights
  if (spanDiff.removed.length > 0) {
    insights.push({
      type: 'success',
      message: `Removed ${spanDiff.removed.length} span${spanDiff.removed.length > 1 ? 's' : ''}: ${spanDiff.removed.map(s => s.name).join(', ')}`,
    });
  }
  
  if (spanDiff.added.length > 0) {
    insights.push({
      type: 'info',
      message: `Added ${spanDiff.added.length} span${spanDiff.added.length > 1 ? 's' : ''}: ${spanDiff.added.map(s => s.name).join(', ')}`,
    });
  }
  
  if (spanDiff.modified.length > 0) {
    insights.push({
      type: 'info',
      message: `Modified ${spanDiff.modified.length} span${spanDiff.modified.length > 1 ? 's' : ''} (duration or cost changed)`,
    });
  }
  
  // Overall assessment
  if (costDelta < 0 && durationDelta < 0) {
    insights.unshift({
      type: 'success',
      message: '🎉 Both cost and latency improved!',
    });
  } else if (costDelta > 0 && durationDelta > 0) {
    insights.unshift({
      type: 'warning',
      message: '⚠️ Both cost and latency regressed',
    });
  }
  
  if (insights.length === 0) {
    insights.push({
      type: 'info',
      message: 'No significant differences detected between traces',
    });
  }
  
  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--tenant-success)' }} />;
      case 'warning':
        return <AlertCircle className="h-5 w-5" style={{ color: 'var(--tenant-warning)' }} />;
      case 'info':
      default:
        return <Info className="h-5 w-5" style={{ color: 'var(--tenant-accent)' }} />;
    }
  };
  
  return (
    <div className="p-6" style={tenantStyles.panel}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" style={{ color: 'var(--tenant-accent)' }} />
          <h3 className="text-lg font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>Insights</h3>
        </div>
        <div className="rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--card) 88%, var(--background))', color: 'var(--tenant-text-secondary)' }}>
          Comparison summary
        </div>
      </div>
      
      <div className="space-y-3">
        {insights.map((insight, index) => (
          <div
            key={index}
            className="flex items-start gap-3 rounded-[var(--tenant-radius-panel-tight)] border p-3.5"
            style={{
              background: insight.type === 'success'
                ? 'color-mix(in srgb, var(--tenant-success) 12%, var(--card))'
                : insight.type === 'warning'
                  ? 'color-mix(in srgb, var(--tenant-warning) 12%, var(--card))'
                  : 'color-mix(in srgb, var(--tenant-accent) 12%, var(--card))',
              borderColor: insight.type === 'success'
                ? 'color-mix(in srgb, var(--tenant-success) 28%, var(--tenant-panel-stroke))'
                : insight.type === 'warning'
                  ? 'color-mix(in srgb, var(--tenant-warning) 28%, var(--tenant-panel-stroke))'
                  : 'color-mix(in srgb, var(--tenant-accent) 28%, var(--tenant-panel-stroke))',
            }}
          >
            <div className="mt-0.5">{getIcon(insight.type)}</div>
            <p className="text-sm" style={{ color: 'var(--tenant-text-primary)' }}>{insight.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
