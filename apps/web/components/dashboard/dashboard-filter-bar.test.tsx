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
  {
    key: 'dateRange',
    kind: 'date-preset',
    label: 'Date range',
    presets: [
      { label: 'Last 24h', durationHours: 24 },
      { label: 'Last 7d', durationHours: 24 * 7 },
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
    expect(screen.getByText('Last 24h')).toBeInTheDocument();
  });

  it('updates shared search filter state', () => {
    render(<DashboardFilterBar definitions={definitions} />);

    fireEvent.change(screen.getByPlaceholderText('Search dashboards...'), {
      target: { value: 'planner' },
    });

    expect(useSegmentStore.getState().currentFilters.searchQuery).toBe('planner');
    expect(screen.getByText(/Search: "planner"/)).toBeInTheDocument();
  });

  it('shows the matching date preset label from the current date range', () => {
    const now = Date.now();
    useSegmentStore.getState().updateCurrentFilters({
      dateRange: {
        start: new Date(now - 7 * 24 * 60 * 60 * 1000),
        end: new Date(now),
      },
    });

    render(<DashboardFilterBar definitions={definitions} />);

    expect(screen.getByText('Last 7d')).toBeInTheDocument();
    expect(screen.getByText('Date: Last 7d')).toBeInTheDocument();
  });
});
