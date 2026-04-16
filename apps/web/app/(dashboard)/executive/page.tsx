import {
  ExecutiveSummaryV2,
  type ExecMetricInput,
  type ExecDecisionInput,
  type ExecTalkingPoint,
} from '@/components/overview/executive-summary-v2';
import type { FleetMetrics } from '@/lib/verdict-engine';

const fleetMetrics: FleetMetrics = {
  healthPercent: 92,
  previousHealthPercent: 97,
  criticalRegressions: 2,
  slaRisks: 4,
  budgetOverspendUsd: 182,
  previousBudgetOverspendUsd: 90,
};

const metricCards: ExecMetricInput[] = [
  {
    label: 'Reliability',
    value: '92%',
    numericValue: 92,
    previousValue: 97,
    higherIsBetter: true,
    tone: 'healthy',
    sparklineData: [
      { value: 97 }, { value: 96 }, { value: 94 }, { value: 91 },
      { value: 89 }, { value: 90 }, { value: 92 },
    ],
  },
  {
    label: 'Cost position',
    value: '$182 over',
    numericValue: 182,
    previousValue: 90,
    higherIsBetter: false,
    tone: 'warning',
    sparklineData: [
      { value: 40 }, { value: 60 }, { value: 80 }, { value: 100 },
      { value: 130 }, { value: 160 }, { value: 182 },
    ],
  },
  {
    label: 'Risk items',
    value: '2 critical',
    numericValue: 2,
    previousValue: 0,
    higherIsBetter: false,
    tone: 'critical',
    sparklineData: [
      { value: 0 }, { value: 0 }, { value: 1 }, { value: 1 },
      { value: 2 }, { value: 2 }, { value: 2 },
    ],
  },
  {
    label: 'Ready to ship',
    value: '1',
    numericValue: 1,
    higherIsBetter: true,
    tone: 'healthy',
  },
];

const decisions: ExecDecisionInput[] = [
  {
    title: 'Promote support-routing v12 to production?',
    status: 'watch',
    evidence: 'Latency improved 15%, but cost rose 3%. Evaluator review pending.',
    recommendation: 'Promote with cost monitoring',
    href: '/experiments',
    cta: 'Review experiment',
  },
  {
    title: 'Planner-agent reliability drift',
    status: 'attention',
    evidence: 'Regression and SLA pages indicate the same high-priority reliability issue.',
    recommendation: 'Hold releases until resolved',
    href: '/regressions',
    cta: 'Review regressions',
  },
  {
    title: 'Budget protections before next release',
    status: 'on-track',
    evidence: 'Budget guardrails active. One hotspot should be reduced before traffic increases.',
    recommendation: 'No action required',
    href: '/budgets',
    cta: 'View budgets',
  },
];

const talkingPoints: ExecTalkingPoint[] = [
  { text: 'Support workflows improved on latency, but cost efficiency still needs validation.' },
  { text: 'Planner reliability remains the main risk to customer-facing stability.' },
  { text: 'Connected operator surfaces now cover overview, investigate, improve, and govern workflows.' },
];

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
