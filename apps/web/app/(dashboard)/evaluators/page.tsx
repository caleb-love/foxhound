import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { EvaluatorsDashboard, type EvaluatorRecord } from '@/components/evaluators/evaluators-dashboard';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

export default async function EvaluatorsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  let evaluators: EvaluatorRecord[] = [];

  try {
    const client = getAuthenticatedClient(session.user.token);
    const response = await client.listEvaluators();
    evaluators = (response.data ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      scoringType: e.scoringType,
      model: e.model,
      health: 'healthy',
      summary: `${e.scoringType} evaluator using ${e.model}`,
      enabled: e.enabled,
    }));
  } catch {
    // Fall through with empty array
  }

  return <EvaluatorsDashboard evaluators={evaluators} />;
}
