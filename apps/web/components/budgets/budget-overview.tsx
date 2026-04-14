import { DollarSign, TrendingUp, Shield, AlertTriangle } from 'lucide-react';

interface BudgetOverviewProps {
  totalBudget: number;
  totalSpent: number;
  budgetCount: number;
  alertCount: number;
}

export function BudgetOverview({
  totalBudget,
  totalSpent,
  budgetCount,
  alertCount,
}: BudgetOverviewProps) {
  const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const remaining = totalBudget - totalSpent;
  
  const getProgressColor = () => {
    if (percentage >= 100) return 'var(--tenant-danger)';
    if (percentage >= 90) return 'color-mix(in srgb, var(--tenant-danger) 60%, var(--tenant-warning))';
    if (percentage >= 80) return 'var(--tenant-warning)';
    return 'var(--tenant-success)';
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Budget */}
      <div className="rounded-lg border p-6" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
        <div className="flex items-center gap-3">
          <div className="rounded-full p-3" style={{ background: 'var(--tenant-accent-soft)' }}>
            <DollarSign className="h-6 w-6" style={{ color: 'var(--tenant-accent)' }} />
          </div>
          <div>
            <p className="text-sm" style={{ color: 'var(--tenant-text-muted)' }}>Total Budget</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--tenant-text-primary)' }}>${totalBudget.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-4 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
          {budgetCount} agent{budgetCount !== 1 ? 's' : ''} configured
        </div>
      </div>
      
      {/* Total Spent */}
      <div className="rounded-lg border p-6" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
        <div className="flex items-center gap-3">
          <div className="rounded-full p-3" style={{ background: 'var(--tenant-accent-soft)' }}>
            <TrendingUp className="h-6 w-6" style={{ color: 'var(--tenant-accent)' }} />
          </div>
          <div>
            <p className="text-sm" style={{ color: 'var(--tenant-text-muted)' }}>Spent This Month</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--tenant-text-primary)' }}>${totalSpent.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span style={{ color: 'var(--tenant-text-muted)' }}>{percentage.toFixed(1)}% of budget</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--tenant-panel-alt)' }}>
            <div
              className="h-full transition-all"
              style={{ width: `${Math.min(percentage, 100)}%`, background: getProgressColor() }}
            />
          </div>
        </div>
      </div>
      
      {/* Remaining */}
      <div className="rounded-lg border p-6" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
        <div className="flex items-center gap-3">
          <div className="rounded-full p-3" style={{ background: 'color-mix(in srgb, var(--tenant-success) 14%, white)' }}>
            <Shield className="h-6 w-6" style={{ color: 'var(--tenant-success)' }} />
          </div>
          <div>
            <p className="text-sm" style={{ color: 'var(--tenant-text-muted)' }}>Remaining</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--tenant-text-primary)' }}>
              ${remaining >= 0 ? remaining.toFixed(2) : '0.00'}
            </p>
          </div>
        </div>
        <div className="mt-4 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
          {remaining >= 0
            ? 'Within budget'
            : `Over by $${Math.abs(remaining).toFixed(2)}`}
        </div>
      </div>
      
      {/* Alerts */}
      <div className="rounded-lg border p-6" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
        <div className="flex items-center gap-3">
          <div className="rounded-full p-3" style={{ background: alertCount > 0 ? 'color-mix(in srgb, var(--tenant-danger) 14%, white)' : 'var(--tenant-panel-alt)' }}>
            <AlertTriangle className="h-6 w-6" style={{ color: alertCount > 0 ? 'var(--tenant-danger)' : 'var(--tenant-text-muted)' }} />
          </div>
          <div>
            <p className="text-sm" style={{ color: 'var(--tenant-text-muted)' }}>Active Alerts</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--tenant-text-primary)' }}>{alertCount}</p>
          </div>
        </div>
        <div className="mt-4 text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
          {alertCount === 0
            ? 'All agents on track'
            : `${alertCount} agent${alertCount !== 1 ? 's' : ''} need attention`}
        </div>
      </div>
    </div>
  );
}
