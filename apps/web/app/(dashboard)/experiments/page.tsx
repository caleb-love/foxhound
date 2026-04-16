import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { ExperimentsDashboard, type ExperimentRecord } from '@/components/experiments/experiments-dashboard';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

export default async function ExperimentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  try {
    const client = getAuthenticatedClient(session.user.token);
    const response = await client.listExperiments();
    const experiments: ExperimentRecord[] = (response.data ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      datasetId: e.datasetId,
      status: e.status,
      summary: `${e.status} experiment on dataset ${e.datasetId}`,
    }));

    return <ExperimentsDashboard experiments={experiments} />;
  } catch {
    return <ExperimentsDashboard experiments={[]} />;
  }
}
