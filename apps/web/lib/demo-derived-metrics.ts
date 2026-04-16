import type { LocalReviewDemo } from '@foxhound/demo-domain';
import type { FleetMetrics } from '@/lib/verdict-engine';

function countTraceErrors(demo: LocalReviewDemo) {
  return demo.allTraces.filter((trace) => trace.spans.some((span) => span.status === 'error')).length;
}

export function buildSandboxFleetMetrics(demo: LocalReviewDemo): FleetMetrics {
  const traceCount = demo.allTraces.length;
  const errorTraceCount = countTraceErrors(demo);
  const healthyTraceCount = Math.max(0, traceCount - errorTraceCount);
  const healthPercent = traceCount > 0 ? Math.round((healthyTraceCount / traceCount) * 100) : 100;
  const criticalRegressions = demo.regressions.filter((item) => item.severity === 'critical').length;
  const previousCriticalRegressions = Math.max(0, criticalRegressions - 1);
  const slaRisks = demo.slas.filter((item) => item.status !== 'healthy').length;
  const previousSlaRisks = Math.max(0, slaRisks - 1);
  const atRiskBudgets = demo.budgets.filter((item) => item.status !== 'healthy');
  const budgetOverspendUsd = Math.round(
    atRiskBudgets.reduce(
      (sum, item) => sum + Math.max(0, item.currentSpendUsd - item.budgetUsd),
      0,
    ),
  );
  const previousBudgetOverspendUsd = Math.max(0, Math.round(budgetOverspendUsd * 0.75));
  const previousHealthPercent = Math.min(100, healthPercent + Math.max(1, criticalRegressions));

  return {
    healthPercent,
    previousHealthPercent,
    criticalRegressions,
    previousCriticalRegressions,
    slaRisks,
    previousSlaRisks,
    budgetOverspendUsd,
    previousBudgetOverspendUsd,
  };
}
