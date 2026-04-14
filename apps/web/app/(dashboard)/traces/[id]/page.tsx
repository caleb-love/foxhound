import { getAuthenticatedClient } from '@/lib/api-client';
import { TraceDetailView } from '@/components/traces/trace-detail-view';
import { PageErrorState } from '@/components/ui/page-state';
import { notFound } from 'next/navigation';
import { getDashboardSessionOrDemo, isDashboardDemoModeEnabled } from '@/lib/demo-auth';

export default async function TraceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getDashboardSessionOrDemo();
  const { id } = await params;

  let trace = null;
  let error = null;

  try {
    if (isDashboardDemoModeEnabled()) {
      trace = {
        id,
        agentId: 'demo-agent',
        sessionId: 'demo-session',
        startTimeMs: 0,
        endTimeMs: 4200,
        metadata: {
          prompt_name: 'demo-prompt',
          prompt_version: 3,
        },
        spans: [
          {
            traceId: id,
            spanId: 'demo-span-1',
            name: 'plan',
            kind: 'llm_call' as const,
            startTimeMs: 0,
            endTimeMs: 1800,
            status: 'ok' as const,
            attributes: { cost: 0.012 },
            events: [],
          },
          {
            traceId: id,
            spanId: 'demo-span-2',
            name: 'tool-select',
            kind: 'tool_call' as const,
            startTimeMs: 1800,
            endTimeMs: 4200,
            status: 'error' as const,
            attributes: { cost: 0.004 },
            events: [],
          },
        ],
      };
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
