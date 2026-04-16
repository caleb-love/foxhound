import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { EvaluatorsDashboard, type EvaluatorRecord } from '@/components/evaluators/evaluators-dashboard';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

export default async function EvaluatorsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  try {
    const client = getAuthenticatedClient(session.user.token);
    const response = await client.listEvaluators();
    const evaluators: EvaluatorRecord[] = (response.data ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      scoringType: e.scoringType,
      model: e.model,
      health: 'healthy',
      summary: `${e.scoringType} evaluator using ${e.model}`,
      enabled: e.enabled,
    }));

    return <EvaluatorsDashboard evaluators={evaluators} />;
  } catch {
    return <EvaluatorsDashboard evaluators={[]} />;
  }
}
