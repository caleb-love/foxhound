import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';
import { RunDiffView } from '@/components/diff/run-diff-view';
import { PageErrorState, PageWarningState } from '@/components/ui/page-state';

interface DiffPageProps {
  searchParams: {
    a?: string;
    b?: string;
  };
}

export default async function DiffPage({ searchParams }: DiffPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const { a, b } = searchParams;
  
  if (!a || !b) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Run Diff</h1>
        <PageWarningState
          title="Select two traces"
          message="Please select two traces to compare from the traces list."
        />
      </div>
    );
  }

  const client = getAuthenticatedClient(session.user.token);

  let traceA;
  let traceB;
  let error: string | null = null;

  try {
    [traceA, traceB] = await Promise.all([
      client.getTrace(a),
      client.getTrace(b),
    ]);
  } catch (caughtError) {
    console.error('Error fetching traces for diff:', caughtError);
    error = 'Unable to load one or both traces for comparison right now.';
  }

  if (error || !traceA || !traceB) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Run Diff</h1>
        <PageErrorState
          title="Unable to load run diff"
          message={error ?? 'One or both traces could not be loaded.'}
          detail="Return to the traces list and try selecting the runs again."
        />
      </div>
    );
  }

  return <RunDiffView traceA={traceA} traceB={traceB} backHref="/traces" />;
}
