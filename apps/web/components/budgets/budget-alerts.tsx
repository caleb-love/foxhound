import type { BudgetStatus } from '@/lib/budget-utils';
import { AlertTriangle, DollarSign, X } from 'lucide-react';
import { useState } from 'react';

interface BudgetAlertsProps {
  budgetStatuses: BudgetStatus[];
}

export function BudgetAlerts({ budgetStatuses }: BudgetAlertsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  
  const alerts = budgetStatuses.filter(
    (s) => !dismissed.has(s.agentId) && (s.status === 'warning' || s.status === 'critical' || s.status === 'exceeded')
  );
  
  if (alerts.length === 0) return null;
  
  const handleDismiss = (agentId: string) => {
    setDismissed(prev => new Set([...prev, agentId]));
  };
  
  const criticalAlerts = alerts.filter(s => s.status === 'exceeded');
  const warningAlerts = alerts.filter(s => s.status === 'critical' || s.status === 'warning');

  return (
    <div className="space-y-3">
      {/* Critical Alerts */}
      {criticalAlerts.map((alert) => (
        <div
          key={alert.agentId}
          className="rounded-lg border-2 p-4"
          style={{ borderColor: 'color-mix(in srgb, var(--tenant-danger) 25%, white)', background: 'color-mix(in srgb, var(--tenant-danger) 10%, white)' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full p-2" style={{ background: 'color-mix(in srgb, var(--tenant-danger) 14%, white)' }}>
                <AlertTriangle className="h-5 w-5" style={{ color: 'var(--tenant-danger)' }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--tenant-danger)' }}>
                  🚨 Budget Exceeded: {alert.agentId}
                </h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--tenant-danger)' }}>
                  Over budget by <span className="font-medium">${Math.abs(alert.remaining).toFixed(2)}</span>
                  {' '}({alert.percentage.toFixed(1)}% of ${alert.budget.toFixed(2)} limit)
                </p>
                <p className="mt-2 text-xs" style={{ color: 'var(--tenant-danger)' }}>
                  <strong>Action required:</strong> Review usage and increase budget or pause agent
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDismiss(alert.agentId)}
              className="transition-colors"
              style={{ color: 'var(--tenant-danger)' }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ))}
      
      {/* Warning Alerts */}
      {warningAlerts.map((alert) => (
        <div
          key={alert.agentId}
          className="rounded-lg border-2 p-4"
          style={{ borderColor: alert.status === 'critical' ? 'color-mix(in srgb, var(--tenant-warning) 32%, white)' : 'color-mix(in srgb, var(--tenant-warning) 24%, white)', background: 'color-mix(in srgb, var(--tenant-warning) 10%, white)' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full p-2" style={{ background: 'color-mix(in srgb, var(--tenant-warning) 14%, white)' }}>
                <DollarSign className="h-5 w-5" style={{ color: 'var(--tenant-warning)' }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--tenant-warning)' }}>
                  {alert.status === 'critical' ? '🔶 Near Budget Limit' : '⚠️ Approaching Budget Limit'}: {alert.agentId}
                </h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--tenant-warning)' }}>
                  Used <span className="font-medium">${alert.spent.toFixed(2)}</span> of ${alert.budget.toFixed(2)}
                  {' '}({alert.percentage.toFixed(1)}%)
                </p>
                {alert.projectedMonthEnd > alert.budget && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--tenant-warning)' }}>
                    Projected month-end: ${alert.projectedMonthEnd.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => handleDismiss(alert.agentId)}
              className="transition-colors"
              style={{ color: 'var(--tenant-warning)' }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
