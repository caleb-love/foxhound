import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExperimentsDashboard } from './experiments-dashboard';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const now = Date.now();

const experiments = [
  { id: 'exp_1', name: 'refund-prompt-v8', datasetId: 'ds_1', status: 'completed', summary: 'Testing prompt v8 against refund cases', winningCandidate: 'candidate-b', createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
  { id: 'exp_2', name: 'tone-routing-test', datasetId: 'ds_2', status: 'completed', summary: 'Comparing routing strategies for tone', winningCandidate: 'candidate-a', createdAt: new Date(now - 11 * 60 * 60 * 1000).toISOString() },
];

const olderExperiment = { id: 'exp_3', name: 'legacy-experiment', datasetId: 'ds_3', status: 'failed', summary: 'Older experiment run', createdAt: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString() };

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
    expect(screen.getAllByText('completed').length).toBe(2);
  });

  it('renders compare handoff links for completed experiments', () => {
    render(<ExperimentsDashboard experiments={experiments} />);

    expect(screen.getByRole('link', { name: /Compare top pair/i })).toHaveAttribute(
      'href',
      '/experiments/compare?experimentIds=exp_1%2Cexp_2',
    );
    expect(screen.getByRole('button', { name: /Compare experiments/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Compare$/i })[0]).toHaveAttribute(
      'href',
      '/experiments/compare?experimentIds=exp_1',
    );
    expect(screen.getAllByRole('link', { name: /^Compare$/i })[1]).toHaveAttribute(
      'href',
      '/experiments/compare?experimentIds=exp_2',
    );
  });

  it('shows verdict with experiment count', () => {
    render(<ExperimentsDashboard experiments={experiments} />);

    expect(screen.getByText(/2 experiments, 2 completed/)).toBeInTheDocument();
  });

  it('shows empty state when no experiments exist', () => {
    render(<ExperimentsDashboard experiments={[]} />);

    expect(screen.getByText(/No experiments yet/)).toBeInTheDocument();
  });

  it('keeps older experiments visible under the default date window', () => {
    render(<ExperimentsDashboard experiments={[...experiments, olderExperiment]} />);

    expect(screen.getByText('refund-prompt-v8')).toBeInTheDocument();
    expect(screen.getByText('tone-routing-test')).toBeInTheDocument();
    expect(screen.getByText('legacy-experiment')).toBeInTheDocument();
  });

  it('filters experiments by date range when the user explicitly changes the date window', () => {
    useSegmentStore.getState().updateCurrentFilters({
      dateRange: {
        start: new Date(now - 24 * 60 * 60 * 1000),
        end: new Date(now - 12 * 60 * 60 * 1000),
      },
    });

    render(<ExperimentsDashboard experiments={[...experiments, olderExperiment]} />);

    expect(screen.getByText('refund-prompt-v8')).toBeInTheDocument();
    expect(screen.queryByText('tone-routing-test')).not.toBeInTheDocument();
    expect(screen.queryByText('legacy-experiment')).not.toBeInTheDocument();
  });
});
