import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { ExperimentDetailView } from '@/components/experiments/experiment-detail-view';
import { PageErrorState } from '@/components/ui/page-state';
import type { ExperimentWithRuns } from '@foxhound/api-client';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

interface ExperimentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ExperimentDetailPage({ params }: ExperimentDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;
  const client = getAuthenticatedClient(session.user.token);

  let experiment: ExperimentWithRuns | null = null;
  let datasetName = 'Unknown dataset';
  let errorMessage: string | null = null;

  try {
    const loadedExperiment = await client.getExperiment(id);
    experiment = loadedExperiment;
    const datasets = await client.listDatasets();
    datasetName = datasets.data.find((dataset) => dataset.id === loadedExperiment.datasetId)?.name ?? loadedExperiment.datasetId;
  } catch (error) {
    console.error('Error loading experiment detail page:', error);
    errorMessage = "We couldn't load this experiment right now.";
  }

  if (errorMessage || !experiment) {
    return (
      <PageErrorState
        title="Unable to load experiment"
        message={errorMessage ?? 'Experiment not found'}
        detail="Try refreshing the page or navigating back to the experiments workbench."
      />
    );
  }

  return <ExperimentDetailView experiment={experiment} datasetName={datasetName} />;
}
