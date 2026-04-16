import Link from 'next/link';
import { getAuthenticatedClient } from '@/lib/api-client';
import { TraceTable } from '@/components/traces/trace-table';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { PageErrorState } from '@/components/ui/page-state';
import { PageContainer, PageHeader } from '@/components/system/page';
import type { Trace } from '@foxhound/types';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { DEFAULT_DASHBOARD_DATE_PRESETS } from '@/lib/stores/dashboard-filter-presets';
import { getDashboardSessionOrSandbox, isDashboardSandboxModeEnabled } from '@/lib/sandbox-auth';
import { getRequestUrl } from '@/lib/server-url';
import { SandboxTraceFilterReset } from './sandbox-trace-filter-reset';

interface TracesPageProps {
  searchParams?: Promise<{
    page?: string;
  }>;
}

const TRACE_PAGE_SIZE = 50;

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

function buildPageHref(page: number) {
  return page <= 1 ? '/traces' : `/traces?page=${page}`;
}

export default async function TracesPage({ searchParams }: TracesPageProps = {}) {
  const session = await getDashboardSessionOrSandbox();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const currentPage = Math.max(1, Number.parseInt(resolvedSearchParams.page ?? '1', 10) || 1);

  let traces: Trace[] = [];
  let totalCount = 0;
  let error: string | null = null;

  try {
    if (isDashboardSandboxModeEnabled()) {
      const response = await fetch(await getRequestUrl('/api/sandbox/traces'), {
        cache: 'no-store',
      });
      const data = await response.json();
      const allTraces = data.data || [];
      totalCount = allTraces.length;
      const startIndex = (currentPage - 1) * TRACE_PAGE_SIZE;
      traces = allTraces.slice(startIndex, startIndex + TRACE_PAGE_SIZE);
    } else {
      const client = getAuthenticatedClient(session.user.token);
      const response = await client.searchTraces({ page: currentPage, limit: TRACE_PAGE_SIZE });
      traces = response.data || [];
      totalCount = response.pagination?.count ?? traces.length;
    }
  } catch (e) {
    error = 'Unable to load traces right now.';
    console.error('Error fetching traces:', e);
  }

  const uniqueAgents = Array.from(new Set(traces.map((trace) => trace.agentId))).sort();
  const traceFilterDefinitions = buildTraceFilterDefinitions(uniqueAgents);
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = totalCount > currentPage * TRACE_PAGE_SIZE;
  const rawPageStart = totalCount === 0 ? 0 : (currentPage - 1) * TRACE_PAGE_SIZE + 1;
  const pageStart = traces.length === 0 ? 0 : rawPageStart;
  const pageEnd = traces.length === 0 ? 0 : rawPageStart + traces.length - 1;

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
      {!error ? (
        <>
          {isDashboardSandboxModeEnabled() ? <SandboxTraceFilterReset /> : null}
          <DashboardFilterBar definitions={traceFilterDefinitions} />
        </>
      ) : null}
      {error ? (
        <PageErrorState
          title="Unable to load traces"
          message={error}
          detail={`Make sure the API server is running on ${process.env.NEXT_PUBLIC_API_URL}`}
        />
      ) : (
        <>
          {!isDashboardSandboxModeEnabled() ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-[var(--tenant-radius-panel-tight)] border px-3 py-2 text-sm" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
              <div className="text-tenant-text-secondary">
                Showing <span className="font-medium text-tenant-text-primary">{pageStart}-{pageEnd}</span> of{' '}
                <span className="font-medium text-tenant-text-primary">{totalCount}</span> traces
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={buildPageHref(currentPage - 1)}
                  aria-disabled={!hasPreviousPage}
                  className="rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-xs font-medium transition-opacity"
                  style={{
                    borderColor: 'var(--tenant-panel-stroke)',
                    color: hasPreviousPage ? 'var(--tenant-text-primary)' : 'var(--tenant-text-muted)',
                    pointerEvents: hasPreviousPage ? 'auto' : 'none',
                    opacity: hasPreviousPage ? 1 : 0.5,
                  }}
                >
                  Previous
                </Link>
                <span className="text-xs text-tenant-text-muted">Page {currentPage}</span>
                <Link
                  href={buildPageHref(currentPage + 1)}
                  aria-disabled={!hasNextPage}
                  className="rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-xs font-medium transition-opacity"
                  style={{
                    borderColor: 'var(--tenant-panel-stroke)',
                    color: hasNextPage ? 'var(--tenant-text-primary)' : 'var(--tenant-text-muted)',
                    pointerEvents: hasNextPage ? 'auto' : 'none',
                    opacity: hasNextPage ? 1 : 0.5,
                  }}
                >
                  Next
                </Link>
              </div>
            </div>
          ) : null}
          <TraceTable initialData={traces} />
        </>
      )}
    </PageContainer>
  );
}
