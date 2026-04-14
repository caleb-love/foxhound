import { DatasetsDashboard, type DatasetMetric, type DatasetRecord } from '@/components/datasets/datasets-dashboard';

interface DatasetsPageProps {
  searchParams?: Promise<{ sourceTrace?: string }>;
}

const metrics: DatasetMetric[] = [
  {
    label: 'Active datasets',
    value: '4',
    supportingText: 'Collections currently used for evaluation and experiment preparation.',
  },
  {
    label: 'Trace-derived cases',
    value: '128',
    supportingText: 'Cases imported from real traces with poor scores or failures.',
  },
  {
    label: 'Experiment-ready',
    value: '3',
    supportingText: 'Datasets with enough coverage to compare prompt or routing variants.',
  },
  {
    label: 'Latest ingestion',
    value: '15m ago',
    supportingText: 'Recent failures were converted into evaluation cases automatically.',
  },
];

const datasets: DatasetRecord[] = [
  {
    name: 'onboarding-regressions',
    itemCount: 42,
    sourceSummary: 'Built from failing onboarding traces where success score fell below threshold.',
    lastUpdated: '15 minutes ago',
    scoreSignal: 'success_score < 0.6',
    traceHref: '/traces',
    evaluatorsHref: '/evaluators',
    experimentHref: '/experiments',
  },
  {
    name: 'support-latency-outliers',
    itemCount: 31,
    sourceSummary: 'Captured from traces where duration exceeded the latency baseline after prompt changes.',
    lastUpdated: 'today',
    scoreSignal: 'duration_ms > baseline',
    traceHref: '/traces',
    evaluatorsHref: '/evaluators',
    experimentHref: '/experiments',
  },
  {
    name: 'planner-behavior-drift',
    itemCount: 55,
    sourceSummary: 'Curated from traces with structural run differences and new span patterns.',
    lastUpdated: '2 hours ago',
    scoreSignal: 'behavior_diff_detected',
    traceHref: '/regressions',
    evaluatorsHref: '/evaluators',
    experimentHref: '/experiments',
  },
];

const nextActions = [
  {
    title: 'Inspect the newest low-scoring traces',
    description: 'Confirm the latest dataset additions came from the right production failures and not noisy false positives.',
    href: '/traces',
    cta: 'Open traces',
  },
  {
    title: 'Review the regression source set',
    description: 'Use the regression workflow to validate the most recent behavior-drift cases feeding this dataset.',
    href: '/regressions',
    cta: 'Open regressions',
  },
  {
    title: 'Launch a prompt or routing experiment',
    description: 'Use the current dataset to evaluate whether a candidate change fixes the regression.',
    href: '/experiments',
    cta: 'Open experiments',
  },
];

export default async function DatasetsPage({ searchParams }: DatasetsPageProps) {
  const resolved = searchParams ? await searchParams : {};
  const sourceTrace = resolved.sourceTrace;

  const tracedNextActions = sourceTrace
    ? [
        {
          title: `Continue from source trace ${sourceTrace}`,
          description: 'Use this dataset workflow to turn the selected production trace into reusable evaluation coverage.',
          href: `/traces/${sourceTrace}`,
          cta: 'Open source trace',
        },
        ...nextActions,
      ]
    : nextActions;

  return <DatasetsDashboard metrics={metrics} datasets={datasets} nextActions={tracedNextActions} />;
}
