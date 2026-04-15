'use client';

import { useEffect } from 'react';
import { createDateRangeFromHours } from '@/lib/stores/dashboard-filter-presets';
import { useFilterStore } from '@/lib/stores/filter-store';
import { useSegmentStore } from '@/lib/stores/segment-store';

export function SandboxTraceFilterReset() {
  useEffect(() => {
    const nextRange = createDateRangeFromHours(24 * 7);

    useSegmentStore.getState().updateCurrentFilters({
      dateRange: nextRange,
    });

    useFilterStore.getState().setDateRange(nextRange.start, nextRange.end);
  }, []);

  return null;
}
