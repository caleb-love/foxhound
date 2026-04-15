import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DatasetDetailView } from '@/components/datasets/dataset-detail-view';
import { PageErrorState } from '@/components/ui/page-state';
import type { DatasetItemListResponse, DatasetWithCount } from '@foxhound/api-client';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

interface DatasetDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DatasetDetailPage({ params }: DatasetDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;
  const client = getAuthenticatedClient(session.user.token);

  let dataset: DatasetWithCount | null = null;
  let items: DatasetItemListResponse['data'] = [];
  let errorMessage: string | null = null;

  try {
    const [loadedDataset, loadedItems] = await Promise.all([
      client.getDataset(id),
      client.listDatasetItems(id, { limit: 25 }),
    ]);
    dataset = loadedDataset;
    items = loadedItems.data;
  } catch (error) {
    console.error('Error loading dataset detail page:', error);
    errorMessage = "We couldn't load this dataset right now.";
  }

  if (errorMessage || !dataset) {
    return (
      <PageErrorState
        title="Unable to load dataset"
        message={errorMessage ?? 'Dataset not found'}
        detail="Try refreshing the page or navigating back to the datasets workbench."
      />
    );
  }

  return <DatasetDetailView dataset={dataset} items={items} />;
}
