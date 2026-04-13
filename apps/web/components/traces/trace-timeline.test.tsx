import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TraceTimeline } from './trace-timeline';

vi.mock('./span-detail-panel', () => ({
  SpanDetailPanel: ({ span, isOpen }: { span: { name?: string } | null; isOpen: boolean }) =>
    isOpen && span ? <div data-testid="span-detail-panel">Open: {span.name}</div> : null,
}));

describe('TraceTimeline', () => {
  it('renders empty state when there are no spans', () => {
    render(<TraceTimeline spans={[]} />);

    expect(screen.getByText('No spans in this trace')).toBeInTheDocument();
  });

  it('opens span detail panel when a span bar is clicked', () => {
    const spans = [
      {
        traceId: 'trace_1',
        spanId: 'span_1',
        name: 'Tool Search',
        kind: 'tool_call',
        startTimeMs: 0,
        endTimeMs: 1000,
        status: 'ok',
        attributes: {},
        events: [],
      },
    ];

    render(<TraceTimeline spans={spans as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'View details for Tool Search' }));
    expect(screen.getByTestId('span-detail-panel')).toHaveTextContent('Open: Tool Search');
  });
});
