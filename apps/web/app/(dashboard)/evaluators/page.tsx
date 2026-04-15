import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { EvaluatorsDashboard, type EvaluatorMetric, type EvaluatorRecord } from '@/components/evaluators/evaluators-dashboard';
import { CreateEvaluatorDialog, TriggerEvaluatorRunsDialog } from '@/components/improve/improve-create-actions';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

function classifyEvaluatorStatus(enabled: boolean): EvaluatorRecord['lastRunStatus'] {
  return enabled ? 'healthy' : 'warning';
}

async function createEvaluatorAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);
  if (!session) {
    return { ok: false, error: 'You must be signed in to create an evaluator.' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const model = String(formData.get('model') ?? '').trim();
  const scoringType = String(formData.get('scoringType') ?? 'numeric').trim() as 'numeric' | 'categorical';
  const promptTemplate = String(formData.get('promptTemplate') ?? '').trim();
  const labelsRaw = String(formData.get('labels') ?? '').trim();
  const labels = labelsRaw ? labelsRaw.split(',').map((label) => label.trim()).filter(Boolean) : undefined;

  if (!name || !model || !promptTemplate) {
    return { ok: false, error: 'Name, model, and prompt template are required.' };
  }

  try {
    const client = getAuthenticatedClient(session.user.token);
    await client.createEvaluator({
      name,
      model,
      scoringType,
      promptTemplate,
      labels,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to create evaluator right now.' };
  }
}

async function triggerEvaluatorRunsAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);
  if (!session) {
    return { ok: false, error: 'You must be signed in to trigger evaluator runs.' };
  }

  const evaluatorId = String(formData.get('evaluatorId') ?? '').trim();
  const traceIdsRaw = String(formData.get('traceIds') ?? '').trim();
  const traceIds = traceIdsRaw.split(',').map((traceId) => traceId.trim()).filter(Boolean);

  if (!evaluatorId || traceIds.length === 0) {
    return { ok: false, error: 'Evaluator and at least one trace id are required.' };
  }

  try {
    const client = getAuthenticatedClient(session.user.token);
    await client.triggerEvaluatorRuns({ evaluatorId, traceIds });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to trigger evaluator runs right now.' };
  }
}

export default async function EvaluatorsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const client = getAuthenticatedClient(session.user.token);
  const evaluatorsResponse = await client.listEvaluators();
  const evaluatorEntities = evaluatorsResponse.data;

  const metrics: EvaluatorMetric[] = [
    {
      label: 'Active evaluators',
      value: String(evaluatorEntities.length),
      supportingText: 'Templates currently used to score production traces and experiment outputs.',
    },
    {
      label: 'Healthy',
      value: String(evaluatorEntities.filter((evaluator) => evaluator.enabled).length),
      supportingText: 'Evaluators currently enabled and ready for new runs.',
    },
    {
      label: 'Disabled',
      value: String(evaluatorEntities.filter((evaluator) => !evaluator.enabled).length),
      supportingText: 'Evaluators that need operator attention before they can be used again.',
    },
    {
      label: 'Models in use',
      value: String(new Set(evaluatorEntities.map((evaluator) => evaluator.model)).size),
      supportingText: 'Distinct evaluator model configurations currently present.',
    },
  ];

  const evaluators: EvaluatorRecord[] = evaluatorEntities.map((evaluator) => ({
    name: evaluator.name,
    scoringType: evaluator.scoringType,
    model: evaluator.model,
    lastRunStatus: classifyEvaluatorStatus(evaluator.enabled),
    adoptionSummary: evaluator.labels.length > 0
      ? `Configured with labels: ${evaluator.labels.join(', ')}`
      : 'Configured as a numeric evaluator for score-based review.',
    lastRunSummary: evaluator.enabled
      ? 'Ready for new evaluator runs from traces or experiments.'
      : 'Disabled. Re-enable or update this evaluator before using it in production review flows.',
    tracesHref: '/traces',
    datasetsHref: '/datasets',
    experimentsHref: '/experiments',
    compareHref: '/experiments',
  }));

  const nextActions = [
    {
      title: 'Review traces before launching evaluator runs',
      description: 'Inspect the production runs you want to score before using evaluator output to guide decisions.',
      href: '/traces',
      cta: 'Open traces',
    },
    {
      title: 'Use datasets to organize stronger evaluation coverage',
      description: 'Make sure your evaluator set maps cleanly to the datasets feeding experiments and release decisions.',
      href: '/datasets',
      cta: 'Open datasets',
    },
    {
      title: 'Validate changes in experiments',
      description: 'Use evaluator-backed experiments to decide whether candidate prompt or routing changes are safe to promote.',
      href: '/experiments',
      cta: 'Open experiments',
    },
  ];

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <CreateEvaluatorDialog createEvaluatorAction={createEvaluatorAction} />
        <TriggerEvaluatorRunsDialog
          evaluators={evaluatorEntities.map((evaluator) => ({ id: evaluator.id, name: evaluator.name }))}
          triggerEvaluatorRunsAction={triggerEvaluatorRunsAction}
        />
      </div>
      <EvaluatorsDashboard metrics={metrics} evaluators={evaluators} nextActions={nextActions} />
    </>
  );
}
