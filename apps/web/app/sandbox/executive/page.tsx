import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { ExecutiveSummaryV2 } from '@/components/overview/executive-summary-v2';
import { buildExecutiveMetricCards } from '@/lib/executive-metrics';
import { buildExecutiveDecisions, buildExecutiveTalkingPoints } from '@/lib/overview-narrative';
import { buildSandboxFleetMetrics } from '@/lib/demo-derived-metrics';

export default function SandboxExecutivePage() {
  const demo = buildLocalReviewDemo();

  const fleetMetrics = buildSandboxFleetMetrics(demo);

  const readyToShipCount = demo.experiments.filter((e) => Boolean(e.winningCandidate)).length;
  const metricCards = buildExecutiveMetricCards(
    fleetMetrics,
    readyToShipCount,
    Math.max(0, readyToShipCount - 1),
  );

  const decisions = buildExecutiveDecisions(
    fleetMetrics,
    {
      experiments: '/sandbox/experiments',
      regressions: '/sandbox/regressions',
      budgets: '/sandbox/budgets',
    },
    {
      promotionDecision: {
        title: 'Promote support-reply v19 to production?',
        status: 'watch',
        evidence: 'Refund recovery experiment complete. Latency improved, cost steady. Evaluator scores: 94% pass.',
        recommendation: 'Promote with cost monitoring for 48h',
        href: '/sandbox/experiments',
        cta: 'Review experiment',
      },
      reliabilityDecision: {
        title: 'Contain refund-policy-agent overspend',
        status: 'attention',
        evidence: 'Budget at 127% of limit. Root cause: v18 regression doubled policy-check calls. v19 fix in staging.',
        recommendation: 'Hold traffic increase until v19 lands',
        href: '/sandbox/budgets',
        cta: 'Review budgets',
      },
      budgetDecision: {
        title: 'Platform alert routing for critical incidents',
        status: 'on-track',
        evidence: 'Notifications wired to #returns-watch and #platform-ops. One warning route included for realism.',
        recommendation: 'No action required',
        href: '/sandbox/notifications',
        cta: 'View notifications',
      },
    },
  );

  const evidenceHighlights = [
    `${demo.replayTargetTraceIds.length} replay-ready incidents are already wired into the seeded investigation flow.`,
    `${demo.experiments.filter((experiment) => Boolean(experiment.winningCandidate)).length} promotion candidate${demo.experiments.filter((experiment) => Boolean(experiment.winningCandidate)).length !== 1 ? 's are' : ' is'} visible in the current experiment set.`,
    `${demo.notifications.filter((channel) => channel.status !== 'healthy').length} notification route${demo.notifications.filter((channel) => channel.status !== 'healthy').length !== 1 ? 's are' : ' is'} degraded in the same weekly operating story.`,
  ];

  const talkingPoints = buildExecutiveTalkingPoints(
    fleetMetrics,
    `Demo trace corpus includes ${demo.allTraces.length} traces with curated anchors plus realistic background activity across a full week.`,
    evidenceHighlights,
  );

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
