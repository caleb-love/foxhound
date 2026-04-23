import type { SparkPoint } from "@/components/charts/chart-types";
import type { FleetMetricInput } from "@/components/overview/fleet-overview-v2";
import type { FleetMetrics } from "@/lib/verdict-engine";

function clamp(value: number, minimum = 0) {
  return Number.isFinite(value) ? Math.max(minimum, value) : minimum;
}

function interpolateSeries(previous: number, current: number, points = 7): SparkPoint[] {
  if (points <= 1) {
    return [{ value: current }];
  }

  return Array.from({ length: points }, (_, index) => {
    const ratio = index / (points - 1);
    const value = previous + (current - previous) * ratio;
    return { value: Number(value.toFixed(2)) };
  });
}

export function buildFleetMetricCards(
  metrics: FleetMetrics,
  hrefs: {
    traces: string;
    regressions: string;
    slas: string;
    budgets: string;
  },
): FleetMetricInput[] {
  return [
    {
      label: "Fleet health",
      value: `${metrics.healthPercent}%`,
      numericValue: metrics.healthPercent,
      previousValue: metrics.previousHealthPercent,
      higherIsBetter: true,
      tone:
        metrics.healthPercent >= 90
          ? "healthy"
          : metrics.healthPercent >= 75
            ? "warning"
            : "critical",
      href: hrefs.traces,
      sparklineData: interpolateSeries(
        metrics.previousHealthPercent ?? metrics.healthPercent,
        metrics.healthPercent,
      ),
    },
    {
      label: "Critical regressions",
      value: String(metrics.criticalRegressions),
      numericValue: metrics.criticalRegressions,
      previousValue: metrics.previousCriticalRegressions,
      higherIsBetter: false,
      tone: metrics.criticalRegressions > 0 ? "critical" : "healthy",
      href: hrefs.regressions,
      sparklineData: interpolateSeries(
        metrics.previousCriticalRegressions ?? metrics.criticalRegressions,
        metrics.criticalRegressions,
      ),
    },
    {
      label: "SLA risk",
      value: String(metrics.slaRisks),
      numericValue: metrics.slaRisks,
      previousValue: metrics.previousSlaRisks,
      higherIsBetter: false,
      tone: metrics.slaRisks > 2 ? "critical" : metrics.slaRisks > 0 ? "warning" : "healthy",
      href: hrefs.slas,
      sparklineData: interpolateSeries(
        metrics.previousSlaRisks ?? metrics.slaRisks,
        metrics.slaRisks,
      ),
    },
    {
      label: "Overspend",
      value: `$${metrics.budgetOverspendUsd}`,
      numericValue: metrics.budgetOverspendUsd,
      previousValue: metrics.previousBudgetOverspendUsd,
      higherIsBetter: false,
      tone:
        metrics.budgetOverspendUsd > 500
          ? "critical"
          : metrics.budgetOverspendUsd > 0
            ? "warning"
            : "healthy",
      href: hrefs.budgets,
      sparklineData: interpolateSeries(
        clamp(metrics.previousBudgetOverspendUsd ?? metrics.budgetOverspendUsd),
        clamp(metrics.budgetOverspendUsd),
      ),
    },
  ];
}
