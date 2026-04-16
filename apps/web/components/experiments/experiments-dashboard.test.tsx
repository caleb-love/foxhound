import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExperimentsDashboard } from './experiments-dashboard';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const experiments = [
  { id: 'exp_1', name: 'refund-prompt-v8', datasetId: 'ds_1', status: 'completed', summary: 'Testing prompt v8 against refund cases', winningCandidate: 'candidate-b' },
  { id: 'exp_2', name: 'tone-routing-test', datasetId: 'ds_2', status: 'running', summary: 'Comparing routing strategies for tone' },
];

describe('ExperimentsDashboard', () => {
  beforeEach(() => {
    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: createDefaultDashboardFilters(),
      savedSegments: [],
    });
  });

  it('renders experiment table with names and status', () => {
    render(<ExperimentsDashboard experiments={experiments} />);

    expect(screen.getByText('refund-prompt-v8')).toBeInTheDocument();
    expect(screen.getByText('tone-routing-test')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('shows verdict with experiment count', () => {
    render(<ExperimentsDashboard experiments={experiments} />);

    expect(screen.getByText(/2 experiments, 1 completed/)).toBeInTheDocument();
  });

  it('shows empty state when no experiments exist', () => {
    render(<ExperimentsDashboard experiments={[]} />);

    expect(screen.getByText(/No experiments yet/)).toBeInTheDocument();
  });
});
