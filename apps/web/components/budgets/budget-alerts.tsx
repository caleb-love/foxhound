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
          className="rounded-lg border-2 border-red-200 bg-red-50 p-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-red-900">
                  🚨 Budget Exceeded: {alert.agentId}
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  Over budget by <span className="font-medium">${Math.abs(alert.remaining).toFixed(2)}</span>
                  {' '}({alert.percentage.toFixed(1)}% of ${alert.budget.toFixed(2)} limit)
                </p>
                <p className="mt-2 text-xs text-red-600">
                  <strong>Action required:</strong> Review usage and increase budget or pause agent
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDismiss(alert.agentId)}
              className="text-red-600 hover:text-red-800 transition-colors"
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
          className={`rounded-lg border-2 p-4 ${
            alert.status === 'critical'
              ? 'border-orange-200 bg-orange-50'
              : 'border-yellow-200 bg-yellow-50'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={`rounded-full p-2 ${
                alert.status === 'critical' ? 'bg-orange-100' : 'bg-yellow-100'
              }`}>
                <DollarSign className={`h-5 w-5 ${
                  alert.status === 'critical' ? 'text-orange-600' : 'text-yellow-600'
                }`} />
              </div>
              <div>
                <h3 className={`font-semibold ${
                  alert.status === 'critical' ? 'text-orange-900' : 'text-yellow-900'
                }`}>
                  {alert.status === 'critical' ? '🔶 Near Budget Limit' : '⚠️ Approaching Budget Limit'}: {alert.agentId}
                </h3>
                <p className={`mt-1 text-sm ${
                  alert.status === 'critical' ? 'text-orange-700' : 'text-yellow-700'
                }`}>
                  Used <span className="font-medium">${alert.spent.toFixed(2)}</span> of ${alert.budget.toFixed(2)}
                  {' '}({alert.percentage.toFixed(1)}%)
                </p>
                {alert.projectedMonthEnd > alert.budget && (
                  <p className={`mt-1 text-xs ${
                    alert.status === 'critical' ? 'text-orange-600' : 'text-yellow-600'
                  }`}>
                    Projected month-end: ${alert.projectedMonthEnd.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => handleDismiss(alert.agentId)}
              className={`transition-colors ${
                alert.status === 'critical'
                  ? 'text-orange-600 hover:text-orange-800'
                  : 'text-yellow-600 hover:text-yellow-800'
              }`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
