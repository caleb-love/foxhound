import { FleetOverviewV2 } from '@/components/overview/fleet-overview-v2';
import type { FleetMetrics } from '@/lib/verdict-engine';
import { buildFleetMetricCards } from '@/lib/overview-metrics';
import { buildFleetActionItems } from '@/lib/overview-narrative';
import { isDashboardSandboxModeEnabled } from '@/lib/sandbox-auth';

const fleetMetrics: FleetMetrics = {
  healthPercent: 92,
  previousHealthPercent: 97,
  criticalRegressions: 2,
  previousCriticalRegressions: 0,
  slaRisks: 4,
  previousSlaRisks: 3,
  budgetOverspendUsd: 182,
  previousBudgetOverspendUsd: 90,
};

const metricCards = buildFleetMetricCards(fleetMetrics, {
  traces: '/traces',
  regressions: '/regressions',
  slas: '/slas',
  budgets: '/budgets',
});

const actionItems = buildFleetActionItems(fleetMetrics, {
  traces: '/traces',
  regressions: '/regressions',
  slas: '/slas',
  budgets: '/budgets',
  prompts: '/prompts',
  experiments: '/experiments',
});

export default function DashboardPage() {
  return (
    <FleetOverviewV2
      fleetMetrics={fleetMetrics}
      metricCards={metricCards}
      actionItems={actionItems}
      demoMode={isDashboardSandboxModeEnabled()}
    />
  );
}
