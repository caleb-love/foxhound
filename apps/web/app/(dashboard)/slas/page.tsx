import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { SlasGovernDashboard, type SlaMetric, type SlaRiskRecord } from '@/components/slas/slas-govern-dashboard';
import { ConfigureSlaDialog } from '@/components/govern/govern-create-actions';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

async function configureSlaAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);
  if (!session) {
    return { ok: false, error: 'You must be signed in to configure SLAs.' };
  }

  const agentId = String(formData.get('agentId') ?? '').trim();
  const maxDurationMsRaw = String(formData.get('maxDurationMs') ?? '').trim();
  const minSuccessRateRaw = String(formData.get('minSuccessRate') ?? '').trim();
  const evaluationWindowMsRaw = String(formData.get('evaluationWindowMs') ?? '').trim();
  const minSampleSizeRaw = String(formData.get('minSampleSize') ?? '').trim();

  if (!agentId || (!maxDurationMsRaw && !minSuccessRateRaw)) {
    return { ok: false, error: 'Agent id and at least one SLA threshold are required.' };
  }

  const maxDurationMs = maxDurationMsRaw ? Number(maxDurationMsRaw) : undefined;
  const minSuccessRate = minSuccessRateRaw ? Number(minSuccessRateRaw) : undefined;
  const evaluationWindowMs = evaluationWindowMsRaw ? Number(evaluationWindowMsRaw) : undefined;
  const minSampleSize = minSampleSizeRaw ? Number(minSampleSizeRaw) : undefined;

  try {
    const client = getAuthenticatedClient(session.user.token);
    await client.setSla(agentId, {
      maxDurationMs,
      minSuccessRate,
      evaluationWindowMs,
      minSampleSize,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to configure SLA right now.' };
  }
}

export default async function SLAsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const client = getAuthenticatedClient(session.user.token);
  const slasResponse = await client.listSlas({ limit: 50 });
  const slaEntities = slasResponse.data;

  const metrics: SlaMetric[] = [
    {
      label: 'Tracked SLAs',
      value: String(slaEntities.length),
      supportingText: 'Critical production workflows currently monitored for reliability drift.',
    },
    {
      label: 'Latency-bound',
      value: String(slaEntities.filter((sla) => sla.maxDurationMs !== null).length),
      supportingText: 'Agent workflows currently carrying an explicit latency threshold.',
    },
    {
      label: 'Success-rate bound',
      value: String(slaEntities.filter((sla) => sla.minSuccessRate !== null).length),
      supportingText: 'Agent workflows currently carrying an explicit minimum success target.',
    },
    {
      label: 'Largest SLA surface',
      value: slaEntities[0]?.agentId ?? 'No agents',
      supportingText: 'First configured SLA agent in the current workspace inventory.',
    },
  ];

  const atRiskAgents: SlaRiskRecord[] = slaEntities.map((sla) => ({
    agent: sla.agentId,
    status: sla.minSuccessRate && Number(sla.minSuccessRate) < 0.95 ? 'warning' : sla.maxDurationMs && sla.maxDurationMs > 4000 ? 'warning' : 'healthy',
    successRate: sla.minSuccessRate ? `${(Number(sla.minSuccessRate) * 100).toFixed(1)}% target` : 'no success target',
    latency: sla.maxDurationMs ? `${(sla.maxDurationMs / 1000).toFixed(1)}s target` : 'no latency target',
    description: `Evaluation window ${sla.evaluationWindowMs ?? 86400000}ms with minimum sample size ${sla.minSampleSize ?? 10}. Use traces and replay to validate whether this guardrail is realistic.`,
    tracesHref: '/traces',
    regressionsHref: '/regressions',
    replayHref: '/replay',
  }));

  const nextActions = [
    {
      title: 'Inspect the failing trace cluster',
      description: 'Review the specific executions driving the latest SLA breach.',
      href: '/traces',
      cta: 'Open traces',
    },
    {
      title: 'Check for behavior regressions first',
      description: 'Use regression analysis to confirm whether the SLA drift came from a recent behavior change.',
      href: '/regressions',
      cta: 'Open regressions',
    },
    {
      title: 'Replay the breach path step-by-step',
      description: 'Open Session Replay to find the exact transition point before the SLA started failing.',
      href: '/replay',
      cta: 'Open replay',
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <ConfigureSlaDialog configureSlaAction={configureSlaAction} />
      </div>
      <SlasGovernDashboard metrics={metrics} atRiskAgents={atRiskAgents} nextActions={nextActions} />
    </>
  );
}
