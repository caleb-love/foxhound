import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DatasetsDashboard } from './datasets-dashboard';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const datasets = [
  { id: 'ds_1', name: 'refund-edge-cases', description: 'Refund regression cases', itemCount: 42, sourceTraceIds: ['t1', 't2'] },
  { id: 'ds_2', name: 'onboarding-regressions', description: 'Onboarding flow regressions', itemCount: 18, sourceTraceIds: ['t3'] },
];

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

  it('shows empty state when no datasets exist', () => {
    render(<DatasetsDashboard datasets={[]} />);

    expect(screen.getByText(/No datasets yet/)).toBeInTheDocument();
  });
});
