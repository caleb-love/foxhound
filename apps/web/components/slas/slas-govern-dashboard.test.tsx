import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SlasGovernDashboard } from './slas-govern-dashboard';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const slas = [
  { agentId: 'support-agent', maxDurationMs: 10000, minSuccessRate: 0.95, observedDurationMs: 8500, observedSuccessRate: 0.97, status: 'healthy', summary: 'Within SLA targets' },
  { agentId: 'billing-agent', maxDurationMs: 5000, minSuccessRate: 0.99, observedDurationMs: 6200, observedSuccessRate: 0.91, status: 'critical', summary: 'Latency and success rate both breached' },
];

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
});
