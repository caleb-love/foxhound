import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { ExperimentComparisonView } from '@/components/experiments/experiment-comparison-view';
import { PageErrorState, PageWarningState } from '@/components/ui/page-state';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';

interface ExperimentComparisonPageProps {
  searchParams: Promise<{
    experimentIds?: string;
  }>;
}

export default async function ExperimentComparisonPage({
  searchParams,
}: ExperimentComparisonPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const { experimentIds } = await searchParams;
  const ids = (experimentIds ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (ids.length < 2) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-semibold tracking-[-0.035em]" style={{ color: 'var(--tenant-text-primary)', fontFamily: 'var(--font-heading)' }}>
          Experiment Comparison
        </h1>
        <PageWarningState
          title="Select at least two experiments"
          message="Choose two or more experiments from the improve workbench to run a side-by-side comparison."
          detail="Pass experimentIds in the query string, for example: /experiments/compare?experimentIds=exp_a,exp_b"
        />
      </div>
    );
  }

  const client = getAuthenticatedClient(session.user.token);
  let comparison = null;
  let errorMessage: string | null = null;

  try {
    comparison = await client.compareExperiments(ids);
  } catch (error) {
    console.error('Error loading experiment comparison page:', error);
    errorMessage = 'One or more experiments could not be compared right now.';
  }

  if (errorMessage || !comparison) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-semibold tracking-[-0.035em]" style={{ color: 'var(--tenant-text-primary)', fontFamily: 'var(--font-heading)' }}>
          Experiment Comparison
        </h1>
        <PageErrorState
          title="Unable to load experiment comparison"
          message={errorMessage ?? 'One or more experiments could not be compared right now.'}
          detail="Verify the experiment IDs belong to the current org, then try again from the experiments workbench."
        />
      </div>
    );
  }

  return <ExperimentComparisonView comparison={comparison} />;
}
