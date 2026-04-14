import { ExperimentsDashboard, type ExperimentMetric, type ExperimentRecord } from '@/components/experiments/experiments-dashboard';

const metrics: ExperimentMetric[] = [
  {
    label: 'Active experiments',
    value: '3',
    supportingText: 'Candidate prompt and routing tests currently in flight or recently completed.',
  },
  {
    label: 'Ready to promote',
    value: '1',
    supportingText: 'One candidate has enough evaluator evidence to move forward.',
  },
  {
    label: 'Blocked by coverage',
    value: '1',
    supportingText: 'One experiment still needs stronger evaluator coverage before a decision.',
  },
  {
    label: 'Latest comparison',
    value: '12m ago',
    supportingText: 'Recent experiment results are fresh enough to support shipping decisions.',
  },
];

const experiments: ExperimentRecord[] = [
  {
    name: 'support-routing-v12-vs-v11',
    status: 'completed',
    dataset: 'support-latency-outliers',
    comparisonSummary: 'Version 12 reduced latency but slightly increased cost on long-context traces.',
    lastUpdated: '12 minutes ago',
    winningSignal: 'latency improved without quality regression',
    datasetHref: '/datasets',
    evaluatorsHref: '/evaluators',
    tracesHref: '/traces',
    promoteHref: '/prompts?focus=support-routing&baseline=11&comparison=12',
  },
  {
    name: 'onboarding-router-rerank-strategy',
    status: 'running',
    dataset: 'onboarding-regressions',
    comparisonSummary: 'Comparing a simplified routing prompt against the current rerank-heavy execution path.',
    lastUpdated: 'now',
    winningSignal: 'awaiting evaluator completion',
    datasetHref: '/datasets',
    evaluatorsHref: '/evaluators',
    tracesHref: '/regressions',
    promoteHref: '/prompts?focus=onboarding-router&baseline=11&comparison=12',
  },
  {
    name: 'planner-tool-order-baseline-check',
    status: 'warning',
    dataset: 'planner-behavior-drift',
    comparisonSummary: 'Initial run suggests behavior improvement, but evaluator coverage is not broad enough yet.',
    lastUpdated: 'today',
    winningSignal: 'expand dataset coverage before promotion',
    datasetHref: '/datasets',
    evaluatorsHref: '/evaluators',
    tracesHref: '/replay/trace_reg_1',
  },
];

const nextActions = [
  {
    title: 'Review experiment winners against evaluator evidence',
    description: 'Confirm the candidate with the best scores is also safe on real production traces.',
    href: '/evaluators',
    cta: 'Open evaluators',
  },
  {
    title: 'Inspect the source dataset before promotion',
    description: 'Make sure the experiment still reflects the real failures and low-scoring traces you are trying to fix.',
    href: '/datasets',
    cta: 'Open datasets',
  },
  {
    title: 'Re-check source traces before promotion',
    description: 'Validate that the experiment outcome matches the real production failures that inspired it.',
    href: '/traces',
    cta: 'Open traces',
  },
];

export default function ExperimentsPage() {
  return <ExperimentsDashboard metrics={metrics} experiments={experiments} nextActions={nextActions} />;
}
