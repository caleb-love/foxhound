import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TraceDetailView } from './trace-detail-view';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const useSearchParams = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => useSearchParams(),
  usePathname: () => '/traces/trace_123',
}));

const trace = {
  id: 'trace_123',
  agentId: 'support-agent',
  startTimeMs: 0,
  endTimeMs: 4000,
  sessionId: 'session_1',
  metadata: {
    prompt_name: 'support-routing',
    prompt_version: 12,
  },
  spans: [
    {
      traceId: 'trace_123',
      spanId: 'span_1',
      name: 'planner',
      kind: 'llm_call',
      startTimeMs: 0,
      endTimeMs: 2000,
      status: 'ok',
      attributes: { cost: 0.0125 },
      events: [],
    },
    {
      traceId: 'trace_123',
      spanId: 'span_2',
      name: 'knowledge-search',
      kind: 'tool_call',
      startTimeMs: 2000,
      endTimeMs: 4000,
      status: 'error',
      attributes: { cost: 0.0015 },
      events: [],
    },
  ],
};

describe('TraceDetailView', () => {
  beforeEach(() => {
    useSearchParams.mockReturnValue(new URLSearchParams(''));
    useSegmentStore.setState({
      currentSegmentName: 'Support agent',
      currentFilters: createDefaultDashboardFilters(),
      savedSegments: [],
    });
  });

  it('renders verdict bar with error information', () => {
    render(<TraceDetailView trace={trace as never} />);

    // Verdict should mention the error
    expect(screen.getByText(/knowledge-search failed/i)).toBeInTheDocument();
  });

  it('renders metric strip with key values', () => {
    render(<TraceDetailView trace={trace as never} />);

    // Check metric chip labels exist
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Spans')).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
  });

  it('renders inline action buttons', () => {
    render(<TraceDetailView trace={trace as never} />);

    expect(screen.getByText('Compare')).toBeInTheDocument();
    expect(screen.getByText('Replay')).toBeInTheDocument();
  });

  it('renders waterfall timeline with span names', () => {
    render(<TraceDetailView trace={trace as never} />);

    // Spans should be visible in the waterfall
    expect(screen.getByText('planner')).toBeInTheDocument();
    expect(screen.getByText('knowledge-search')).toBeInTheDocument();
  });

  it('shows prompt action when prompt metadata is available', () => {
    render(<TraceDetailView trace={trace as never} />);

    // Should have a prompt action link
    expect(screen.getByText(/Prompt/)).toBeInTheDocument();
  });

  it('handles missing prompt metadata', () => {
    render(
      <TraceDetailView
        trace={{
          ...trace,
          metadata: {},
        } as never}
      />,
    );

    // Should not crash; Compare and Replay still present
    expect(screen.getByText('Compare')).toBeInTheDocument();
    expect(screen.getByText('Replay')).toBeInTheDocument();
  });
});
