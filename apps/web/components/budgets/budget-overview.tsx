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
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 90) return 'bg-orange-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Budget */}
      <div className="rounded-lg border bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-indigo-100 p-3">
            <DollarSign className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Budget</p>
            <p className="text-2xl font-bold">${totalBudget.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-4 text-xs text-gray-500">
          {budgetCount} agent{budgetCount !== 1 ? 's' : ''} configured
        </div>
      </div>
      
      {/* Total Spent */}
      <div className="rounded-lg border bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-blue-100 p-3">
            <TrendingUp className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Spent This Month</p>
            <p className="text-2xl font-bold">${totalSpent.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">{percentage.toFixed(1)}% of budget</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full transition-all ${getProgressColor()}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Remaining */}
      <div className="rounded-lg border bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-green-100 p-3">
            <Shield className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Remaining</p>
            <p className="text-2xl font-bold">
              ${remaining >= 0 ? remaining.toFixed(2) : '0.00'}
            </p>
          </div>
        </div>
        <div className="mt-4 text-xs text-gray-500">
          {remaining >= 0
            ? 'Within budget'
            : `Over by $${Math.abs(remaining).toFixed(2)}`}
        </div>
      </div>
      
      {/* Alerts */}
      <div className="rounded-lg border bg-white p-6">
        <div className="flex items-center gap-3">
          <div className={`rounded-full p-3 ${alertCount > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
            <AlertTriangle className={`h-6 w-6 ${alertCount > 0 ? 'text-red-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Active Alerts</p>
            <p className="text-2xl font-bold">{alertCount}</p>
          </div>
        </div>
        <div className="mt-4 text-xs text-gray-500">
          {alertCount === 0
            ? 'All agents on track'
            : `${alertCount} agent${alertCount !== 1 ? 's' : ''} need attention`}
        </div>
      </div>
    </div>
  );
}
