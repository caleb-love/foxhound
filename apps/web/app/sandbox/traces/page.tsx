import { TraceTable } from '@/components/traces/trace-table';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { PageContainer, PageHeader } from '@/components/system/page';
import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import type { Trace } from '@foxhound/types';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { DEFAULT_DASHBOARD_DATE_PRESETS } from '@/lib/stores/dashboard-filter-presets';
import { SandboxTraceFilterSync } from './sandbox-trace-filter-sync';

function buildTraceFilterDefinitions(agents: string[]): DashboardFilterDefinition[] {
  return [
    {
      key: 'searchQuery',
      kind: 'search',
      label: 'Search',
      placeholder: 'Search traces by ID, agent, or workflow...',
    },
    {
      key: 'status',
      kind: 'single-select',
      label: 'Status',
      options: [
        { value: 'all', label: 'All' },
        { value: 'success', label: 'Success' },
        { value: 'error', label: 'Error' },
      ],
    },
    {
      key: 'agentIds',
      kind: 'multi-select',
      label: 'Agents',
      options: agents.map((agentId) => ({ value: agentId, label: agentId })),
    },
    {
      key: 'dateRange',
      kind: 'date-preset',
      label: 'Date range',
      presets: DEFAULT_DASHBOARD_DATE_PRESETS,
    },
  ];
}

export default function SandboxTracesPage() {
  const demo = buildLocalReviewDemo();
  const traces = demo.allTraces as unknown as Trace[];

  const startTimeMs = Math.min(...traces.map((trace) => Number(trace.startTimeMs)));
  const endTimeMs = Math.max(...traces.map((trace) => Number(trace.startTimeMs)));

  // Extract unique agents for filter
  const uniqueAgents = Array.from(new Set(traces.map((t) => t.agentId))).sort();
  const traceFilterDefinitions = buildTraceFilterDefinitions(uniqueAgents);

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
      <DashboardFilterBar definitions={traceFilterDefinitions} />
      <TraceTable initialData={traces} />
    </PageContainer>
  );
}
