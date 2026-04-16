import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import {
  ExecutiveSummaryV2,
  type ExecMetricInput,
  type ExecDecisionInput,
  type ExecTalkingPoint,
} from '@/components/overview/executive-summary-v2';
import type { FleetMetrics } from '@/lib/verdict-engine';

export default function SandboxExecutivePage() {
  const demo = buildLocalReviewDemo();

  const criticalRegressions = demo.regressions.filter(
    (r) => r.severity === 'critical',
  ).length;

  const fleetMetrics: FleetMetrics = {
    healthPercent: 96,
    previousHealthPercent: 98,
    criticalRegressions,
    slaRisks: 2,
    budgetOverspendUsd: 10700,
    previousBudgetOverspendUsd: 8200,
  };

  const metricCards: ExecMetricInput[] = [
    {
      label: 'Reliability',
      value: '96.1%',
      numericValue: 96,
      previousValue: 98,
      higherIsBetter: true,
      tone: 'healthy',
      sparklineData: [
        { value: 98 }, { value: 97 }, { value: 96 }, { value: 95 },
        { value: 95 }, { value: 96 }, { value: 96 },
      ],
    },
    {
      label: 'Cost position',
      value: '$10.7k at risk',
      numericValue: 10700,
      previousValue: 8200,
      higherIsBetter: false,
      tone: 'warning',
      sparklineData: [
        { value: 6000 }, { value: 7200 }, { value: 8200 }, { value: 9100 },
        { value: 9800 }, { value: 10400 }, { value: 10700 },
      ],
    },
    {
      label: 'Risk items',
      value: `${criticalRegressions + 2} active`,
      numericValue: criticalRegressions + 2,
      previousValue: 1,
      higherIsBetter: false,
      tone: criticalRegressions > 0 ? 'critical' : 'warning',
      sparklineData: [
        { value: 1 }, { value: 1 }, { value: 2 }, { value: 3 },
        { value: 3 }, { value: 4 }, { value: criticalRegressions + 2 },
      ],
    },
    {
      label: 'Ready to ship',
      value: String(demo.experiments.filter((e) => Boolean(e.winningCandidate)).length),
      numericValue: demo.experiments.filter((e) => Boolean(e.winningCandidate)).length,
      higherIsBetter: true,
      tone: 'healthy',
    },
  ];

  const decisions: ExecDecisionInput[] = [
    {
      title: 'Promote support-reply v19 to production?',
      status: 'watch',
      evidence: 'Refund recovery experiment complete. Latency improved, cost steady. Evaluator scores: 94% pass.',
      recommendation: 'Promote with cost monitoring for 48h',
      href: '/sandbox/experiments',
      cta: 'Review experiment',
    },
    {
      title: 'Contain refund-policy-agent overspend',
      status: 'attention',
      evidence: 'Budget at 127% of limit. Root cause: v18 regression doubled policy-check calls. v19 fix in staging.',
      recommendation: 'Hold traffic increase until v19 lands',
      href: '/sandbox/budgets',
      cta: 'Review budgets',
    },
    {
      title: 'Platform alert routing for critical incidents',
      status: 'on-track',
      evidence: 'Notifications wired to #returns-watch and #platform-ops. One warning route included for realism.',
      recommendation: 'No action required',
      href: '/sandbox/notifications',
      cta: 'View notifications',
    },
  ];

  const talkingPoints: ExecTalkingPoint[] = [
    {
      text: 'Refund regressions detected mid-week, traced to prompt and policy changes, validated through trace-derived experiments.',
    },
    {
      text: 'The shared demo covers investigation, improvement, and governance surfaces from one reusable scenario source.',
    },
    {
      text: `Demo trace corpus includes ${demo.allTraces.length} traces with curated anchors plus realistic background activity across a full week.`,
    },
  ];

  return (
    <ExecutiveSummaryV2
      fleetMetrics={fleetMetrics}
      metricCards={metricCards}
      decisions={decisions}
      talkingPoints={talkingPoints}
      fleetOverviewHref="/sandbox"
      periodLabel="Week of Apr 14, 2026"
      generatedAt={`Generated ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`}
    />
  );
}
