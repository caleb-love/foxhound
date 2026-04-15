import { TraceTable } from '@/components/traces/trace-table';
import { TraceFilters } from '@/components/traces/trace-filters';
import { PageContainer, PageHeader } from '@/components/system/page';
import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import type { Trace } from '@foxhound/types';
import { SandboxTraceFilterSync } from './sandbox-trace-filter-sync';

export default function SandboxTracesPage() {
  const demo = buildLocalReviewDemo();
  const traces = demo.allTraces as unknown as Trace[];

  const startTimeMs = Math.min(...traces.map((trace) => Number(trace.startTimeMs)));
  const endTimeMs = Math.max(...traces.map((trace) => Number(trace.startTimeMs)));

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
      <SandboxTraceFilterSync startTimeMs={startTimeMs} endTimeMs={endTimeMs} />
      <TraceFilters availableAgents={uniqueAgents} />
      <TraceTable initialData={traces} />
    </PageContainer>
  );
}
