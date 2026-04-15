import { getAuthenticatedClient } from '@/lib/api-client';
import { TraceTable } from '@/components/traces/trace-table';
import { TraceFilters } from '@/components/traces/trace-filters';
import { PageErrorState } from '@/components/ui/page-state';
import { PageContainer, PageHeader } from '@/components/system/page';
import type { Trace } from '@foxhound/types';
import { getDashboardSessionOrSandbox, isDashboardSandboxModeEnabled } from '@/lib/sandbox-auth';
import { getRequestUrl } from '@/lib/server-url';
import { SandboxTraceFilterReset } from './sandbox-trace-filter-reset';

export default async function TracesPage() {
  const session = await getDashboardSessionOrSandbox();

  let traces: Trace[] = [];
  let error: string | null = null;

  try {
    if (isDashboardSandboxModeEnabled()) {
      const response = await fetch(await getRequestUrl('/api/sandbox/traces'), {
        cache: 'no-store',
      });
      const data = await response.json();
      traces = data.data || [];
    } else {
      const client = getAuthenticatedClient(session.user.token);
      const response = await client.searchTraces({ limit: 50 });
      traces = response.data || [];
    }
  } catch (e) {
    error = 'Unable to load traces right now.';
    console.error('Error fetching traces:', e);
  }

  const uniqueAgents = Array.from(new Set(traces.map((trace) => trace.agentId))).sort();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Investigate"
        title="Traces"
        description={isDashboardSandboxModeEnabled()
          ? `Review ${traces.length} seeded sandbox traces across 7 days, compare failures against baselines, and move directly into detail views.`
          : 'Scan recent executions, isolate unhealthy runs, and move from list-level evidence into compare, replay, and prompt investigation faster.'}
      >
        {isDashboardSandboxModeEnabled() ? (
          <span className="text-xs" style={{ color: 'var(--tenant-text-muted)' }}>
            {uniqueAgents.length} agent types
          </span>
        ) : (
          <div
            className="inline-flex items-center rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]"
            style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-strong)', color: 'var(--tenant-text-secondary)' }}
          >
            Compare-first workflow
          </div>
        )}
      </PageHeader>
      {!error && isDashboardSandboxModeEnabled() ? (
        <>
          <SandboxTraceFilterReset />
          <TraceFilters availableAgents={uniqueAgents} />
        </>
      ) : null}
      {error ? (
        <PageErrorState
          title="Unable to load traces"
          message={error}
          detail={`Make sure the API server is running on ${process.env.NEXT_PUBLIC_API_URL}`}
        />
      ) : (
        <TraceTable initialData={traces} />
      )}
    </PageContainer>
  );
}
