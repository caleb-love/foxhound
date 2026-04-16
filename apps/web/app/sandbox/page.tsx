import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import {
  FleetOverviewV2,
  type FleetMetricInput,
  type FleetActionItem,
} from '@/components/overview/fleet-overview-v2';
import type { FleetMetrics } from '@/lib/verdict-engine';

export default function SandboxOverviewPage() {
  const demo = buildLocalReviewDemo();

  const criticalRegressions = demo.regressions.filter(
    (r) => r.severity === 'critical',
  ).length;
  const warningRegressions = demo.regressions.filter(
    (r) => r.severity === 'warning',
  ).length;
  const atRiskBudgets = demo.budgets.filter((b) => b.status !== 'healthy').length;
  const totalSpend = demo.budgets.reduce((sum, b) => sum + b.currentSpendUsd, 0);

  // Fleet metrics for the verdict engine
  const fleetMetrics: FleetMetrics = {
    healthPercent: 92,
    previousHealthPercent: 97,
    criticalRegressions,
    previousCriticalRegressions: 0,
    slaRisks: 4,
    previousSlaRisks: 3,
    budgetOverspendUsd: 182,
    previousBudgetOverspendUsd: 90,
  };

  // Metric strip cards with deltas and sparklines
  const metricCards: FleetMetricInput[] = [
    {
      label: 'Fleet health',
      value: '92%',
      numericValue: 92,
      previousValue: 97,
      higherIsBetter: true,
      tone: 'healthy',
      href: '/sandbox/traces',
      sparklineData: [
        { value: 97 }, { value: 96 }, { value: 94 }, { value: 91 },
        { value: 89 }, { value: 90 }, { value: 92 },
      ],
    },
    {
      label: 'Critical regressions',
      value: String(criticalRegressions),
      numericValue: criticalRegressions,
      previousValue: 0,
      higherIsBetter: false,
      tone: criticalRegressions > 0 ? 'critical' : 'healthy',
      href: '/sandbox/regressions',
      sparklineData: [
        { value: 0 }, { value: 0 }, { value: 1 }, { value: 1 },
        { value: 2 }, { value: 2 }, { value: criticalRegressions },
      ],
    },
    {
      label: 'SLA risk',
      value: '4',
      numericValue: 4,
      previousValue: 3,
      higherIsBetter: false,
      tone: 'warning',
      href: '/sandbox/slas',
      sparklineData: [
        { value: 2 }, { value: 2 }, { value: 3 }, { value: 3 },
        { value: 3 }, { value: 4 }, { value: 4 },
      ],
    },
    {
      label: 'Overspend',
      value: `$${182}`,
      numericValue: 182,
      previousValue: 90,
      higherIsBetter: false,
      tone: 'warning',
      href: '/sandbox/budgets',
      sparklineData: [
        { value: 40 }, { value: 60 }, { value: 80 }, { value: 100 },
        { value: 130 }, { value: 160 }, { value: 182 },
      ],
    },
  ];

  // Unified action queue (merging what was changeFeed + actionQueue + nextActions)
  const actionItems: FleetActionItem[] = [
    {
      title: 'Returns Resolution Copilot regression',
      context: 'v18 rollout broke damaged-shipment refund exceptions. Cheaper and faster, but incorrect policy decisions.',
      severity: 'critical',
      agentIds: ['support-agent'],
      actions: [
        { label: 'Trace', href: '/sandbox/traces/trace_returns_exception_v18_regression' },
        { label: 'Run Diff', href: '/sandbox/diff?a=trace_returns_exception_v17_baseline&b=trace_returns_exception_v18_regression' },
        { label: 'Replay', href: '/sandbox/replay/trace_returns_exception_v18_regression' },
        { label: 'Prompt', href: '/sandbox/prompts/prompt_support_reply' },
      ],
    },
    {
      title: 'Planner-agent SLA drift',
      context: 'Latency trending toward breach threshold. Recent traces show longer tool orchestration chains.',
      severity: 'warning',
      agentIds: ['planner-agent'],
      actions: [
        { label: 'Traces', href: '/sandbox/traces' },
        { label: 'SLAs', href: '/sandbox/slas' },
        { label: 'Budget', href: '/sandbox/budgets' },
      ],
    },
    {
      title: 'Shipping Delay Resolution cost and latency drift',
      context: 'Timeout recovery improved quality, but logistics workflow sits close to SLA and budget limits.',
      severity: 'warning',
      agentIds: ['onboarding-router'],
      actions: [
        { label: 'Traces', href: '/sandbox/traces' },
        { label: 'SLAs', href: '/sandbox/slas' },
      ],
    },
    {
      title: 'support-reply v19 recovery candidate ready',
      context: 'Experiment complete. Refund recovery validated with larger trace-derived dataset and clearer labels.',
      severity: 'healthy',
      agentIds: ['support-agent'],
      actions: [
        { label: 'Experiments', href: '/sandbox/experiments' },
        { label: 'Prompt', href: '/sandbox/prompts/prompt_support_reply' },
      ],
    },
    {
      title: 'Validate alert routing for critical incidents',
      context: 'Notification routing includes #returns-watch and #platform-ops channels.',
      severity: 'healthy',
      agentIds: ['support-agent', 'planner-agent'],
      actions: [
        { label: 'Notifications', href: '/sandbox/notifications' },
      ],
    },
  ];

  return (
    <FleetOverviewV2
      fleetMetrics={fleetMetrics}
      metricCards={metricCards}
      actionItems={actionItems}
      demoMode
    />
  );
}
