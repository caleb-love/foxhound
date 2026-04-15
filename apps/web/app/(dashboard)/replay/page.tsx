import { getAuthenticatedClient } from '@/lib/api-client';
import { ReplayIndexView } from '@/components/replay/replay-index-view';
import { PageErrorState } from '@/components/ui/page-state';
import { getDashboardSessionOrSandbox, isDashboardSandboxModeEnabled } from '@/lib/sandbox-auth';
import { getRequestUrl } from '@/lib/server-url';
import type { Trace } from '@foxhound/types';

export default async function ReplayIndexPage() {
  const session = await getDashboardSessionOrSandbox();

  let traces: Trace[] = [];
  let errorMessage: string | null = null;

  try {
    if (isDashboardSandboxModeEnabled()) {
      const response = await fetch(await getRequestUrl('/api/sandbox/traces'), {
        cache: 'no-store',
      });
      const data = await response.json();
      traces = data.data || [];
    } else {
      const client = getAuthenticatedClient(session.user.token);
      const response = await client.searchTraces({ limit: 50 });
      traces = response.data || [];
    }
  } catch (error) {
    console.error('Error loading replay index:', error);
    errorMessage = 'Unable to load replay targets right now.';
  }

  if (errorMessage) {
    return (
      <PageErrorState
        title="Unable to load session replay"
        message={errorMessage}
        detail="Try refreshing the page or checking API connectivity before opening a replay target again."
      />
    );
  }

  return <ReplayIndexView traces={traces} baseHref="" />;
}
