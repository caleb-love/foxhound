import { getAuthenticatedClient } from '@/lib/api-client';
import { ReplayDetailView } from '@/components/replay/replay-detail-view';
import { PageErrorState } from '@/components/ui/page-state';
import { PageContainer } from '@/components/system/page';
import { notFound } from 'next/navigation';
import { getDashboardSessionOrSandbox, isDashboardSandboxModeEnabled } from '@/lib/sandbox-auth';

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
      trace = {
        id,
        agentId: 'sandbox-agent',
        sessionId: 'sandbox-session',
        startTimeMs: 0,
        endTimeMs: 5000,
        metadata: { prompt_name: 'sandbox-prompt', prompt_version: 3 },
        spans: [
          { traceId: id, spanId: 'span_1', name: 'plan', kind: 'llm_call' as const, startTimeMs: 0, endTimeMs: 2000, status: 'ok' as const, attributes: { cost: 0.01 }, events: [] },
          { traceId: id, spanId: 'span_2', name: 'execute', kind: 'tool_call' as const, startTimeMs: 2000, endTimeMs: 5000, status: 'error' as const, attributes: { cost: 0.005 }, events: [] },
        ],
      };
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
