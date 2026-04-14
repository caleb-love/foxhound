import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReplayDetailView } from './replay-detail-view';

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
  it('renders replay hero, context, and action links', () => {
    render(<ReplayDetailView trace={trace as never} />);

    expect(screen.getByText('Session Replay')).toBeInTheDocument();
    expect(screen.getByText('Replay context')).toBeInTheDocument();
    expect(screen.getByText(/planner-system · version 8/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open trace detail/i })).toHaveAttribute(
      'href',
      '/traces/trace_replay_1',
    );
    expect(screen.getByRole('link', { name: /Compare this run/i })).toHaveAttribute(
      'href',
      '/diff?a=trace_replay_1&b=',
    );
    expect(screen.getByRole('link', { name: /Review prompts/i })).toHaveAttribute(
      'href',
      '/prompts?focus=planner-system',
    );
    expect(screen.getByRole('link', { name: /Compare prompt versions/i })).toHaveAttribute(
      'href',
      '/prompts?focus=planner-system&version=8',
    );
  });
});
