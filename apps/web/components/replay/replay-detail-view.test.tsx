import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReplayDetailView } from './replay-detail-view';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const useSearchParams = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => useSearchParams(),
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

  it('renders replay hero, context, and action links', () => {
    render(<ReplayDetailView trace={trace as never} />);

    expect(screen.getByText('Session Replay')).toBeInTheDocument();
    expect(screen.getByText('Replay context and next actions')).toBeInTheDocument();
    expect(screen.getByText(/planner-system · version 8/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open trace detail/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/traces/trace_replay_1'),
    );
    expect(screen.getByRole('link', { name: /Prepare a comparison/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review prompt history/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Compare prompt versions/i })).toBeInTheDocument();
  });
});
