import type { Trace } from '@foxhound/types';
import type { Budget } from './stores/budget-store';

export interface BudgetStatus {
  agentId: string;
  budget: number;
  spent: number;
  percentage: number;
  remaining: number;
  status: 'ok' | 'warning' | 'critical' | 'exceeded';
  projectedMonthEnd: number;
}

/**
 * Calculate total cost for an agent this month
 */
export function calculateAgentMonthlyCost(
  agentId: string,
  traces: Trace[]
): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  return traces
    .filter(
      (trace) =>
        trace.agentId === agentId &&
        new Date(trace.startTimeMs) >= monthStart
    )
    .reduce((total, trace) => {
      return (
        total +
        trace.spans.reduce((sum, span) => {
          return sum + ((span.attributes.cost as number) || 0);
        }, 0)
      );
    }, 0);
}

/**
 * Calculate budget status for an agent
 */
export function getBudgetStatus(
  agentId: string,
  budget: Budget,
  traces: Trace[]
): BudgetStatus {
  const spent = calculateAgentMonthlyCost(agentId, traces);
  const percentage = budget.monthlyLimit > 0
    ? (spent / budget.monthlyLimit) * 100
    : 0;
  const remaining = budget.monthlyLimit - spent;
  
  // Determine status
  let status: BudgetStatus['status'] = 'ok';
  if (percentage >= budget.alertThresholds.exceeded) {
    status = 'exceeded';
  } else if (percentage >= budget.alertThresholds.critical) {
    status = 'critical';
  } else if (percentage >= budget.alertThresholds.warning) {
    status = 'warning';
  }
  
  // Project month-end spending
  const now = new Date();
  const daysElapsed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyAverage = spent / daysElapsed;
  const projectedMonthEnd = dailyAverage * daysInMonth;
  
  return {
    agentId,
    budget: budget.monthlyLimit,
    spent,
    percentage,
    remaining,
    status,
    projectedMonthEnd,
  };
}

/**
 * Get all budget statuses
 */
export function getAllBudgetStatuses(
  budgets: Budget[],
  traces: Trace[]
): BudgetStatus[] {
  return budgets
    .filter((b) => b.enabled)
    .map((budget) => getBudgetStatus(budget.agentId, budget, traces));
}

/**
 * Get total monthly spending across all agents
 */
export function getTotalMonthlySpending(traces: Trace[]): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  return traces
    .filter((trace) => new Date(trace.startTimeMs) >= monthStart)
    .reduce((total, trace) => {
      return (
        total +
        trace.spans.reduce((sum, span) => {
          return sum + ((span.attributes.cost as number) || 0);
        }, 0)
      );
    }, 0);
}

/**
 * Get unique agent IDs from traces
 */
export function getUniqueAgents(traces: Trace[]): string[] {
  return Array.from(new Set(traces.map((t) => t.agentId))).sort();
}

/**
 * Get status color class
 */
export function getStatusColorClass(status: BudgetStatus['status']): string {
  switch (status) {
    case 'ok':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'warning':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'critical':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'exceeded':
      return 'text-red-600 bg-red-50 border-red-200';
  }
}

/**
 * Get status icon
 */
export function getStatusIcon(status: BudgetStatus['status']): string {
  switch (status) {
    case 'ok':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'critical':
      return '🔶';
    case 'exceeded':
      return '🚨';
  }
}

/**
 * Get status message
 */
export function getStatusMessage(budgetStatus: BudgetStatus): string {
  const { status, percentage, remaining } = budgetStatus;
  
  switch (status) {
    case 'ok':
      return `On track (${percentage.toFixed(1)}% used, $${remaining.toFixed(2)} remaining)`;
    case 'warning':
      return `Approaching limit (${percentage.toFixed(1)}% used)`;
    case 'critical':
      return `Near budget limit (${percentage.toFixed(1)}% used)`;
    case 'exceeded':
      return `Over budget by $${Math.abs(remaining).toFixed(2)}!`;
  }
}
