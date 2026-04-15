import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useFilterStore } from '@/lib/stores/filter-store';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/sandbox/traces',
  useRouter: () => ({ push }),
}));

describe('sandbox traces page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const defaults = createDefaultDashboardFilters();
    defaults.dateRange = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(Date.now()),
    };

    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: defaults,
      savedSegments: [],
    });

    useFilterStore.setState({
      status: defaults.status,
      severity: defaults.severity,
      agentIds: defaults.agentIds,
      environments: defaults.environments,
      promptIds: defaults.promptIds,
      promptVersionIds: defaults.promptVersionIds,
      evaluatorIds: defaults.evaluatorIds,
      datasetIds: defaults.datasetIds,
      models: defaults.models,
      toolNames: defaults.toolNames,
      tags: defaults.tags,
      dateRange: defaults.dateRange,
      searchQuery: defaults.searchQuery,
    });
  });

  it('syncs both filter stores to the sandbox corpus timeline and renders seeded traces', async () => {
    const { default: SandboxTracesPage } = await import('./page');
    render(<SandboxTracesPage />);

    expect(screen.getByText(/Review 568 seeded sandbox traces across 7 days/i)).toBeInTheDocument();
    expect(screen.getAllByText('Shipping Delay Resolution').length).toBeGreaterThan(0);

    await waitFor(() => {
      const segmentRange = useSegmentStore.getState().currentFilters.dateRange;
      const legacyRange = useFilterStore.getState().dateRange;

      expect(segmentRange.start.getTime()).toBe(1775599200000);
      expect(segmentRange.end.getTime()).toBe(1776153180000);
      expect(legacyRange.start.getTime()).toBe(1775599200000);
      expect(legacyRange.end.getTime()).toBe(1776153180000);
    });
  });
});
