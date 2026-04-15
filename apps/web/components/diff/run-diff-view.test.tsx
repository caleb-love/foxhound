import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RunDiffView } from './run-diff-view';

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
  it('renders trace identifiers and comparison sections', () => {
    render(<RunDiffView traceA={traceA as never} traceB={traceB as never} />);

    expect(screen.getByText('Run Diff')).toBeInTheDocument();
    expect(screen.getByText('Baseline vs comparison')).toBeInTheDocument();
    expect(screen.getByText('trace_a')).toBeInTheDocument();
    expect(screen.getByText('trace_b')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByText('Timeline Comparison')).toBeInTheDocument();
  });

  it('shows improvement/regression insights based on metrics', () => {
    render(<RunDiffView traceA={traceA as never} traceB={traceB as never} />);

    expect(screen.getByText('🎉 Both cost and latency improved!')).toBeInTheDocument();
    expect(screen.getByText(/Cost reduced by/)).toBeInTheDocument();
    expect(screen.getByText(/Latency improved by/)).toBeInTheDocument();
    expect(screen.getByText(/Added 1 span/)).toBeInTheDocument();
  });

  it('renders direct investigation links', () => {
    render(<RunDiffView traceA={traceA as never} traceB={traceB as never} />);

    expect(screen.getByRole('link', { name: /Inspect baseline trace/i })).toHaveAttribute('href', '/traces/trace_a');
    expect(screen.getByRole('link', { name: /Inspect comparison trace/i })).toHaveAttribute('href', '/traces/trace_b');
    expect(screen.getByRole('link', { name: /Review prompt history/i })).toHaveAttribute('href', '/prompts?focus=support-routing');
    expect(screen.getByRole('link', { name: /Compare prompt versions/i })).toHaveAttribute(
      'href',
      '/prompts?focus=support-routing&baseline=3&comparison=4',
    );
  });

  it('uses the provided back link when supplied', () => {
    render(<RunDiffView traceA={traceA as never} traceB={traceB as never} backHref="/sandbox/traces" />);

    expect(screen.getByRole('link', { name: /back to traces/i })).toHaveAttribute('href', '/sandbox/traces');
  });
});
