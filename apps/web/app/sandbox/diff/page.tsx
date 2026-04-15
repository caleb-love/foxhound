import type { Trace } from '@foxhound/types';
import { RunDiffView } from '@/components/diff/run-diff-view';
import { PageErrorState, PageWarningState } from '@/components/ui/page-state';
import { getRequestUrl } from '@/lib/server-url';

interface DiffPageProps {
  searchParams: Promise<{
    a?: string;
    b?: string;
  }>;
}

async function getTrace(id: string): Promise<Trace | null> {
  try {
    const response = await fetch(await getRequestUrl(`/api/sandbox/traces/${id}`), {
      cache: 'no-store',
    });
    
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export default async function DiffPage({ searchParams }: DiffPageProps) {
  const { a, b } = await searchParams;

  if (!a || !b) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Run Diff</h1>
        <PageWarningState
          title="Select two traces"
          message="Open the seeded sandbox comparison from the sidebar, or pick any two traces from the sandbox trace list."
        />
      </div>
    );
  }

  const [traceA, traceB] = await Promise.all([
    getTrace(a),
    getTrace(b),
  ]);

  if (!traceA || !traceB) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Run Diff</h1>
        <PageErrorState
          title="Unable to load run diff"
          message="One or both sandbox traces could not be loaded."
          detail="Return to sandbox traces and select the runs again, or reopen the seeded comparison from the sidebar."
        />
      </div>
    );
  }

  return <RunDiffView traceA={traceA} traceB={traceB} backHref="/sandbox/traces" />;
}
