import { TraceTable } from '@/components/traces/trace-table';
import { TraceFilters } from '@/components/traces/trace-filters';
import { PageContainer, PageHeader } from '@/components/system/page';
import type { Trace } from '@foxhound/types';

export default async function SandboxTracesPage() {
  // Fetch from our demo API endpoint
  const response = await fetch('http://localhost:3001/api/sandbox/traces', {
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
        description={`Review ${traces.length} seeded sandbox traces across 7 days, compare failures against baselines, and move directly into detail views.`}
      >
        <span className="text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
          {uniqueAgents.length} agent types
        </span>
      </PageHeader>
      <TraceFilters availableAgents={uniqueAgents} />
      <TraceTable initialData={traces} />
    </PageContainer>
  );
}
