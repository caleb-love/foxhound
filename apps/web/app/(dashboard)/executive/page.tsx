import { ExecutiveSummaryV2 } from '@/components/overview/executive-summary-v2';
import type { FleetMetrics } from '@/lib/verdict-engine';
import { buildExecutiveMetricCards } from '@/lib/executive-metrics';
import { buildExecutiveDecisions, buildExecutiveTalkingPoints } from '@/lib/overview-narrative';

const fleetMetrics: FleetMetrics = {
  healthPercent: 92,
  previousHealthPercent: 97,
  criticalRegressions: 2,
  slaRisks: 4,
  budgetOverspendUsd: 182,
  previousBudgetOverspendUsd: 90,
};

const metricCards = buildExecutiveMetricCards(fleetMetrics, 1);

const decisions = buildExecutiveDecisions(fleetMetrics, {
  experiments: '/experiments',
  regressions: '/regressions',
  budgets: '/budgets',
});

const talkingPoints = buildExecutiveTalkingPoints(
  fleetMetrics,
  'Connected operator surfaces now cover overview, investigate, improve, and govern workflows.',
);

export default function ExecutivePage() {
  return (
    <ExecutiveSummaryV2
      fleetMetrics={fleetMetrics}
      metricCards={metricCards}
      decisions={decisions}
      talkingPoints={talkingPoints}
      fleetOverviewHref="/"
      periodLabel="Week of Apr 14, 2026"
    />
  );
}
