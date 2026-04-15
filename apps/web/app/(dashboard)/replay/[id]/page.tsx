import { getAuthenticatedClient } from '@/lib/api-client';
import { ReplayDetailView } from '@/components/replay/replay-detail-view';
import { PageErrorState } from '@/components/ui/page-state';
import { PageContainer } from '@/components/system/page';
import { notFound } from 'next/navigation';
import { getDashboardSessionOrSandbox, isDashboardSandboxModeEnabled } from '@/lib/sandbox-auth';
import { getRequestUrl } from '@/lib/server-url';

export default async function ReplayPage({
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
        error = 'Unable to load this trace replay right now.';
      } else {
        trace = await response.json();
      }
    } else {
      const client = getAuthenticatedClient(session.user.token);
      trace = await client.getTrace(id);
    }
  } catch (e) {
    error = 'Unable to load this trace replay right now.';
    console.error('Error fetching trace for replay:', e);
  }

  if (!trace && !error) {
    notFound();
  }

  if (error || !trace) {
    return (
      <PageContainer>
        <PageErrorState
          title="Session replay unavailable"
          message={error || 'Trace not found'}
          detail="Check API connectivity and try opening the replay again."
        />
      </PageContainer>
    );
  }

  return <ReplayDetailView trace={trace} />;
}
