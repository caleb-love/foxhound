import { TraceTable } from '@/components/traces/trace-table';
import { TraceFilters } from '@/components/traces/trace-filters';
import { PageContainer, PageHeader } from '@/components/system/page';
import { getRequestUrl } from '@/lib/server-url';
import type { Trace } from '@foxhound/types';

export default async function SandboxTracesPage() {
  const response = await fetch(await getRequestUrl('/api/sandbox/traces'), {
    cache: 'no-store',
  });
  
  const data = await response.json();
  const traces: Trace[] = data.data || [];

  // Extract unique agents for filter
  const uniqueAgents = Array.from(new Set(traces.map((t) => t.agentId))).sort();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Investigate"
        title="Traces"
        description={`Review ${traces.length} seeded sandbox traces across 7 days, with realistic agent names, case stories, prompt context, and linked investigation paths.`}
      >
        <span className="text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
          {uniqueAgents.length} named agents
        </span>
      </PageHeader>
      <TraceFilters availableAgents={uniqueAgents} />
      <TraceTable initialData={traces} />
    </PageContainer>
  );
}
