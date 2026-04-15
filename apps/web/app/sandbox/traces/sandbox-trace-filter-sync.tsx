'use client';

import { useEffect } from 'react';
import { useFilterStore } from '@/lib/stores/filter-store';
import { useSegmentStore } from '@/lib/stores/segment-store';

interface SandboxTraceFilterSyncProps {
  startTimeMs: number;
  endTimeMs: number;
}

export function SandboxTraceFilterSync({ startTimeMs, endTimeMs }: SandboxTraceFilterSyncProps) {
  useEffect(() => {
    const nextDateRange = {
      start: new Date(startTimeMs),
      end: new Date(endTimeMs),
    };

    useSegmentStore.getState().updateCurrentFilters({
      dateRange: nextDateRange,
    });

    useFilterStore.getState().setDateRange(nextDateRange.start, nextDateRange.end);
  }, [startTimeMs, endTimeMs]);

  return null;
}
