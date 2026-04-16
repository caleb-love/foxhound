import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DatasetsDashboard, type DatasetRecord } from '@/components/datasets/datasets-dashboard';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

export default async function DatasetsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  try {
    const client = getAuthenticatedClient(session.user.token);
    const response = await client.listDatasets();
    const datasets: DatasetRecord[] = (response.data ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      itemCount: ('itemCount' in d ? (d as { itemCount: number }).itemCount : 0),
    }));

    return <DatasetsDashboard datasets={datasets} />;
  } catch {
    return <DatasetsDashboard datasets={[]} />;
  }
}
