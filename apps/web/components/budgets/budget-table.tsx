import type { BudgetStatus } from '@/lib/budget-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
import { useBudgetStore } from '@/lib/stores/budget-store';
import { getStatusIcon, getStatusMessage, getStatusColorClass } from '@/lib/budget-utils';
import { cn } from '@/lib/utils';

interface BudgetTableProps {
  budgetStatuses: BudgetStatus[];
  onEdit: (agentId: string) => void;
}

export function BudgetTable({ budgetStatuses, onEdit }: BudgetTableProps) {
  const { removeBudget } = useBudgetStore();
  
  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'var(--tenant-danger)';
    if (percentage >= 90) return 'color-mix(in srgb, var(--tenant-danger) 60%, var(--tenant-warning))';
    if (percentage >= 80) return 'var(--tenant-warning)';
    return 'var(--tenant-success)';
  };
  
  if (budgetStatuses.length === 0) {
    return (
      <div className="rounded-lg border p-12 text-center" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
        <p className="text-lg font-medium" style={{ color: 'var(--tenant-text-primary)' }}>No budgets configured</p>
        <p className="mt-2 text-sm" style={{ color: 'var(--tenant-text-muted)' }}>
          Click &ldquo;Add Budget&rdquo; to set spending limits for your agents
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
      <div className="border-b px-6 py-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--tenant-text-primary)' }}>Agent Budgets</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>
          Monthly spending limits and current usage
        </p>
      </div>
      
      <div className="divide-y">
        {budgetStatuses.map((status) => (
          <div key={status.agentId} className="p-6 transition-colors" style={{ background: 'transparent' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-mono text-lg font-semibold">{status.agentId}</h3>
                  <Badge variant={status.status === 'exceeded' ? 'destructive' : 'secondary'}>
                    {status.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span style={{ color: 'var(--tenant-text-muted)' }}>Budget:</span>{' '}
                    <span className="font-medium">${status.budget.toFixed(2)}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--tenant-text-muted)' }}>Spent:</span>{' '}
                    <span className="font-medium">${status.spent.toFixed(2)}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--tenant-text-muted)' }}>Remaining:</span>{' '}
                    <span className="font-medium" style={{ color: status.remaining >= 0 ? 'var(--tenant-success)' : 'var(--tenant-danger)' }}>
                      ${status.remaining >= 0
                        ? status.remaining.toFixed(2)
                        : `(${Math.abs(status.remaining).toFixed(2)})`}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(status.agentId)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Remove budget for ${status.agentId}?`)) {
                      removeBudget(status.agentId);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span style={{ color: 'var(--tenant-text-secondary)' }}>
                  {status.percentage.toFixed(1)}% used
                </span>
                {status.projectedMonthEnd > status.budget && (
                  <span className="font-medium" style={{ color: 'var(--tenant-warning)' }}>
                    Projected: ${status.projectedMonthEnd.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: 'var(--tenant-panel-alt)' }}>
                <div
                  className="h-full transition-all"
                  style={{ width: `${Math.min(status.percentage, 100)}%`, background: getProgressColor(status.percentage) }}
                />
              </div>
            </div>
            
            {/* Status Message */}
            <div className={cn(
              'rounded-lg border px-3 py-2 flex items-center gap-2',
              getStatusColorClass(status.status)
            )}>
              <span className="text-lg">{getStatusIcon(status.status)}</span>
              <span className="text-sm font-medium">
                {getStatusMessage(status)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
