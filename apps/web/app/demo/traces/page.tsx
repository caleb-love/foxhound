import { TraceTable } from '@/components/traces/trace-table';
import { TraceFilters } from '@/components/traces/trace-filters';
import type { Trace } from '@foxhound/types';

export default async function DemoTracesPage() {
  // Fetch from our demo API endpoint
  const response = await fetch('http://localhost:3001/api/demo/traces', {
    cache: 'no-store',
  });
  
  const data = await response.json();
  const traces: Trace[] = data.data || [];

  // Extract unique agents for filter
  const uniqueAgents = Array.from(new Set(traces.map((t) => t.agentId))).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Traces</h1>
          <p className="mt-1 text-sm text-gray-500">
            {traces.length} demo traces • {uniqueAgents.length} agent types
          </p>
        </div>
      </div>
      <TraceFilters availableAgents={uniqueAgents} />
      <TraceTable initialData={traces} />
    </div>
  );
}
