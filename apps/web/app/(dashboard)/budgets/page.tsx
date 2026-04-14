import { BudgetsGovernDashboard, type BudgetMetric, type BudgetRiskRecord } from '@/components/budgets/budgets-govern-dashboard';

const metrics: BudgetMetric[] = [
  {
    label: 'Tracked budgets',
    value: '6',
    supportingText: 'Active guardrails across the most important production agent workflows.',
  },
  {
    label: 'At-risk budgets',
    value: '2',
    supportingText: 'Two workflows are projected to exceed their current monthly limits.',
  },
  {
    label: 'Projected overspend',
    value: '$182',
    supportingText: 'Combined projected overrun if current trace volume continues unchanged.',
  },
  {
    label: 'Largest hotspot',
    value: 'planner-agent',
    supportingText: 'Planner spend increased after new rerank behavior and prompt changes.',
  },
];

const hotspots: BudgetRiskRecord[] = [
  {
    agent: 'planner-agent',
    status: 'critical',
    spend: '$418',
    budget: '$300',
    description: 'Token-heavy planning spans and new tool calls increased spend above the configured budget.',
    tracesHref: '/traces',
    regressionsHref: '/regressions',
    improveHref: '/experiments',
  },
  {
    agent: 'support-agent',
    status: 'warning',
    spend: '$191',
    budget: '$220',
    description: 'Recent prompt changes improved quality but also increased context size and marginal cost.',
    tracesHref: '/traces',
    regressionsHref: '/prompts?focus=support-routing',
    improveHref: '/evaluators',
  },
  {
    agent: 'onboarding-router',
    status: 'healthy',
    spend: '$98',
    budget: '$180',
    description: 'Spend is within range after the latest experiment, but continue watching if rerank behavior returns.',
    tracesHref: '/traces',
    regressionsHref: '/regressions',
    improveHref: '/datasets',
  },
];

const nextActions = [
  {
    title: 'Inspect the most expensive traces',
    description: 'Find the runs responsible for the latest budget spike and confirm whether the spend is intentional.',
    href: '/traces',
    cta: 'Open traces',
  },
  {
    title: 'Check whether regressions caused the overspend',
    description: 'Use regression analysis to confirm whether new behavior drift introduced extra cost.',
    href: '/regressions',
    cta: 'Open regressions',
  },
  {
    title: 'Open the improvement loop for cost-heavy agents',
    description: 'Use datasets, evaluators, and experiments to reduce cost without losing quality.',
    href: '/experiments',
    cta: 'Open experiments',
  },
];

export default function BudgetsPage() {
  return <BudgetsGovernDashboard metrics={metrics} hotspots={hotspots} nextActions={nextActions} />;
}
