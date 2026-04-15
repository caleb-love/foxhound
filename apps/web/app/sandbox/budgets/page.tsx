import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { BudgetsGovernDashboard } from '@/components/budgets/budgets-govern-dashboard';

export default function SandboxBudgetsPage() {
  const demo = buildLocalReviewDemo();

  return (
    <BudgetsGovernDashboard
      metrics={[
        {
          label: 'Budget-configured agents',
          value: String(demo.budgets.length),
          supportingText: 'The week-long shared demo story includes the refund-policy-agent hotspot plus supporting budget pressure elsewhere.',
        },
        {
          label: 'Critical hotspots',
          value: String(demo.budgets.filter((item) => item.status === 'critical').length),
          supportingText: 'One agent is already beyond its monthly budget and needs intervention.',
        },
        {
          label: 'Tracked monthly budget',
          value: `$${demo.budgets.reduce((sum, item) => sum + item.budgetUsd, 0).toLocaleString()}`,
          supportingText: 'Budget context is intentionally tied to the same traces, regressions, and experiments as the hero story.',
        },
        {
          label: 'Current modeled spend',
          value: `$${demo.budgets.reduce((sum, item) => sum + item.currentSpendUsd, 0).toLocaleString()}`,
          supportingText: 'Modeled spend is concentrated in refund-related workflows, with secondary pressure from RAG recovery and escalation review during the week.',
        },
      ]}
      hotspots={demo.budgets.map((item) => ({
        agent: item.agentId,
        status: item.status,
        spend: `$${item.currentSpendUsd.toLocaleString()}`,
        budget: `$${item.budgetUsd.toLocaleString()} / month`,
        description: item.summary,
        tracesHref: '/sandbox/traces/trace_returns_exception_v18_regression',
        regressionsHref: '/sandbox/regressions',
        improveHref: '/sandbox/experiments',
      }))}
      nextActions={[
        {
          title: 'Inspect the expensive regression run',
          description: 'Open the refund regression trace and compare it against the baseline to see why cost and quality both worsened.',
          href: '/sandbox/diff?a=trace_returns_exception_v17_baseline&b=trace_returns_exception_v18_regression',
          cta: 'Open run diff',
        },
        {
          title: 'Validate the recovery candidate before promotion',
          description: 'Use the experiment and dataset loop to confirm the proposed fix improves quality without runaway spend.',
          href: '/sandbox/experiments',
          cta: 'Open experiments',
        },
      ]}
    />
  );
}
