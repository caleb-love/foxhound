import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { EvaluatorsDashboard } from '@/components/evaluators/evaluators-dashboard';

export default function DemoEvaluatorsPage() {
  const demo = buildLocalReviewDemo();

  return (
    <EvaluatorsDashboard
      metrics={[
        {
          label: 'Active evaluators',
          value: String(demo.evaluators.length),
          supportingText: 'Shared demo-domain evaluators connect trace-derived datasets to promotion decisions.',
        },
        {
          label: 'Critical evaluator alerts',
          value: String(demo.evaluators.filter((item) => item.health === 'critical').length),
          supportingText: 'Refund-policy correctness remains the highest-signal evaluator during the regression window.',
        },
        {
          label: 'Healthy evaluators',
          value: String(demo.evaluators.filter((item) => item.health === 'healthy').length),
          supportingText: 'Groundedness and helpfulness remain usable confidence signals.',
        },
        {
          label: 'Covered datasets',
          value: String(demo.datasets.length),
          supportingText: 'Evaluator workflows are tied to the same datasets used in the experiment narrative.',
        },
      ]}
      evaluators={demo.evaluators.map((evaluator) => ({
        name: evaluator.name,
        scoringType: evaluator.scoringType,
        model: evaluator.model,
        lastRunStatus: evaluator.health,
        adoptionSummary: evaluator.summary,
        lastRunSummary: evaluator.health === 'critical' ? 'Latest batch flagged major refund correctness drift' : evaluator.health === 'warning' ? 'Latest batch found follow-up investigation targets' : 'Latest batch is stable enough for promotion guidance',
        tracesHref: '/demo/traces',
        datasetsHref: '/demo/datasets',
        experimentsHref: '/demo/experiments',
        compareHref: '/demo/experiments',
      }))}
      nextActions={[
        {
          title: 'Inspect failing refund evidence',
          description: 'Start with the traces and diff pair behind the refund-policy correctness failures.',
          href: '/demo/diff?a=trace_support_refund_v17_baseline&b=trace_support_refund_v18_regression',
          cta: 'Open hero diff',
        },
        {
          title: 'Expand evaluator coverage with datasets',
          description: 'Use the trace-derived dataset set to strengthen confidence before promotion.',
          href: '/demo/datasets',
          cta: 'Open datasets',
        },
        {
          title: 'Validate recovery candidate',
          description: 'Run the current evaluator set through the v19 recovery experiment before shipping.',
          href: '/demo/experiments',
          cta: 'Open experiments',
        },
      ]}
    />
  );
}
