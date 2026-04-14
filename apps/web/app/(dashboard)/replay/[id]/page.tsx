import { getAuthenticatedClient } from '@/lib/api-client';
import { ReplayDetailView } from '@/components/replay/replay-detail-view';
import { PageErrorState } from '@/components/ui/page-state';
import { notFound } from 'next/navigation';
import { getDashboardSessionOrDemo, isDashboardDemoModeEnabled } from '@/lib/demo-auth';

export default async function ReplayPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getDashboardSessionOrDemo();

  let trace = null;
  let error = null;

  try {
    if (isDashboardDemoModeEnabled()) {
      trace = {
        id: params.id,
        agentId: 'demo-agent',
        sessionId: 'demo-session',
        startTimeMs: 0,
        endTimeMs: 5000,
        metadata: { prompt_name: 'demo-prompt', prompt_version: 3 },
        spans: [
          { traceId: params.id, spanId: 'span_1', name: 'plan', kind: 'llm_call' as const, startTimeMs: 0, endTimeMs: 2000, status: 'ok' as const, attributes: { cost: 0.01 }, events: [] },
          { traceId: params.id, spanId: 'span_2', name: 'execute', kind: 'tool_call' as const, startTimeMs: 2000, endTimeMs: 5000, status: 'error' as const, attributes: { cost: 0.005 }, events: [] },
        ],
      };
    } else {
      const client = getAuthenticatedClient(session.user.token);
      trace = await client.getTrace(params.id);
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
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Replay unavailable</h1>
        <PageErrorState
          title="Session replay unavailable"
          message={error || 'Trace not found'}
          detail="Check API connectivity and try opening the replay again."
        />
      </div>
    );
  }

  return <ReplayDetailView trace={trace} />;
}
