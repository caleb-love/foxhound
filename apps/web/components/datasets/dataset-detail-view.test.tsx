import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DatasetDetailView } from './dataset-detail-view';

const dataset = {
  id: 'ds_1',
  orgId: 'org_1',
  name: 'support-routing-regressions',
  description: 'Trace-derived support routing failures used for evaluator and experiment validation.',
  createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  itemCount: 2,
};

const items = [
  {
    id: 'dsi_1',
    datasetId: 'ds_1',
    input: { ticket: 'Order delayed' },
    expectedOutput: { action: 'escalate' },
    sourceTraceId: 'trace_123',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'dsi_2',
    datasetId: 'ds_1',
    input: { ticket: 'Refund request' },
    expectedOutput: { action: 'refund_review' },
    createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
];

describe('DatasetDetailView', () => {
  it('renders dataset detail context and item inspection', () => {
    render(<DatasetDetailView dataset={dataset as never} items={items as never} />);

    expect(screen.getByText('support-routing-regressions')).toBeInTheDocument();
    expect(screen.getByText('Dataset items')).toBeInTheDocument();
    expect(screen.getByText('trace-derived')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open source trace/i })).toHaveAttribute('href', '/traces/trace_123');
    expect(screen.getByText(/Trace-derived support routing failures/i)).toBeInTheDocument();
  });

  it('uses dashboard handoffs by default', () => {
    render(<DatasetDetailView dataset={dataset as never} items={items as never} />);

    expect(screen.getByRole('link', { name: /Return to datasets/i })).toHaveAttribute('href', '/datasets');
    expect(screen.getByRole('link', { name: /Review evaluator coverage/i })).toHaveAttribute('href', '/evaluators');
    expect(screen.getByRole('link', { name: /Launch or inspect experiments/i })).toHaveAttribute('href', '/experiments');
    expect(screen.getByRole('link', { name: /Return to source traces/i })).toHaveAttribute('href', '/traces');
    expect(screen.getByRole('link', { name: /Open source trace/i })).toHaveAttribute('href', '/traces/trace_123');
  });

  it('uses the provided baseHref for sandbox detail links', () => {
    render(<DatasetDetailView dataset={dataset as never} items={items as never} baseHref="/sandbox" />);

    expect(screen.getByRole('link', { name: /Return to datasets/i })).toHaveAttribute('href', '/sandbox/datasets');
    expect(screen.getByRole('link', { name: /Review evaluator coverage/i })).toHaveAttribute('href', '/sandbox/evaluators');
    expect(screen.getByRole('link', { name: /Launch or inspect experiments/i })).toHaveAttribute('href', '/sandbox/experiments');
    expect(screen.getByRole('link', { name: /Return to source traces/i })).toHaveAttribute('href', '/sandbox/traces');
    expect(screen.getByRole('link', { name: /Open source trace/i })).toHaveAttribute('href', '/sandbox/traces/trace_123');
  });

  it('renders empty-state guidance when there are no dataset items', () => {
    render(<DatasetDetailView dataset={{ ...dataset, itemCount: 0 } as never} items={[] as never} />);

    expect(screen.getByText(/This dataset has no visible items yet/i)).toBeInTheDocument();
  });
});
