import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { DatasetsDashboard } from '@/components/datasets/datasets-dashboard';

export default function DemoDatasetsPage() {
  const demo = buildLocalReviewDemo();

  return (
    <DatasetsDashboard
      metrics={[
        {
          label: 'Datasets',
          value: String(demo.datasets.length),
          supportingText: 'The hero story starts with a trace-derived refund edge-case dataset.',
        },
        {
          label: 'Total cases',
          value: String(demo.datasets.reduce((sum: number, dataset: (typeof demo.datasets)[number]) => sum + dataset.itemCount, 0)),
          supportingText: 'Enough cases to validate recovery candidates before promotion.',
        },
        {
          label: 'Source traces',
          value: String(new Set(demo.datasets.flatMap((dataset: (typeof demo.datasets)[number]) => dataset.sourceTraceIds)).size),
          supportingText: 'Datasets link back to the exact traces used to explain and validate the regression.',
        },
        {
          label: 'Active evaluators',
          value: String(demo.evaluators.length),
          supportingText: 'Evaluators turn trace-derived cases into promotion signals.',
        },
      ]}
      datasets={demo.datasets.map((dataset: (typeof demo.datasets)[number]) => ({
        name: dataset.name,
        itemCount: dataset.itemCount,
        sourceSummary: dataset.description,
        lastUpdated: 'today',
        scoreSignal: demo.evaluators[0]?.name ?? 'evaluator pending',
        traceHref: `/demo/traces/${dataset.sourceTraceIds[0]}`,
        evaluatorsHref: '/demo/experiments',
        experimentHref: '/demo/experiments',
      }))}
      nextActions={[
        {
          title: 'Review the regression source traces',
          description: 'Start with the traces that fed the refund edge-case dataset so the improve loop stays tied to production evidence.',
          href: '/demo/traces/trace_support_refund_v18_regression',
          cta: 'Open failing trace',
        },
        {
          title: 'Validate the recovery candidate',
          description: 'Use the hero experiment to confirm the dataset now passes at an acceptable cost.',
          href: '/demo/experiments',
          cta: 'Open experiments',
        },
      ]}
    />
  );
}
