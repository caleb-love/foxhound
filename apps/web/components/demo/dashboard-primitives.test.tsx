import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardPage } from './dashboard-primitives';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

describe('DashboardPage', () => {
  beforeEach(() => {
    useSegmentStore.setState({
      currentSegmentName: 'Planner agent',
      currentFilters: createDefaultDashboardFilters(),
      savedSegments: [],
    });
  });

  it('renders the current segment badge in page chrome', () => {
    render(
      <DashboardPage eyebrow="Overview" title="Fleet Overview" description="Testing segment chrome">
        <div>Child content</div>
      </DashboardPage>,
    );

    expect(screen.getByText('Segment: Planner agent')).toBeInTheDocument();
    expect(screen.getByText('Fleet Overview')).toBeInTheDocument();
  });
});
