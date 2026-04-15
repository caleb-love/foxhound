import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OperatorCommandPalette } from './operator-command-palette';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const push = vi.fn();
const usePathname = vi.fn();

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);
vi.stubGlobal('scrollIntoView', vi.fn());
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

const useSearchParams = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => usePathname(),
  useSearchParams: () => useSearchParams(),
}));

describe('OperatorCommandPalette', () => {
  beforeEach(() => {
    push.mockReset();
    useSearchParams.mockReturnValue(new URLSearchParams(''));
    useSegmentStore.setState({
      currentSegmentName: 'Planner agent',
      currentFilters: createDefaultDashboardFilters(),
      savedSegments: [],
    });
  });

  it('opens from the quick jump trigger and navigates to a selected route', () => {
    usePathname.mockReturnValue('/');
    render(<OperatorCommandPalette />);

    fireEvent.click(screen.getByRole('button', { name: /open operator command palette/i }));

    expect(screen.getByText('Fleet Overview')).toBeInTheDocument();
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Regressions'));

    expect(push).toHaveBeenCalledWith('/regressions?segment=Planner+agent');
  });

  it('routes session replay to the replay index instead of traces', () => {
    usePathname.mockReturnValue('/');
    render(<OperatorCommandPalette />);

    fireEvent.click(screen.getByRole('button', { name: /open operator command palette/i }));
    fireEvent.click(screen.getByText('Session Replay'));

    expect(push).toHaveBeenCalledWith('/replay?segment=Planner+agent');
  });

  it('opens with keyboard shortcut and marks current route', () => {
    usePathname.mockReturnValue('/datasets');
    render(<OperatorCommandPalette />);

    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  it('uses a seeded sandbox diff route when selected from sandbox mode', () => {
    usePathname.mockReturnValue('/sandbox/prompts');
    render(<OperatorCommandPalette />);

    fireEvent.click(screen.getByRole('button', { name: /open operator command palette/i }));
    fireEvent.click(screen.getByText('Run Diff'));

    expect(push).toHaveBeenCalledWith(
      '/sandbox/diff?a=trace_support_refund_v17_baseline&b=trace_support_refund_v18_regression&segment=Planner+agent',
    );
  });
});
