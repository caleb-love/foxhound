import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NotificationsGovernDashboard } from './notifications-govern-dashboard';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const channels = [
  { channelId: 'ch_1', channelName: '#ops-alerts', kind: 'slack', status: 'healthy', summary: 'Primary alert channel' },
  { channelId: 'ch_2', channelName: '#eng-alerts', kind: 'slack', status: 'warning', summary: 'Secondary channel, degraded' },
];

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
});
