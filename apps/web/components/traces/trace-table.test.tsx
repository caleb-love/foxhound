import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TraceTable } from './trace-table';
import { useFilterStore } from '@/lib/stores/filter-store';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';
import { useCompareStore } from '@/lib/stores/compare-store';

const push = vi.fn();
const usePathnameMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ push }),
}));

// Mock useVirtualizer: jsdom has no layout, so virtualizer renders nothing.
// Return all items as virtual rows with a pass-through implementation.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 56,
        size: 56,
        key: String(i),
      })),
    getTotalSize: () => count * 56,
    measureElement: () => {},
  }),
}));

describe('TraceTable', () => {
  const traces = [
    {
      id: 'trace_a',
      agentId: 'agent-alpha',
      sessionId: 'session_a',
      startTimeMs: Date.now() - 1_000,
      endTimeMs: Date.now(),
      spans: [
        { spanId: 's1', status: 'ok', kind: 'agent_step', startTimeMs: 1, endTimeMs: 2, name: 'step', traceId: 'trace_a', attributes: {}, events: [] },
      ],
      metadata: { workflow: 'alpha-flow' },
    },
    {
      id: 'trace_b',
      agentId: 'agent-beta',
      sessionId: 'session_b',
      startTimeMs: Date.now() - 2_000,
      endTimeMs: Date.now() - 500,
      spans: [
        { spanId: 's2', status: 'error', kind: 'llm_call', startTimeMs: 1, endTimeMs: 2, name: 'llm', traceId: 'trace_b', attributes: {}, events: [] },
      ],
      metadata: { workflow: 'beta-flow' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    push.mockReset();
    usePathnameMock.mockReturnValue('/traces');
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
    useCompareStore.setState({ selectedTraceIds: [], traceAId: null, traceBId: null });
  });

  it('renders empty state when there are no traces', () => {
    render(<TraceTable initialData={[]} />);

    expect(screen.getByText('No traces yet')).toBeInTheDocument();
    expect(screen.getByText('Traces will appear here once your agents start sending data.')).toBeInTheDocument();
  });

  it('renders filtered empty state when filters exclude all traces', () => {
    useSegmentStore.getState().updateCurrentFilters({ searchQuery: 'does-not-match' });
    useFilterStore.setState({ searchQuery: 'does-not-match' });
    render(<TraceTable initialData={traces as never} />);

    expect(screen.getByText('No traces match your filters')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters or clearing them to see more results.')).toBeInTheDocument();
  });

  it('enables compare CTA only when exactly two traces are selected', () => {
    render(<TraceTable initialData={traces as never} />);

    expect(screen.queryByRole('button', { name: /Compare/i })).not.toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);

    const compareButton = screen.getByRole('button', { name: /Compare/i });
    expect(compareButton).toBeDisabled();

    fireEvent.click(checkboxes[1]!);
    expect(compareButton).toBeEnabled();
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('navigates to diff when compare is clicked with two selected traces', () => {
    render(<TraceTable initialData={traces as never} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[1]!);
    fireEvent.click(screen.getByRole('button', { name: /Compare/i }));

    expect(push).toHaveBeenCalledWith('/diff?a=trace_a&b=trace_b');
  });

  it('uses sandbox diff route when rendered in sandbox mode', () => {
    usePathnameMock.mockReturnValue('/sandbox/traces');
    render(<TraceTable initialData={traces as never} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[1]!);
    fireEvent.click(screen.getByRole('button', { name: /Compare/i }));

    expect(push).toHaveBeenCalledWith('/sandbox/diff?a=trace_a&b=trace_b');
  });

  it('uses standard diff routes when rendered outside sandbox paths', () => {
    usePathnameMock.mockReturnValue('/demo/traces');
    render(<TraceTable initialData={traces as never} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[1]!);
    fireEvent.click(screen.getByRole('button', { name: /Compare/i }));

    expect(push).toHaveBeenCalledWith('/diff?a=trace_a&b=trace_b');
  });

  it('keeps only the newest two selected traces', () => {
    const threeTraces = [
      ...traces,
      {
        id: 'trace_c',
        agentId: 'agent-gamma',
        sessionId: 'session_c',
        startTimeMs: Date.now() - 3_000,
        endTimeMs: Date.now() - 1_000,
        spans: [
          { spanId: 's3', status: 'ok', kind: 'tool_call', startTimeMs: 1, endTimeMs: 2, name: 'tool', traceId: 'trace_c', attributes: {}, events: [] },
        ],
        metadata: { workflow: 'gamma-flow' },
      },
    ];

    render(<TraceTable initialData={threeTraces as never} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[1]!);
    fireEvent.click(checkboxes[2]!);

    expect(useCompareStore.getState().selectedTraceIds).toEqual(['trace_b', 'trace_c']);
  });

  it('renders direct replay and compare-slot actions for each trace', () => {
    render(<TraceTable initialData={traces as never} />);

    const replayLinks = screen.getAllByRole('link', { name: /Replay/i });
    expect(replayLinks[0]).toHaveAttribute('href', '/replay/trace_a');
    expect(screen.getAllByRole('button', { name: /Set A/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Set B/i }).length).toBeGreaterThan(0);
  });

  it('updates compare slots explicitly from trace actions', () => {
    render(<TraceTable initialData={traces as never} />);

    fireEvent.click(screen.getAllByRole('button', { name: /Set A/i })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: /Set B/i })[1]!);

    expect(useCompareStore.getState().traceAId).toBe('trace_a');
    expect(useCompareStore.getState().traceBId).toBe('trace_b');
    expect(useCompareStore.getState().selectedTraceIds).toEqual(['trace_a', 'trace_b']);
  });

  it('renders future-dated sandbox traces instead of filtering out the seeded demo corpus', () => {
    usePathnameMock.mockReturnValue('/sandbox/traces');

    const futureTraces = [
      {
        id: 'trace_future_a',
        agentId: 'future-agent-a',
        sessionId: 'future_session_a',
        startTimeMs: Date.now() + 3 * 24 * 60 * 60 * 1000,
        endTimeMs: Date.now() + 3 * 24 * 60 * 60 * 1000 + 1_000,
        spans: [
          { spanId: 'future_s1', status: 'ok', kind: 'agent_step', startTimeMs: 1, endTimeMs: 2, name: 'future-step', traceId: 'trace_future_a', attributes: {}, events: [] },
        ],
        metadata: { workflow: 'future-flow-a' },
      },
      {
        id: 'trace_future_b',
        agentId: 'future-agent-b',
        sessionId: 'future_session_b',
        startTimeMs: Date.now() + 4 * 24 * 60 * 60 * 1000,
        endTimeMs: Date.now() + 4 * 24 * 60 * 60 * 1000 + 1_000,
        spans: [
          { spanId: 'future_s2', status: 'error', kind: 'llm_call', startTimeMs: 1, endTimeMs: 2, name: 'future-llm', traceId: 'trace_future_b', attributes: {}, events: [] },
        ],
        metadata: { workflow: 'future-flow-b' },
      },
    ];

    render(<TraceTable initialData={futureTraces as never} />);

    expect(screen.getByText('future-agent-a')).toBeInTheDocument();
    expect(screen.getByText('future-agent-b')).toBeInTheDocument();
    expect(screen.queryByText('No traces yet')).not.toBeInTheDocument();
  });
});
