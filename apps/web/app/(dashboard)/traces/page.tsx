import { getAuthenticatedClient } from '@/lib/api-client';
import { TraceTable } from '@/components/traces/trace-table';
import { PageErrorState } from '@/components/ui/page-state';
import type { Trace } from '@foxhound/types';
import { getDashboardSessionOrDemo, isDashboardDemoModeEnabled } from '@/lib/demo-auth';

export default async function TracesPage() {
  const session = await getDashboardSessionOrDemo();

  let traces: Trace[] = [];
  let error: string | null = null;

  try {
    if (isDashboardDemoModeEnabled()) {
      traces = [];
    } else {
      const client = getAuthenticatedClient(session.user.token);
      const response = await client.searchTraces({ limit: 50 });
      traces = response.data || [];
    }
  } catch (e) {
    error = 'Unable to load traces right now.';
    console.error('Error fetching traces:', e);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Traces</h1>
      </div>
      {error ? (
        <PageErrorState
          title="Unable to load traces"
          message={error}
          detail={`Make sure the API server is running on ${process.env.NEXT_PUBLIC_API_URL}`}
        />
      ) : (
        <TraceTable initialData={traces} />
      )}
    </div>
  );
}
