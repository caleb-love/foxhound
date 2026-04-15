import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { ExperimentsDashboard, type ExperimentMetric, type ExperimentRecord } from '@/components/experiments/experiments-dashboard';
import { CreateExperimentDialog } from '@/components/improve/improve-create-actions';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

function formatRelativeDayLabel(createdAt: string) {
  const timestamp = new Date(createdAt).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / (60 * 1000)));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function mapExperimentStatus(status: string): ExperimentRecord['status'] {
  if (status === 'completed') return 'completed';
  if (status === 'running' || status === 'pending') return 'running';
  return 'warning';
}

async function createExperimentAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);
  if (!session) {
    return { ok: false, error: 'You must be signed in to create an experiment.' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const datasetId = String(formData.get('datasetId') ?? '').trim();
  const configRaw = String(formData.get('config') ?? '').trim();

  if (!name || !datasetId || !configRaw) {
    return { ok: false, error: 'Name, dataset, and config JSON are required.' };
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(configRaw) as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'Experiment config must be valid JSON.' };
  }

  try {
    const client = getAuthenticatedClient(session.user.token);
    await client.createExperiment({ name, datasetId, config });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to create experiment right now.' };
  }
}

export default async function ExperimentsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const client = getAuthenticatedClient(session.user.token);
  const experimentsResponse = await client.listExperiments();
  const experimentEntities = experimentsResponse.data;
  const experimentDetails = await Promise.all(experimentEntities.map((experiment) => client.getExperiment(experiment.id)));

  const datasetsResponse = await client.listDatasets();
  const datasetsById = new Map(datasetsResponse.data.map((dataset) => [dataset.id, dataset.name]));

  const metrics: ExperimentMetric[] = [
    {
      label: 'Active experiments',
      value: String(experimentDetails.length),
      supportingText: 'Candidate prompt and routing tests currently in flight or recently completed.',
    },
    {
      label: 'Completed',
      value: String(experimentDetails.filter((experiment) => experiment.status === 'completed').length),
      supportingText: 'Experiments that already finished their current run lifecycle.',
    },
    {
      label: 'Running or pending',
      value: String(experimentDetails.filter((experiment) => experiment.status === 'running' || experiment.status === 'pending').length),
      supportingText: 'Experiments still moving through queued or active execution.',
    },
    {
      label: 'Latest experiment',
      value: experimentDetails[0] ? formatRelativeDayLabel(experimentDetails[0].createdAt) : 'No experiments',
      supportingText: 'Most recent experiment creation time in the current workspace.',
    },
  ];

  const experiments: ExperimentRecord[] = experimentDetails.map((experiment) => ({
    name: experiment.name,
    status: mapExperimentStatus(experiment.status),
    dataset: datasetsById.get(experiment.datasetId) ?? experiment.datasetId,
    comparisonSummary: `Experiment currently ${experiment.status}. ${experiment.runs.length} run(s) are attached, so review dataset coverage and the resulting outputs before promotion decisions.`,
    lastUpdated: formatRelativeDayLabel(experiment.createdAt),
    winningSignal: experiment.status === 'completed'
      ? `completed_runs_available (${experiment.runs.length})`
      : experiment.status === 'failed'
        ? 'failed_run_needs_operator_attention'
        : `awaiting_run_completion (${experiment.runs.length} queued)` ,
    datasetHref: '/datasets',
    evaluatorsHref: '/evaluators',
    tracesHref: `/experiments/${experiment.id}`,
    promoteHref: '/prompts',
  }));

  const nextActions = [
    {
      title: 'Inspect experiment run outputs directly',
      description: 'Open an experiment detail surface and verify that run output, latency, and cost look plausible before promotion decisions.',
      href: experimentDetails[0] ? `/experiments/${experimentDetails[0].id}` : '/experiments',
      cta: 'Open experiment detail',
    },
    {
      title: 'Review evaluator evidence before promotion',
      description: 'Confirm that experiment outcomes are supported by the right evaluator coverage before changing production prompts or routing.',
      href: '/evaluators',
      cta: 'Open evaluators',
    },
    {
      title: 'Inspect source datasets before trusting experiment output',
      description: 'Make sure the experiment is still grounded in the right production failures and comparison cases.',
      href: experimentDetails[0] ? `/datasets/${experimentDetails[0].datasetId}` : '/datasets',
      cta: 'Open source dataset',
    },
    {
      title: 'Re-check source traces and regressions',
      description: 'Validate that experiment outcomes still line up with the production behavior you are trying to change.',
      href: '/regressions',
      cta: 'Open regressions',
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <CreateExperimentDialog
          datasets={datasetsResponse.data.map((dataset) => ({ id: dataset.id, name: dataset.name }))}
          createExperimentAction={createExperimentAction}
        />
      </div>
      <ExperimentsDashboard metrics={metrics} experiments={experiments} nextActions={nextActions} />
    </>
  );
}
