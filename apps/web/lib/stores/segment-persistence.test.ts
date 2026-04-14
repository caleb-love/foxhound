import { beforeEach, describe, expect, it } from 'vitest';
import { clearPersistedSegments, loadPersistedSegments, persistSegments } from './segment-persistence';
import { createDefaultDashboardFilters } from './dashboard-filter-presets';

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

describe('segment-persistence', () => {
  beforeEach(() => {
    installMockLocalStorage();
    window.localStorage.clear();
  });

  it('persists and revives date ranges as Date objects', () => {
    const filters = createDefaultDashboardFilters();
    filters.severity = 'critical';

    persistSegments({
      currentSegmentName: 'Critical production issues',
      currentFilters: filters,
      savedSegments: [
        {
          id: 'seg-1',
          name: 'Critical production issues',
          filters,
        },
      ],
    });

    const restored = loadPersistedSegments();
    expect(restored?.currentSegmentName).toBe('Critical production issues');
    expect(restored?.currentFilters.dateRange.start).toBeInstanceOf(Date);
    expect(restored?.currentFilters.dateRange.end).toBeInstanceOf(Date);
    expect(restored?.savedSegments[0]?.filters.dateRange.start).toBeInstanceOf(Date);
    expect(restored?.currentFilters.severity).toBe('critical');
  });

  it('clears persisted segment state', () => {
    const filters = createDefaultDashboardFilters();

    persistSegments({
      currentSegmentName: 'All traffic',
      currentFilters: filters,
      savedSegments: [],
    });

    clearPersistedSegments();
    expect(loadPersistedSegments()).toBeNull();
  });
});
