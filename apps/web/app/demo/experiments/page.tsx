import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { ExperimentsDashboard } from '@/components/experiments/experiments-dashboard';

export default function DemoExperimentsPage() {
  const demo = buildLocalReviewDemo();

  return (
    <ExperimentsDashboard
      metrics={[
        {
          label: 'Experiments',
          value: String(demo.experiments.length),
          supportingText: 'The week-long shared demo story includes the hero recovery experiment plus supporting optimization experiments.',
        },
        {
          label: 'Completed wins',
          value: String(demo.experiments.filter((experiment: (typeof demo.experiments)[number]) => experiment.status === 'completed').length),
          supportingText: 'Completed comparisons make the promotion story concrete.',
        },
        {
          label: 'Datasets in play',
          value: String(new Set(demo.experiments.map((experiment: (typeof demo.experiments)[number]) => experiment.datasetId)).size),
          supportingText: 'Trace-derived datasets remain the source of truth for the recovery story.',
        },
        {
          label: 'Promotion-ready candidates',
          value: String(demo.experiments.filter((experiment: (typeof demo.experiments)[number]) => Boolean(experiment.winningCandidate)).length),
          supportingText: 'Multiple recovery candidates are now visible, with support-reply v19 still leading.',
        },
      ]}
      experiments={demo.experiments.map((experiment: (typeof demo.experiments)[number]) => ({
        name: experiment.name,
        status: experiment.status === 'completed' ? 'completed' : experiment.status === 'running' ? 'running' : 'warning',
        dataset: demo.datasets.find((dataset: (typeof demo.datasets)[number]) => dataset.id === experiment.datasetId)?.name ?? experiment.datasetId,
        comparisonSummary: experiment.summary,
        lastUpdated: 'this week',
        winningSignal: experiment.winningCandidate ?? 'No winner yet',
        datasetHref: '/demo/datasets',
        evaluatorsHref: '/demo/datasets',
        tracesHref: '/demo/traces',
        promoteHref: experiment.winningCandidate ? '/demo/regressions' : undefined,
      }))}
      nextActions={[
        {
          title: 'Compare the hero traces',
          description: 'See the exact behavior change that the recovery experiment is validating.',
          href: '/demo/diff?a=trace_support_refund_v18_regression&b=trace_support_refund_v19_fix',
          cta: 'Open recovery diff',
        },
        {
          title: 'Review the regression context',
          description: 'Use the regressions page to understand why the experiment was necessary in the first place.',
          href: '/demo/regressions',
          cta: 'Open regressions',
        },
      ]}
    />
  );
}
