import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RunDiffView } from './run-diff-view';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/diff',
}));

const traceA = {
  id: 'trace_a',
  agentId: 'agent-alpha',
  startTimeMs: 0,
  endTimeMs: 5000,
  sessionId: 'session_a',
  metadata: { prompt_name: 'support-routing', prompt_version: 3 },
  spans: [
    {
      traceId: 'trace_a',
      spanId: 'a1',
      name: 'search',
      kind: 'tool_call',
      startTimeMs: 0,
      endTimeMs: 1000,
      status: 'ok',
      attributes: { cost: 0.01 },
      events: [],
    },
    {
      traceId: 'trace_a',
      spanId: 'a2',
      name: 'llm',
      kind: 'llm_call',
      startTimeMs: 1000,
      endTimeMs: 5000,
      status: 'ok',
      attributes: { cost: 0.02 },
      events: [],
    },
  ],
};

const traceB = {
  id: 'trace_b',
  agentId: 'agent-alpha',
  startTimeMs: 0,
  endTimeMs: 3000,
  sessionId: 'session_b',
  metadata: { prompt_name: 'support-routing', prompt_version: 4 },
  spans: [
    {
      traceId: 'trace_b',
      spanId: 'b1',
      name: 'search',
      kind: 'tool_call',
      startTimeMs: 0,
      endTimeMs: 800,
      status: 'ok',
      attributes: { cost: 0.005 },
      events: [],
    },
    {
      traceId: 'trace_b',
      spanId: 'b2',
      name: 'llm',
      kind: 'llm_call',
      startTimeMs: 800,
      endTimeMs: 3000,
      status: 'error',
      attributes: { cost: 0.01 },
      events: [],
    },
    {
      traceId: 'trace_b',
      spanId: 'b3',
      name: 'rerank',
      kind: 'tool_call',
      startTimeMs: 3000,
      endTimeMs: 3200,
      status: 'ok',
      attributes: { cost: 0 },
      events: [],
    },
  ],
};

describe('RunDiffView', () => {
  beforeEach(() => {
    push.mockReset();
  });

  it('renders the verdict and key sections', () => {
    render(<RunDiffView traceA={traceA as never} traceB={traceB as never} />);

    // Should show verdict bar with a headline
    // traceB has 1 error vs 0 in A, so verdict should indicate regression
    expect(screen.getByText(/Regression detected/i)).toBeInTheDocument();

    // Should show insights section
    expect(screen.getByText(/Insights and recommended actions/i)).toBeInTheDocument();

    // Should show waterfall diff section
    expect(screen.getAllByText(/waterfall diff/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows trace pair strip with agent info', () => {
    render(<RunDiffView traceA={traceA as never} traceB={traceB as never} />);

    // Should show agent IDs in the trace pair strip
    expect(screen.getAllByText('agent-alpha').length).toBeGreaterThanOrEqual(2);

    // Should have a swap button
    expect(screen.getByText('Swap')).toBeInTheDocument();
  });

  it('renders comparison bars for cost, latency, spans, errors', () => {
    render(<RunDiffView traceA={traceA as never} traceB={traceB as never} />);

    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Latency')).toBeInTheDocument();
    expect(screen.getByText('Spans')).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();
  });

  it('renders inline action links', () => {
    render(<RunDiffView traceA={traceA as never} traceB={traceB as never} />);

    expect(screen.getByText('Baseline')).toBeInTheDocument();
    expect(screen.getByText('Comparison')).toBeInTheDocument();
  });

  it('renders trace dropdown pickers when available traces are provided', () => {
    render(
      <RunDiffView
        traceA={traceA as never}
        traceB={traceB as never}
        availableTraces={[traceA, traceB] as never}
      />,
    );

    // The DiffTracePicker renders A and B dropdown triggers
    expect(screen.getAllByText('A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('B').length).toBeGreaterThanOrEqual(1);
  });

  it('navigates to a new diff pair when swap is clicked', () => {
    render(
      <RunDiffView
        traceA={traceA as never}
        traceB={traceB as never}
        availableTraces={[traceA, traceB] as never}
      />,
    );

    const swapButton = screen.getByText('Swap');
    fireEvent.click(swapButton);

    expect(push).toHaveBeenCalledWith(expect.stringContaining('a=trace_b'));
    expect(push).toHaveBeenCalledWith(expect.stringContaining('b=trace_a'));
  });
});
