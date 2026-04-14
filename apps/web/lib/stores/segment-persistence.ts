import type { SavedSegment } from './segment-store';
import type { DashboardFilters } from './dashboard-filter-types';

const STORAGE_KEY = 'foxhound.saved-segments.v1';

interface PersistedSegmentState {
  currentSegmentName: string;
  currentFilters: DashboardFilters;
  savedSegments: SavedSegment[];
}

function reviveDates(filters: DashboardFilters): DashboardFilters {
  return {
    ...filters,
    dateRange: {
      start: new Date(filters.dateRange.start),
      end: new Date(filters.dateRange.end),
    },
  };
}

function serializeDates(filters: DashboardFilters) {
  return {
    ...filters,
    dateRange: {
      start: filters.dateRange.start.toISOString(),
      end: filters.dateRange.end.toISOString(),
    },
  };
}

export function loadPersistedSegments(): PersistedSegmentState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSegmentState;
    return {
      ...parsed,
      currentFilters: reviveDates(parsed.currentFilters),
      savedSegments: parsed.savedSegments.map((segment) => ({
        ...segment,
        filters: reviveDates(segment.filters),
      })),
    };
  } catch {
    return null;
  }
}

export function persistSegments(state: PersistedSegmentState) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        currentFilters: serializeDates(state.currentFilters),
        savedSegments: state.savedSegments.map((segment) => ({
          ...segment,
          filters: serializeDates(segment.filters),
        })),
      }),
    );
  } catch {
    // ignore persistence failures for now
  }
}

export function clearPersistedSegments() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore persistence failures for now
  }
}
