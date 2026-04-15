import { getAuthenticatedClient } from '@/lib/api-client';
import { TraceDetailView } from '@/components/traces/trace-detail-view';
import { PageErrorState } from '@/components/ui/page-state';
import { notFound } from 'next/navigation';
import { getDashboardSessionOrSandbox, isDashboardSandboxModeEnabled } from '@/lib/sandbox-auth';
import { getRequestUrl } from '@/lib/server-url';

export default async function TraceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getDashboardSessionOrSandbox();
  const { id } = await params;

  let trace = null;
  let error = null;

  try {
    if (isDashboardSandboxModeEnabled()) {
      const response = await fetch(await getRequestUrl(`/api/sandbox/traces/${id}`), {
        cache: 'no-store',
      });

      if (!response.ok) {
        error = 'Unable to load this trace right now.';
      } else {
        trace = await response.json();
      }
    } else {
      const client = getAuthenticatedClient(session.user.token);
      trace = await client.getTrace(id);
    }
  } catch (e) {
    error = 'Unable to load this trace right now.';
    console.error('Error fetching trace:', e);
  }

  if (!trace && !error) {
    notFound();
  }

  if (error || !trace) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Trace Not Found</h1>
        <PageErrorState
          title="Trace unavailable"
          message={error || 'Trace not found'}
          detail="Check that the API server is reachable and try again."
        />
      </div>
    );
  }

  return <TraceDetailView trace={trace} />;
}
