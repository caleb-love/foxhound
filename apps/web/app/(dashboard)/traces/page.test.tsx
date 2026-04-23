import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useFilterStore } from '@/lib/stores/filter-store';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDateRangeFromHours, createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const getDashboardSessionOrSandbox = vi.fn();
const isDashboardSandboxModeEnabled = vi.fn();
const getRequestUrl = vi.fn();
const searchTraces = vi.fn();
const getAuthenticatedClient = vi.fn();
const push = vi.fn();

vi.mock('@/lib/sandbox-auth', () => ({
  getDashboardSessionOrSandbox,
  isDashboardSandboxModeEnabled,
}));

vi.mock('@/lib/server-url', () => ({
  getRequestUrl,
}));

vi.mock('@/lib/api-client', () => ({
  getAuthenticatedClient,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/traces',
  useRouter: () => ({ push }),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: Math.min(count, 20) }, (_, i) => ({
        index: i,
        start: i * 56,
        size: 56,
        key: String(i),
      })),
    getTotalSize: () => count * 56,
    measureElement: () => {},
  }),
}));

describe('dashboard traces page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    const defaults = createDefaultDashboardFilters();
    defaults.dateRange = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: defaults,
      savedSegments: [],
    });
    useFilterStore.setState({
      status: defaults.status,
      severity: defaults.severity,
      agentIds: defaults.agentIds,
      environments: defaults.environments,
      promptIds: defaults.promptIds,
      promptVersionIds: defaults.promptVersionIds,
      evaluatorIds: defaults.evaluatorIds,
      datasetIds: defaults.datasetIds,
      models: defaults.models,
      toolNames: defaults.toolNames,
      tags: defaults.tags,
      dateRange: defaults.dateRange,
      searchQuery: defaults.searchQuery,
    });
    getDashboardSessionOrSandbox.mockResolvedValue({
      user: {
        token: 'token',
      },
    });
    getAuthenticatedClient.mockReturnValue({ searchTraces });
  });

  it('loads seeded sandbox traces instead of showing an empty workbench in sandbox mode', async () => {
    isDashboardSandboxModeEnabled.mockReturnValue(true);
    getRequestUrl.mockResolvedValue('http://localhost:3001/api/sandbox/traces');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          data: [
            {
              id: 'trace_seeded_1',
              agentId: 'sandbox-agent',
              sessionId: 'session_seeded_1',
              startTimeMs: Date.now() - 1_000,
              endTimeMs: Date.now(),
              spans: [
                {
                  traceId: 'trace_seeded_1',
                  spanId: 'span_seeded_1',
                  name: 'seeded-step',
                  kind: 'agent_step',
                  startTimeMs: 1,
                  endTimeMs: 2,
                  status: 'ok',
                  attributes: {},
                  events: [],
                },
              ],
              metadata: {},
            },
          ],
        }),
      }),
    );

    const { default: TracesPage } = await import('./page');
    render(await TracesPage());

    expect(getRequestUrl).toHaveBeenCalledWith('/api/sandbox/traces');
    expect(screen.getByText(/Review 1 seeded sandbox traces across 7 days/i)).toBeInTheDocument();
    expect(screen.getByText('sandbox-agent')).toBeInTheDocument();
    expect(screen.getAllByText('Last 7d').length).toBeGreaterThan(0);
    expect(screen.queryByText('720')).not.toBeInTheDocument();
    expect(screen.queryByText('No traces yet')).not.toBeInTheDocument();

    await waitFor(() => {
      const segmentRange = useSegmentStore.getState().currentFilters.dateRange;
      const rangeHours = (segmentRange.end.getTime() - segmentRange.start.getTime()) / (1000 * 60 * 60);
      expect(Math.round(rangeHours)).toBe(168);
    });
  });

  it('loads authenticated traces from the API client outside sandbox mode', async () => {
    isDashboardSandboxModeEnabled.mockReturnValue(false);
    searchTraces.mockResolvedValue({
      data: [
        {
          id: 'trace_live_1',
          agentId: 'live-agent',
          sessionId: 'session_live_1',
          startTimeMs: Date.now() - 1_000,
          endTimeMs: Date.now(),
          spans: [
            {
              traceId: 'trace_live_1',
              spanId: 'span_live_1',
              name: 'live-step',
              kind: 'agent_step',
              startTimeMs: 1,
              endTimeMs: 2,
              status: 'ok',
              attributes: {},
              events: [],
            },
          ],
          metadata: {},
        },
      ],
      pagination: {
        page: 1,
        limit: 50,
        count: 73,
      },
    });

    const { default: TracesPage } = await import('./page');
    render(await TracesPage({ searchParams: Promise.resolve({}) }));

    expect(getAuthenticatedClient).toHaveBeenCalledWith('token');
    expect(searchTraces).toHaveBeenCalledWith({ page: 1, limit: 50 });
    expect(screen.getAllByText('live-agent').length).toBeGreaterThan(0);
    expect(screen.getByText((_, node) => node?.textContent === 'Showing 1-1 of 73 traces')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/traces?page=2');
  });

  it('respects the requested page for live traces', async () => {
    isDashboardSandboxModeEnabled.mockReturnValue(false);
    searchTraces.mockResolvedValue({
      data: [],
      pagination: {
        page: 2,
        limit: 50,
        count: 120,
      },
    });

    const { default: TracesPage } = await import('./page');
    render(await TracesPage({ searchParams: Promise.resolve({ page: '2' }) }));

    expect(searchTraces).toHaveBeenCalledWith({ page: 2, limit: 50 });
    expect(screen.getByText((_, node) => node?.textContent === 'Showing 0-0 of 120 traces')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/traces');
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/traces?page=3');
  });

  it('shows filtered empty state copy when date range excludes all traces', async () => {
    isDashboardSandboxModeEnabled.mockReturnValue(true);
    getRequestUrl.mockResolvedValue('http://localhost:3001/api/sandbox/traces');
    useSegmentStore.getState().updateCurrentFilters({
      dateRange: {
        start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          data: [
            {
              id: 'trace_seeded_2',
              agentId: 'sandbox-agent',
              sessionId: 'session_seeded_2',
              startTimeMs: Date.now() - 3 * 24 * 60 * 60 * 1000,
              endTimeMs: Date.now() - 3 * 24 * 60 * 60 * 1000 + 1_000,
              spans: [
                {
                  traceId: 'trace_seeded_2',
                  spanId: 'span_seeded_2',
                  name: 'seeded-step',
                  kind: 'agent_step',
                  startTimeMs: 1,
                  endTimeMs: 2,
                  status: 'ok',
                  attributes: {},
                  events: [],
                },
              ],
              metadata: {},
            },
          ],
        }),
      }),
    );

    const { default: TracesPage } = await import('./page');
    render(await TracesPage());

    await waitFor(() => {
      const segmentRange = useSegmentStore.getState().currentFilters.dateRange;
      const expectedRange = createDateRangeFromHours(24 * 7);
      expect(Math.abs(segmentRange.start.getTime() - expectedRange.start.getTime())).toBeLessThan(5 * 60 * 1000);
      expect(Math.abs(segmentRange.end.getTime() - expectedRange.end.getTime())).toBeLessThan(5 * 60 * 1000);
    });

    expect(screen.getByText('sandbox-agent')).toBeInTheDocument();
  });

  it('applies status filtering to the rendered trace table in sandbox mode', async () => {
    isDashboardSandboxModeEnabled.mockReturnValue(true);
    getRequestUrl.mockResolvedValue('http://localhost:3001/api/sandbox/traces');
    useSegmentStore.getState().updateCurrentFilters({ status: 'error' });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          data: [
            {
              id: 'trace_ok_1',
              agentId: 'ok-agent',
              sessionId: 'session_ok_1',
              startTimeMs: Date.now() - 1_000,
              endTimeMs: Date.now(),
              spans: [
                {
                  traceId: 'trace_ok_1',
                  spanId: 'span_ok_1',
                  name: 'ok-step',
                  kind: 'agent_step',
                  startTimeMs: 1,
                  endTimeMs: 2,
                  status: 'ok',
                  attributes: {},
                  events: [],
                },
              ],
              metadata: {},
            },
            {
              id: 'trace_error_1',
              agentId: 'error-agent',
              sessionId: 'session_error_1',
              startTimeMs: Date.now() - 2_000,
              endTimeMs: Date.now() - 1_000,
              spans: [
                {
                  traceId: 'trace_error_1',
                  spanId: 'span_error_1',
                  name: 'error-step',
                  kind: 'llm_call',
                  startTimeMs: 1,
                  endTimeMs: 2,
                  status: 'error',
                  attributes: {},
                  events: [],
                },
              ],
              metadata: {},
            },
          ],
        }),
      }),
    );

    const { default: TracesPage } = await import('./page');
    render(await TracesPage());

    expect(screen.getByText('error-agent')).toBeInTheDocument();
    expect(screen.queryByText('ok-agent')).not.toBeInTheDocument();
    expect(screen.getAllByText((_, node) => (node?.textContent ?? '').includes('Showing 1 trace')).length).toBeGreaterThan(0);
  });
});
