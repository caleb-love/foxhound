import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ReplayDetailView } from './replay-detail-view';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const useSearchParams = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => useSearchParams(),
  usePathname: () => '/replay/trace_replay_1',
}));

const trace = {
  id: 'trace_replay_1',
  agentId: 'planner-agent',
  startTimeMs: 0,
  endTimeMs: 5000,
  sessionId: 'session_replay_1',
  metadata: {
    prompt_name: 'planner-system',
    prompt_version: 8,
  },
  spans: [
    {
      traceId: 'trace_replay_1',
      spanId: 'span_1',
      name: 'plan',
      kind: 'llm_call',
      startTimeMs: 0,
      endTimeMs: 2000,
      status: 'ok',
      attributes: { cost: 0.01 },
      events: [],
    },
    {
      traceId: 'trace_replay_1',
      spanId: 'span_2',
      name: 'execute',
      kind: 'tool_call',
      startTimeMs: 2000,
      endTimeMs: 5000,
      status: 'error',
      attributes: { cost: 0.005 },
      events: [],
    },
  ],
};

describe('ReplayDetailView', () => {
  beforeEach(() => {
    useSearchParams.mockReturnValue(new URLSearchParams(''));
    useSegmentStore.setState({
      currentSegmentName: 'Planner agent',
      currentFilters: createDefaultDashboardFilters(),
      savedSegments: [],
    });
  });

  it('renders the debugger layout with transport controls and execution flow', () => {
    render(<ReplayDetailView trace={trace as never} />);

    // Should show agent name in header
    expect(screen.getByText('planner-agent')).toBeInTheDocument();

    // Should show error indicator
    expect(screen.getByText(/error/i)).toBeInTheDocument();

    // Should show step counter
    expect(screen.getByText('1/2')).toBeInTheDocument();

    // Should show execution flow with span names (may appear in flow + inspector)
    expect(screen.getAllByText('plan').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('execute').length).toBeGreaterThanOrEqual(1);

    // Should show the current step info
    expect(screen.getByText(/Step 1 of 2/i)).toBeInTheDocument();
  });

  it('shows inline navigation actions', () => {
    render(<ReplayDetailView trace={trace as never} />);

    // Should have Trace and Compare actions
    expect(screen.getByText('Trace')).toBeInTheDocument();
    expect(screen.getByText('Compare')).toBeInTheDocument();
  });

  it('updates the inline inspector when a replay step is selected', () => {
    render(<ReplayDetailView trace={trace as never} />);

    const executionFlowButtons = screen.getAllByRole('button', { name: /execute/i });
    fireEvent.click(executionFlowButtons.at(-1)!);

    expect(screen.getByText(/Step 2 of 2/i)).toBeInTheDocument();
    expect(screen.getAllByText('execute').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Selected replay step')).toBeInTheDocument();
  });
});
