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
    useCompareStore.setState({ selectedTraceIds: [] });
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

  it('shows compare CTA only when exactly two traces are selected', () => {
    render(<TraceTable initialData={traces as never} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);
    expect(screen.queryByRole('button', { name: /Compare/i })).not.toBeInTheDocument();

    fireEvent.click(checkboxes[1]!);
    expect(screen.getByRole('button', { name: /Compare/i })).toBeInTheDocument();
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

  it('uses demo diff route when rendered in demo mode', () => {
    usePathnameMock.mockReturnValue('/demo/traces');
    render(<TraceTable initialData={traces as never} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[1]!);
    fireEvent.click(screen.getByRole('button', { name: /Compare/i }));

    expect(push).toHaveBeenCalledWith('/demo/diff?a=trace_a&b=trace_b');
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
});
