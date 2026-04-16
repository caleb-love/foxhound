import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { FleetOverviewV2 } from '@/components/overview/fleet-overview-v2';
import { buildFleetMetricCards } from '@/lib/overview-metrics';
import { buildFleetActionItems } from '@/lib/overview-narrative';
import { buildSandboxFleetMetrics } from '@/lib/demo-derived-metrics';

export default function SandboxOverviewPage() {
  const demo = buildLocalReviewDemo();

  const fleetMetrics = buildSandboxFleetMetrics(demo);

  const metricCards = buildFleetMetricCards(fleetMetrics, {
    traces: '/sandbox/traces',
    regressions: '/sandbox/regressions',
    slas: '/sandbox/slas',
    budgets: '/sandbox/budgets',
  });

  const actionItems = buildFleetActionItems(
    fleetMetrics,
    {
      traces: '/sandbox/traces',
      regressions: '/sandbox/regressions',
      slas: '/sandbox/slas',
      budgets: '/sandbox/budgets',
      prompts: '/sandbox/prompts/prompt_support_reply',
      experiments: '/sandbox/experiments',
    },
    {
      regressionContext: 'The refund incident narrative is still the most important demo anchor. Start with the seeded regression path, then move into trace, diff, replay, and prompt evidence.',
      regressionActions: [
        { label: 'Regression', href: '/sandbox/regressions' },
        { label: 'Trace', href: '/sandbox/traces/trace_returns_exception_v18_regression' },
        { label: 'Run Diff', href: '/sandbox/diff?a=trace_returns_exception_v17_baseline&b=trace_returns_exception_v18_regression' },
        { label: 'Replay', href: '/sandbox/replay/trace_returns_exception_v18_regression' },
      ],
      slaContext: 'Seeded carrier and orchestration paths still show enough latency pressure to justify SLA review before calling the demo fleet stable.',
      slaActions: [
        { label: 'SLAs', href: '/sandbox/slas' },
        { label: 'Traces', href: '/sandbox/traces' },
      ],
      budgetContext: 'Refund-policy-agent overspend remains part of the seeded executive story, so cost review should stay tied to experiments and budgets together.',
      budgetActions: [
        { label: 'Budgets', href: '/sandbox/budgets' },
        { label: 'Experiments', href: '/sandbox/experiments' },
      ],
      promotionContext: 'The recovery candidate is ready for review with trace-derived experiment evidence and prompt history available from the same seeded scenario family.',
      promotionActions: [
        { label: 'Experiments', href: '/sandbox/experiments' },
        { label: 'Prompt', href: '/sandbox/prompts/prompt_support_reply' },
        { label: 'Notifications', href: '/sandbox/notifications' },
      ],
    },
  );

  return (
    <FleetOverviewV2
      fleetMetrics={fleetMetrics}
      metricCards={metricCards}
      actionItems={actionItems}
      demoMode
    />
  );
}
