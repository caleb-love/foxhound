import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DashboardFilterBar } from './dashboard-filter-bar';
import { useFilterStore } from '@/lib/stores/filter-store';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';

const definitions: DashboardFilterDefinition[] = [
  {
    key: 'searchQuery',
    kind: 'search',
    label: 'Search',
    placeholder: 'Search dashboards...',
  },
  {
    key: 'status',
    kind: 'single-select',
    label: 'Status',
    options: [
      { value: 'all', label: 'All' },
      { value: 'success', label: 'Success' },
      { value: 'error', label: 'Error' },
    ],
  },
  {
    key: 'agentIds',
    kind: 'multi-select',
    label: 'Agents',
    options: [
      { value: 'planner-agent', label: 'planner-agent' },
      { value: 'support-agent', label: 'support-agent' },
    ],
  },
];

describe('DashboardFilterBar', () => {
  beforeEach(() => {
    useFilterStore.getState().clearFilters();
    useSegmentStore.getState().resetCurrentSegment();
  });

  it('renders configured filter controls', () => {
    render(<DashboardFilterBar definitions={definitions} />);

    expect(screen.getByPlaceholderText('Search dashboards...')).toBeInTheDocument();
    expect(screen.getByText('Status:')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Agents/i }).length).toBeGreaterThan(0);
  });

  it('updates shared search filter state', () => {
    render(<DashboardFilterBar definitions={definitions} />);

    fireEvent.change(screen.getByPlaceholderText('Search dashboards...'), {
      target: { value: 'planner' },
    });

    expect(useSegmentStore.getState().currentFilters.searchQuery).toBe('planner');
    expect(screen.getByText(/Search: "planner"/)).toBeInTheDocument();
  });
});
