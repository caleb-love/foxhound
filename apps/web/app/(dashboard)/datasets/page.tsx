import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DatasetsDashboard, type DatasetMetric, type DatasetRecord } from '@/components/datasets/datasets-dashboard';
import { CreateDatasetDialog, CurateDatasetFromTracesDialog } from '@/components/improve/improve-create-actions';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

interface DatasetsPageProps {
  searchParams?: Promise<{ sourceTrace?: string }>;
}

function formatRelativeDayLabel(createdAt: string) {
  const timestamp = new Date(createdAt).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / (60 * 1000)));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

async function createDatasetAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);
  if (!session) {
    return { ok: false, error: 'You must be signed in to create a dataset.' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();

  if (!name) {
    return { ok: false, error: 'Dataset name is required.' };
  }

  try {
    const client = getAuthenticatedClient(session.user.token);
    await client.createDataset({ name, description: description || undefined });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to create dataset right now.' };
  }
}

async function curateDatasetAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);
  if (!session) {
    return { ok: false, error: 'You must be signed in to curate a dataset.' };
  }

  const datasetId = String(formData.get('datasetId') ?? '').trim();
  const scoreName = String(formData.get('scoreName') ?? '').trim();
  const scoreOperator = String(formData.get('scoreOperator') ?? 'lt').trim() as 'lt' | 'gt' | 'lte' | 'gte';
  const scoreThresholdRaw = String(formData.get('scoreThreshold') ?? '').trim();
  const sinceDaysRaw = String(formData.get('sinceDays') ?? '').trim();
  const limitRaw = String(formData.get('limit') ?? '').trim();

  if (!datasetId || !scoreName || !scoreThresholdRaw) {
    return { ok: false, error: 'Dataset, score name, and threshold are required.' };
  }

  const scoreThreshold = Number(scoreThresholdRaw);
  if (Number.isNaN(scoreThreshold)) {
    return { ok: false, error: 'Score threshold must be a valid number.' };
  }

  const sinceDays = sinceDaysRaw ? Number(sinceDaysRaw) : undefined;
  const limit = limitRaw ? Number(limitRaw) : undefined;

  try {
    const client = getAuthenticatedClient(session.user.token);
    await client.createDatasetItemsFromTraces(datasetId, {
      scoreName,
      scoreOperator,
      scoreThreshold,
      sinceDays,
      limit,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to curate dataset items right now.' };
  }
}

export default async function DatasetsPage({ searchParams }: DatasetsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const client = getAuthenticatedClient(session.user.token);
  const resolved = searchParams ? await searchParams : {};
  const sourceTrace = resolved.sourceTrace;

  const datasetsResponse = await client.listDatasets();
  const datasetEntities = datasetsResponse.data;
  const datasetDetails = await Promise.all(datasetEntities.map((dataset) => client.getDataset(dataset.id)));
  const datasetItemsById = new Map(
    await Promise.all(
      datasetDetails.map(async (dataset) => {
        const items = await client.listDatasetItems(dataset.id, { limit: 5 });
        return [dataset.id, items.data] as const;
      }),
    ),
  );

  const metrics: DatasetMetric[] = [
    {
      label: 'Active datasets',
      value: String(datasetDetails.length),
      supportingText: 'Collections currently used for evaluation and experiment preparation.',
    },
    {
      label: 'Trace-derived cases',
      value: String(datasetDetails.filter((dataset) => dataset.itemCount > 0).reduce((sum, dataset) => sum + dataset.itemCount, 0)),
      supportingText: 'Cases currently captured across your dataset inventory.',
    },
    {
      label: 'Experiment-ready',
      value: String(datasetDetails.filter((dataset) => dataset.itemCount >= 1).length),
      supportingText: 'Datasets already populated enough to seed or inspect experiment work.',
    },
    {
      label: 'Latest dataset',
      value: datasetDetails[0] ? formatRelativeDayLabel(datasetDetails[0].createdAt) : 'No datasets',
      supportingText: 'Most recent dataset creation time in the current workspace.',
    },
  ];

  const datasets: DatasetRecord[] = datasetDetails.map((dataset) => {
    const datasetItems = datasetItemsById.get(dataset.id) ?? [];
    const traceDerivedCount = datasetItems.filter((item) => Boolean(item.sourceTraceId)).length;

    return {
      name: dataset.name,
      itemCount: dataset.itemCount,
      sourceSummary: dataset.description?.trim() || 'Dataset created for trace-derived evaluation and experiment preparation.',
      lastUpdated: formatRelativeDayLabel(dataset.createdAt),
      scoreSignal: traceDerivedCount > 0 ? `trace_lineage_available (${traceDerivedCount})` : dataset.itemCount > 0 ? 'dataset_items_available' : 'awaiting_curation',
      traceHref: `/datasets/${dataset.id}`,
      evaluatorsHref: '/evaluators',
      experimentHref: '/experiments',
    };
  });

  const nextActions = [
    {
      title: 'Inspect the newest low-scoring traces',
      description: 'Confirm the latest dataset additions came from the right production failures and not noisy false positives.',
      href: datasets[0]?.traceHref ?? '/traces',
      cta: 'Open source trace',
    },
    {
      title: 'Review evaluator coverage for these datasets',
      description: 'Check whether the active evaluator set is strong enough before trusting dataset-driven experiments.',
      href: '/evaluators',
      cta: 'Open evaluators',
    },
    {
      title: 'Launch or inspect an experiment',
      description: 'Use the current dataset inventory to validate whether a candidate change fixes the observed production issue.',
      href: '/experiments',
      cta: 'Open experiments',
    },
    {
      title: 'Inspect dataset item lineage',
      description: 'Open the first dataset detail surface so you can inspect item lineage and then branch into source traces from there.',
      href: datasetDetails[0] ? `/datasets/${datasetDetails[0].id}` : '/datasets',
      cta: 'Open dataset detail',
    },
  ];

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

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <CreateDatasetDialog createDatasetAction={createDatasetAction} />
        <CurateDatasetFromTracesDialog
          datasets={datasetDetails.map((dataset) => ({ id: dataset.id, name: dataset.name }))}
          curateDatasetAction={curateDatasetAction}
        />
      </div>
      <DatasetsDashboard metrics={metrics} datasets={datasets} nextActions={tracedNextActions} />
    </>
  );
}
