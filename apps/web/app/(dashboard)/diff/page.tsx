import { getAuthenticatedClient } from '@/lib/api-client';
import { RunDiffView } from '@/components/diff/run-diff-view';
import { PageErrorState, PageWarningState } from '@/components/ui/page-state';
import { getDashboardSessionOrSandbox, isDashboardSandboxModeEnabled } from '@/lib/sandbox-auth';
import { getRequestUrl } from '@/lib/server-url';

interface DiffPageProps {
  searchParams: Promise<{
    a?: string;
    b?: string;
  }>;
}

export default async function DiffPage({ searchParams }: DiffPageProps) {
  const session = await getDashboardSessionOrSandbox();

  const { a, b } = await searchParams;
  
  if (!a || !b) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-semibold tracking-[-0.035em]" style={{ color: 'var(--tenant-text-primary)', fontFamily: 'var(--font-heading)' }}>Run Diff</h1>
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
  let availableTraces = [];
  let error: string | null = null;

  try {
    if (isDashboardSandboxModeEnabled()) {
      const [traceAResponse, traceBResponse, tracesResponse] = await Promise.all([
        fetch(await getRequestUrl(`/api/sandbox/traces/${a}`), { cache: 'no-store' }),
        fetch(await getRequestUrl(`/api/sandbox/traces/${b}`), { cache: 'no-store' }),
        fetch(await getRequestUrl('/api/sandbox/traces'), { cache: 'no-store' }),
      ]);

      if (!traceAResponse.ok || !traceBResponse.ok || !tracesResponse.ok) {
        error = 'Unable to load one or both traces for comparison right now.';
      } else {
        traceA = await traceAResponse.json();
        traceB = await traceBResponse.json();
        const tracesPayload = await tracesResponse.json();
        availableTraces = tracesPayload.data || [];
      }
    } else {
      const tracesResponse = await client.searchTraces({ limit: 50 });
      availableTraces = tracesResponse.data || [];
      [traceA, traceB] = await Promise.all([
        client.getTrace(a),
        client.getTrace(b),
      ]);
    }
  } catch (caughtError) {
    console.error('Error fetching traces for diff:', caughtError);
    error = 'Unable to load one or both traces for comparison right now.';
  }

  if (error || !traceA || !traceB) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-semibold tracking-[-0.035em]" style={{ color: 'var(--tenant-text-primary)', fontFamily: 'var(--font-heading)' }}>Run Diff</h1>
        <PageErrorState
          title="Unable to load run diff"
          message={error ?? 'One or both traces could not be loaded.'}
          detail="Return to the traces list and try selecting the runs again."
        />
      </div>
    );
  }

  return <RunDiffView traceA={traceA} traceB={traceB} backHref="/traces" availableTraces={availableTraces} />;
}
