import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NotificationsGovernDashboard } from './notifications-govern-dashboard';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const now = Date.now();

const channels = [
  { channelId: 'ch_1', channelName: '#ops-alerts', kind: 'slack', status: 'healthy', summary: 'Primary alert channel', updatedAt: new Date(now - 18 * 60 * 60 * 1000).toISOString() },
  { channelId: 'ch_2', channelName: '#eng-alerts', kind: 'slack', status: 'warning', summary: 'Secondary channel, degraded', updatedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString() },
];

const olderChannel = { channelId: 'ch_3', channelName: '#nightly-alerts', kind: 'slack', status: 'healthy', summary: 'Old channel activity', updatedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString() };

describe('NotificationsGovernDashboard', () => {
  beforeEach(() => {
    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: createDefaultDashboardFilters(),
      savedSegments: [],
    });
  });

  it('renders notification channels', () => {
    render(<NotificationsGovernDashboard channels={channels} />);

    expect(screen.getByText('#ops-alerts')).toBeInTheDocument();
    expect(screen.getByText('#eng-alerts')).toBeInTheDocument();
  });

  it('shows verdict about channel health', () => {
    render(<NotificationsGovernDashboard channels={channels} />);

    expect(screen.getByText(/2 channels configured, 1 healthy/)).toBeInTheDocument();
  });

  it('shows empty state when no channels', () => {
    render(<NotificationsGovernDashboard channels={[]} />);

    expect(screen.getByText(/No notification channels/)).toBeInTheDocument();
  });

  it('keeps older channels visible under the default date window', () => {
    render(<NotificationsGovernDashboard channels={[...channels, olderChannel]} />);

    expect(screen.getByText('#ops-alerts')).toBeInTheDocument();
    expect(screen.getByText('#eng-alerts')).toBeInTheDocument();
    expect(screen.getByText('#nightly-alerts')).toBeInTheDocument();
  });

  it('filters channels by date range when the user explicitly changes the date window', () => {
    useSegmentStore.getState().updateCurrentFilters({
      dateRange: {
        start: new Date(now - 24 * 60 * 60 * 1000),
        end: new Date(now - 12 * 60 * 60 * 1000),
      },
    });

    render(<NotificationsGovernDashboard channels={[...channels, olderChannel]} />);

    expect(screen.getByText('#ops-alerts')).toBeInTheDocument();
    expect(screen.queryByText('#eng-alerts')).not.toBeInTheDocument();
    expect(screen.queryByText('#nightly-alerts')).not.toBeInTheDocument();
  });
});
