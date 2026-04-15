import { getAuthenticatedClient } from '@/lib/api-client';
import { TraceTable } from '@/components/traces/trace-table';
import { PageErrorState } from '@/components/ui/page-state';
import { PageContainer, PageHeader } from '@/components/system/page';
import type { Trace } from '@foxhound/types';
import { getDashboardSessionOrSandbox, isDashboardSandboxModeEnabled } from '@/lib/sandbox-auth';

export default async function TracesPage() {
  const session = await getDashboardSessionOrSandbox();

  let traces: Trace[] = [];
  let error: string | null = null;

  try {
    if (isDashboardSandboxModeEnabled()) {
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
    <PageContainer>
      <PageHeader
        eyebrow="Investigate"
        title="Traces"
        description="Scan recent executions, isolate unhealthy runs, and select two traces for a faster compare workflow."
      />
      {error ? (
        <PageErrorState
          title="Unable to load traces"
          message={error}
          detail={`Make sure the API server is running on ${process.env.NEXT_PUBLIC_API_URL}`}
        />
      ) : (
        <TraceTable initialData={traces} />
      )}
    </PageContainer>
  );
}
