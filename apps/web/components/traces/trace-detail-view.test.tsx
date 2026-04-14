import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TraceDetailView } from './trace-detail-view';

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
  it('renders richer summary cards and prompt context', () => {
    render(<TraceDetailView trace={trace as never} />);

    expect(screen.getByText('Trace investigation')).toBeInTheDocument();
    expect(screen.getByText('Error path')).toBeInTheDocument();
    expect(screen.getByText('$0.0140')).toBeInTheDocument();
    expect(screen.getByText('support-routing')).toBeInTheDocument();
    expect(screen.getByText('Version 12')).toBeInTheDocument();
  });

  it('renders direct investigation CTAs', () => {
    render(<TraceDetailView trace={trace as never} />);

    expect(screen.getByRole('link', { name: /Compare against another run/i })).toHaveAttribute(
      'href',
      '/diff?a=trace_123&b=',
    );
    expect(screen.getByRole('link', { name: /Open session replay/i })).toHaveAttribute(
      'href',
      '/replay/trace_123',
    );
    expect(screen.getByRole('link', { name: /Inspect prompt history/i })).toHaveAttribute(
      'href',
      '/prompts?focus=support-routing',
    );
    expect(screen.getByRole('link', { name: /Compare prompt versions/i })).toHaveAttribute(
      'href',
      '/prompts?focus=support-routing&version=12',
    );
    expect(screen.getByRole('link', { name: /Add to evaluation workflow/i })).toHaveAttribute(
      'href',
      '/datasets?sourceTrace=trace_123',
    );
  });

  it('shows fallback prompt copy when prompt metadata is absent', () => {
    render(
      <TraceDetailView
        trace={{
          ...trace,
          metadata: {},
        } as never}
      />,
    );

    expect(screen.getByText('No prompt metadata')).toBeInTheDocument();
    expect(screen.getByText('Prompt version unavailable')).toBeInTheDocument();
  });
});
