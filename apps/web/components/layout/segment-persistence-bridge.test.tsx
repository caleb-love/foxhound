import { beforeEach, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { SegmentPersistenceBridge } from './segment-persistence-bridge';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { useFilterStore } from '@/lib/stores/filter-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';

function installMockLocalStorage() {
  const storage = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

describe('SegmentPersistenceBridge', () => {
  beforeEach(() => {
    installMockLocalStorage();
    window.localStorage.clear();

    const defaults = createDefaultDashboardFilters();
    useSegmentStore.setState({
      currentSegmentName: 'All traffic',
      currentFilters: defaults,
      savedSegments: [],
    });
    useFilterStore.getState().clearFilters();
  });

  it('hydrates persisted segment state into both stores', async () => {
    const filters = createDefaultDashboardFilters();
    filters.severity = 'critical';
    filters.agentIds = ['planner-agent'];

    window.localStorage.setItem(
      'foxhound.saved-segments.v1',
      JSON.stringify({
        currentSegmentName: 'Critical planner issues',
        currentFilters: {
          ...filters,
          dateRange: {
            start: filters.dateRange.start.toISOString(),
            end: filters.dateRange.end.toISOString(),
          },
        },
        savedSegments: [
          {
            id: 'seg-1',
            name: 'Critical planner issues',
            filters: {
              ...filters,
              dateRange: {
                start: filters.dateRange.start.toISOString(),
                end: filters.dateRange.end.toISOString(),
              },
            },
          },
        ],
      }),
    );

    render(<SegmentPersistenceBridge />);

    await waitFor(() => {
      expect(useSegmentStore.getState().currentSegmentName).toBe('Critical planner issues');
      expect(useSegmentStore.getState().currentFilters.severity).toBe('critical');
      expect(useSegmentStore.getState().currentFilters.agentIds).toEqual(['planner-agent']);
      expect(useFilterStore.getState().severity).toBe('critical');
      expect(useFilterStore.getState().agentIds).toEqual(['planner-agent']);
      expect(useSegmentStore.getState().currentFilters.dateRange.start).toBeInstanceOf(Date);
    });
  });
});
