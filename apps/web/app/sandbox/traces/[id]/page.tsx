import type { Trace } from '@foxhound/types';
import { TraceDetailView } from '@/components/traces/trace-detail-view';
import { PageErrorState } from '@/components/ui/page-state';

export default async function SandboxTraceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const response = await fetch(`http://localhost:3001/api/sandbox/traces/${id}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    return (
      <PageErrorState
        title="Trace not found"
        message="The requested sandbox trace could not be loaded."
        detail="Return to the sandbox trace list and select one of the seeded runs."
      />
    );
  }

  const trace: Trace = await response.json();

  return <TraceDetailView trace={trace} baseHref="/sandbox" />;
}
