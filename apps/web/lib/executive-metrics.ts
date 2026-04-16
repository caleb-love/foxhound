import type { ExecMetricInput } from '@/components/overview/executive-summary-v2';
import type { FleetMetrics } from '@/lib/verdict-engine';

function interpolateSeries(previous: number, current: number, points = 7) {
  if (points <= 1) {
    return [{ value: current }];
  }

  return Array.from({ length: points }, (_, index) => {
    const ratio = index / (points - 1);
    const value = previous + (current - previous) * ratio;
    return { value: Number(value.toFixed(2)) };
  });
}

export function buildExecutiveMetricCards(
  metrics: FleetMetrics,
  readyToShipCount: number,
  previousReadyToShipCount?: number,
): ExecMetricInput[] {
  const activeRiskItems = metrics.criticalRegressions + metrics.slaRisks;
  const previousRiskItems = (metrics.previousCriticalRegressions ?? metrics.criticalRegressions)
    + (metrics.previousSlaRisks ?? metrics.slaRisks);

  return [
    {
      label: 'Reliability',
      value: `${metrics.healthPercent}%`,
      numericValue: metrics.healthPercent,
      previousValue: metrics.previousHealthPercent,
      higherIsBetter: true,
      tone: metrics.healthPercent >= 90 ? 'healthy' : metrics.healthPercent >= 75 ? 'warning' : 'critical',
      sparklineData: interpolateSeries(
        metrics.previousHealthPercent ?? metrics.healthPercent,
        metrics.healthPercent,
      ),
    },
    {
      label: 'Cost position',
      value: metrics.budgetOverspendUsd > 0 ? `$${metrics.budgetOverspendUsd} over` : 'On budget',
      numericValue: metrics.budgetOverspendUsd,
      previousValue: metrics.previousBudgetOverspendUsd,
      higherIsBetter: false,
      tone: metrics.budgetOverspendUsd > 500 ? 'critical' : metrics.budgetOverspendUsd > 0 ? 'warning' : 'healthy',
      sparklineData: interpolateSeries(
        metrics.previousBudgetOverspendUsd ?? metrics.budgetOverspendUsd,
        metrics.budgetOverspendUsd,
      ),
    },
    {
      label: 'Risk items',
      value: `${activeRiskItems} active`,
      numericValue: activeRiskItems,
      previousValue: previousRiskItems,
      higherIsBetter: false,
      tone: metrics.criticalRegressions > 0 ? 'critical' : activeRiskItems > 0 ? 'warning' : 'healthy',
      sparklineData: interpolateSeries(previousRiskItems, activeRiskItems),
    },
    {
      label: 'Ready to ship',
      value: String(readyToShipCount),
      numericValue: readyToShipCount,
      previousValue: previousReadyToShipCount,
      higherIsBetter: true,
      tone: readyToShipCount > 0 ? 'healthy' : 'warning',
      sparklineData: interpolateSeries(previousReadyToShipCount ?? readyToShipCount, readyToShipCount),
    },
  ];
}
