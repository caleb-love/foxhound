import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DatasetsDashboard } from './datasets-dashboard';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const now = Date.now();

const datasets = [
  { id: 'ds_1', name: 'refund-edge-cases', description: 'Refund regression cases', itemCount: 42, sourceTraceIds: ['t1', 't2'], createdAt: new Date(now - 90 * 60 * 1000).toISOString() },
  { id: 'ds_2', name: 'onboarding-regressions', description: 'Onboarding flow regressions', itemCount: 18, sourceTraceIds: ['t3'], createdAt: new Date(now - 10 * 60 * 60 * 1000).toISOString() },
];

const olderDataset = { id: 'ds_3', name: 'legacy-dataset', description: 'Older dataset', itemCount: 5, sourceTraceIds: ['t4'], createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() };

describe('DatasetsDashboard', () => {
  beforeEach(() => {
    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: createDefaultDashboardFilters(),
      savedSegments: [],
    });
  });

  it('renders dataset table with names and item counts', () => {
    render(<DatasetsDashboard datasets={datasets} />);

    expect(screen.getByText('refund-edge-cases')).toBeInTheDocument();
    expect(screen.getByText('onboarding-regressions')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('shows verdict with dataset count', () => {
    render(<DatasetsDashboard datasets={datasets} />);

    expect(screen.getByText(/2 datasets with 60 total cases/)).toBeInTheDocument();
  });

  it('renders Improve workflow handoffs for dashboard routes', () => {
    render(<DatasetsDashboard datasets={datasets} />);

    expect(screen.getByRole('link', { name: /Create from traces/i })).toHaveAttribute('href', '/traces');
    expect(screen.getByRole('link', { name: /^Evaluators$/i })).toHaveAttribute('href', '/evaluators');
    expect(screen.getByRole('link', { name: /^Experiments$/i })).toHaveAttribute('href', '/experiments');
    expect(screen.getAllByRole('link', { name: /View/i })[0]).toHaveAttribute('href', '/datasets/ds_1');
    expect(screen.getAllByRole('link', { name: /Run/i })[0]).toHaveAttribute('href', '/experiments');
  });

  it('rewrites workflow handoffs for sandbox routes', () => {
    render(<DatasetsDashboard datasets={datasets} baseHref="/sandbox" />);

    expect(screen.getByRole('link', { name: /Create from traces/i })).toHaveAttribute('href', '/sandbox/traces');
    expect(screen.getByRole('link', { name: /^Evaluators$/i })).toHaveAttribute('href', '/sandbox/evaluators');
    expect(screen.getByRole('link', { name: /^Experiments$/i })).toHaveAttribute('href', '/sandbox/experiments');
    expect(screen.getAllByRole('link', { name: /View/i })[0]).toHaveAttribute('href', '/sandbox/datasets/ds_1');
    expect(screen.getAllByRole('link', { name: /Run/i })[0]).toHaveAttribute('href', '/sandbox/experiments');
  });

  it('shows empty state when no datasets exist', () => {
    render(<DatasetsDashboard datasets={[]} />);

    expect(screen.getByText(/No datasets yet/)).toBeInTheDocument();
  });

  it('keeps older datasets visible under the default date window', () => {
    render(<DatasetsDashboard datasets={[...datasets, olderDataset]} />);

    expect(screen.getByText('refund-edge-cases')).toBeInTheDocument();
    expect(screen.getByText('onboarding-regressions')).toBeInTheDocument();
    expect(screen.getByText('legacy-dataset')).toBeInTheDocument();
  });

  it('filters datasets by date range when the user explicitly changes the date window', () => {
    useSegmentStore.getState().updateCurrentFilters({
      dateRange: {
        start: new Date(now - 24 * 60 * 60 * 1000),
        end: new Date(now - 12 * 60 * 60 * 1000),
      },
    });

    render(<DatasetsDashboard datasets={[...datasets, olderDataset]} />);

    expect(screen.getByText('refund-edge-cases')).toBeInTheDocument();
    expect(screen.queryByText('onboarding-regressions')).not.toBeInTheDocument();
    expect(screen.queryByText('legacy-dataset')).not.toBeInTheDocument();
  });
});
