import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { ExperimentsDashboard, type ExperimentRecord } from '@/components/experiments/experiments-dashboard';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

export default async function ExperimentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  let experiments: ExperimentRecord[] = [];

  try {
    const client = getAuthenticatedClient(session.user.token);
    const response = await client.listExperiments();
    experiments = (response.data ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      datasetId: e.datasetId,
      status: e.status,
      summary: `${e.status} experiment on dataset ${e.datasetId}`,
      createdAt: 'createdAt' in e && typeof e.createdAt === 'string' ? e.createdAt : new Date().toISOString(),
    }));
  } catch {
    // Fall through with empty array
  }

  return <ExperimentsDashboard experiments={experiments} />;
}
