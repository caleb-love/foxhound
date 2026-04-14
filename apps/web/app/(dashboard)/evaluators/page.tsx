import { EvaluatorsDashboard, type EvaluatorMetric, type EvaluatorRecord } from '@/components/evaluators/evaluators-dashboard';

const metrics: EvaluatorMetric[] = [
  {
    label: 'Active evaluators',
    value: '5',
    supportingText: 'Templates currently used to score production traces and experiment outputs.',
  },
  {
    label: 'Coverage',
    value: '72%',
    supportingText: 'Most critical traces now receive at least one evaluation signal.',
  },
  {
    label: 'Recent failures',
    value: '1',
    supportingText: 'One evaluator needs attention after a prompt/schema mismatch.',
  },
  {
    label: 'Last batch',
    value: '9m ago',
    supportingText: 'Latest evaluator runs completed recently enough to guide shipping decisions.',
  },
];

const evaluators: EvaluatorRecord[] = [
  {
    name: 'helpfulness-judge',
    scoringType: 'numeric',
    model: 'gpt-4o-mini',
    lastRunStatus: 'healthy',
    adoptionSummary: 'Attached to onboarding and support datasets',
    lastRunSummary: 'Scored 84 traces with median 0.78',
    tracesHref: '/traces',
    datasetsHref: '/datasets',
    experimentsHref: '/experiments',
    compareHref: '/experiments',
  },
  {
    name: 'tool-routing-review',
    scoringType: 'categorical',
    model: 'claude-3-5-sonnet',
    lastRunStatus: 'warning',
    adoptionSummary: 'Used on routing regressions and replay-driven investigations',
    lastRunSummary: 'Flagged 6 traces for likely tool-selection drift',
    tracesHref: '/regressions',
    datasetsHref: '/datasets',
    experimentsHref: '/experiments',
    compareHref: '/experiments',
  },
  {
    name: 'support-resolution-confidence',
    scoringType: 'numeric',
    model: 'gpt-4o',
    lastRunStatus: 'critical',
    adoptionSummary: 'Critical support dataset coverage dropped after schema changes',
    lastRunSummary: 'Latest run failed on prompt output parsing',
    tracesHref: '/traces',
    datasetsHref: '/datasets',
    experimentsHref: '/experiments',
    compareHref: '/experiments',
  },
];

const nextActions = [
  {
    title: 'Review low-confidence scores',
    description: 'Inspect traces where evaluator output disagrees with the expected user outcome.',
    href: '/traces',
    cta: 'Open traces',
  },
  {
    title: 'Use datasets to expand evaluator coverage',
    description: 'Add more trace-derived cases before trusting a candidate prompt in production.',
    href: '/datasets',
    cta: 'Open datasets',
  },
  {
    title: 'Validate fixes in experiments',
    description: 'Run the current evaluator set against a new prompt or routing experiment before promotion.',
    href: '/experiments',
    cta: 'Open experiments',
  },
];

export default function EvaluatorsPage() {
  return <EvaluatorsDashboard metrics={metrics} evaluators={evaluators} nextActions={nextActions} />;
}
