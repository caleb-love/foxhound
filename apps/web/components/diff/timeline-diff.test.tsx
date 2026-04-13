import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineDiff } from './timeline-diff';

describe('TimelineDiff', () => {
  it('renders empty comparison state when both traces have no spans', () => {
    render(
      <TimelineDiff
        traceA={{ id: 'a', agentId: 'agent', startTimeMs: 0, endTimeMs: 0, sessionId: null, metadata: {}, spans: [] } as never}
        traceB={{ id: 'b', agentId: 'agent', startTimeMs: 0, endTimeMs: 0, sessionId: null, metadata: {}, spans: [] } as never}
        spanDiff={{ added: [], removed: [], modified: [], unchanged: [] }}
      />,
    );

    expect(screen.getByText('Timeline Comparison')).toBeInTheDocument();
    expect(screen.getByText('No spans available to compare.')).toBeInTheDocument();
  });

  it('renders added, removed, and modified badges in populated comparisons', () => {
    render(
      <TimelineDiff
        traceA={{
          id: 'a',
          agentId: 'agent',
          startTimeMs: 0,
          endTimeMs: 10,
          sessionId: null,
          metadata: {},
          spans: [
            { traceId: 'a', spanId: 'old', name: 'old-step', kind: 'tool_call', startTimeMs: 0, endTimeMs: 1, status: 'ok', attributes: {}, events: [] },
            { traceId: 'a', spanId: 'mod-a', name: 'shared-step', kind: 'llm_call', startTimeMs: 1, endTimeMs: 3, status: 'ok', attributes: { cost: 0.1 }, events: [] },
          ],
        } as never}
        traceB={{
          id: 'b',
          agentId: 'agent',
          startTimeMs: 0,
          endTimeMs: 10,
          sessionId: null,
          metadata: {},
          spans: [
            { traceId: 'b', spanId: 'mod-b', name: 'shared-step', kind: 'llm_call', startTimeMs: 1, endTimeMs: 5, status: 'error', attributes: { cost: 0.2 }, events: [] },
            { traceId: 'b', spanId: 'new', name: 'new-step', kind: 'tool_call', startTimeMs: 5, endTimeMs: 6, status: 'ok', attributes: {}, events: [] },
          ],
        } as never}
        spanDiff={{
          added: [{ traceId: 'b', spanId: 'new', name: 'new-step', kind: 'tool_call', startTimeMs: 5, endTimeMs: 6, status: 'ok', attributes: {}, events: [] } as never],
          removed: [{ traceId: 'a', spanId: 'old', name: 'old-step', kind: 'tool_call', startTimeMs: 0, endTimeMs: 1, status: 'ok', attributes: {}, events: [] } as never],
          modified: [{ traceId: 'b', spanId: 'mod-b', name: 'shared-step', kind: 'llm_call', startTimeMs: 1, endTimeMs: 5, status: 'error', attributes: { cost: 0.2 }, events: [] } as never],
          unchanged: [],
        }}
      />,
    );

    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getAllByText('Modified').length).toBeGreaterThan(0);
  });
});
