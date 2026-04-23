import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SlasGovernDashboard } from './slas-govern-dashboard';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const now = Date.now();

const slas = [
  { agentId: 'support-agent', maxDurationMs: 10000, minSuccessRate: 0.95, observedDurationMs: 8500, observedSuccessRate: 0.97, status: 'healthy', summary: 'Within SLA targets', updatedAt: new Date(now - 18 * 60 * 60 * 1000).toISOString() },
  { agentId: 'billing-agent', maxDurationMs: 5000, minSuccessRate: 0.99, observedDurationMs: 6200, observedSuccessRate: 0.91, status: 'critical', summary: 'Latency and success rate both breached', updatedAt: new Date(now - 8 * 60 * 60 * 1000).toISOString() },
];

const olderSla = { agentId: 'legacy-agent', maxDurationMs: 7000, minSuccessRate: 0.9, observedDurationMs: 6500, observedSuccessRate: 0.92, status: 'healthy', summary: 'Older SLA sample', updatedAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString() };

describe('SlasGovernDashboard', () => {
  beforeEach(() => {
    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: createDefaultDashboardFilters(),
      savedSegments: [],
    });
  });

  it('renders SLA table with agent names', () => {
    render(<SlasGovernDashboard slas={slas} />);

    expect(screen.getByText('support-agent')).toBeInTheDocument();
    expect(screen.getByText('billing-agent')).toBeInTheDocument();
  });

  it('shows verdict about at-risk SLAs', () => {
    render(<SlasGovernDashboard slas={slas} />);

    expect(screen.getByText(/1 SLA at risk/)).toBeInTheDocument();
  });

  it('shows empty state when no SLAs configured', () => {
    render(<SlasGovernDashboard slas={[]} />);

    expect(screen.getByText(/No SLAs configured/)).toBeInTheDocument();
  });

  it('keeps older SLA rows visible under the default date window', () => {
    render(<SlasGovernDashboard slas={[...slas, olderSla]} />);

    expect(screen.getByText('support-agent')).toBeInTheDocument();
    expect(screen.getByText('billing-agent')).toBeInTheDocument();
    expect(screen.getByText('legacy-agent')).toBeInTheDocument();
  });

  it('filters SLA rows by date range when the user explicitly changes the date window', () => {
    useSegmentStore.getState().updateCurrentFilters({
      dateRange: {
        start: new Date(now - 24 * 60 * 60 * 1000),
        end: new Date(now - 12 * 60 * 60 * 1000),
      },
    });

    render(<SlasGovernDashboard slas={[...slas, olderSla]} />);

    expect(screen.getByText('support-agent')).toBeInTheDocument();
    expect(screen.queryByText('billing-agent')).not.toBeInTheDocument();
    expect(screen.queryByText('legacy-agent')).not.toBeInTheDocument();
  });
});
