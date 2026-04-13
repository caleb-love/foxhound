import type { Span } from '@foxhound/types';
import { Lightbulb, CheckCircle2, AlertCircle, Info } from 'lucide-react';

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
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };
  
  const getBgClass = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-5 w-5 text-indigo-600" />
        <h3 className="text-lg font-semibold">Insights</h3>
      </div>
      
      <div className="space-y-3">
        {insights.map((insight, index) => (
          <div
            key={index}
            className={`flex items-start gap-3 rounded-lg border p-3 ${getBgClass(insight.type)}`}
          >
            <div className="mt-0.5">{getIcon(insight.type)}</div>
            <p className="text-sm text-gray-800">{insight.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
