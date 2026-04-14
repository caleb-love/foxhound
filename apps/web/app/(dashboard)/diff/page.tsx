import { getAuthenticatedClient } from '@/lib/api-client';
import { RunDiffView } from '@/components/diff/run-diff-view';
import { PageErrorState, PageWarningState } from '@/components/ui/page-state';
import { getDashboardSessionOrDemo, isDashboardDemoModeEnabled } from '@/lib/demo-auth';

interface DiffPageProps {
  searchParams: {
    a?: string;
    b?: string;
  };
}

export default async function DiffPage({ searchParams }: DiffPageProps) {
  const session = await getDashboardSessionOrDemo();

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
    if (isDashboardDemoModeEnabled()) {
      traceA = {
        id: a,
        agentId: 'demo-agent',
        sessionId: 'demo-a',
        startTimeMs: 0,
        endTimeMs: 5000,
        metadata: { prompt_name: 'demo-prompt', prompt_version: 2 },
        spans: [
          { traceId: a, spanId: 'a1', name: 'search', kind: 'tool_call' as const, startTimeMs: 0, endTimeMs: 1000, status: 'ok' as const, attributes: { cost: 0.01 }, events: [] },
          { traceId: a, spanId: 'a2', name: 'llm', kind: 'llm_call' as const, startTimeMs: 1000, endTimeMs: 5000, status: 'ok' as const, attributes: { cost: 0.02 }, events: [] },
        ],
      };
      traceB = {
        id: b,
        agentId: 'demo-agent',
        sessionId: 'demo-b',
        startTimeMs: 0,
        endTimeMs: 3200,
        metadata: { prompt_name: 'demo-prompt', prompt_version: 3 },
        spans: [
          { traceId: b, spanId: 'b1', name: 'search', kind: 'tool_call' as const, startTimeMs: 0, endTimeMs: 800, status: 'ok' as const, attributes: { cost: 0.005 }, events: [] },
          { traceId: b, spanId: 'b2', name: 'llm', kind: 'llm_call' as const, startTimeMs: 800, endTimeMs: 3000, status: 'error' as const, attributes: { cost: 0.01 }, events: [] },
          { traceId: b, spanId: 'b3', name: 'rerank', kind: 'tool_call' as const, startTimeMs: 3000, endTimeMs: 3200, status: 'ok' as const, attributes: { cost: 0 }, events: [] },
        ],
      };
    } else {
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
