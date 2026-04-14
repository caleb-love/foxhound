import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SegmentAwareLink, useSegmentAwareHref } from './segment-aware-link';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const useSearchParams = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => useSearchParams(),
}));

function HrefProbe({ href }: { href: string }) {
  const nextHref = useSegmentAwareHref(href);
  return <div>{nextHref}</div>;
}

describe('SegmentAwareLink', () => {
  beforeEach(() => {
    useSearchParams.mockReturnValue(new URLSearchParams('foo=bar'));
    useSegmentStore.setState({
      currentSegmentName: 'Planner agent',
      currentFilters: createDefaultDashboardFilters(),
      savedSegments: [],
    });
  });

  it('preserves the active segment in generated hrefs', () => {
    render(<HrefProbe href="/regressions" />);
    expect(screen.getByText('/regressions?foo=bar&segment=Planner+agent')).toBeInTheDocument();
  });

  it('renders a link with segment-aware href', () => {
    render(<SegmentAwareLink href="/traces">Open traces</SegmentAwareLink>);
    expect(screen.getByRole('link', { name: 'Open traces' })).toHaveAttribute('href', '/traces?foo=bar&segment=Planner+agent');
  });

  it('omits the segment query for all traffic', () => {
    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: createDefaultDashboardFilters(),
      savedSegments: [],
    });

    render(<HrefProbe href="/budgets" />);
    expect(screen.getByText('/budgets?foo=bar')).toBeInTheDocument();
  });
});
