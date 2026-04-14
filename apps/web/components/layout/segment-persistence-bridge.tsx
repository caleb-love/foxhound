'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { loadPersistedSegments, persistSegments } from '@/lib/stores/segment-persistence';
import { useFilterStore } from '@/lib/stores/filter-store';
import { readSegmentFromSearchParams } from '@/lib/segment-url';

export function SegmentPersistenceBridge() {
  const searchParams = useSearchParams();
  const currentSegmentName = useSegmentStore((state) => state.currentSegmentName);
  const currentFilters = useSegmentStore((state) => state.currentFilters);
  const savedSegments = useSegmentStore((state) => state.savedSegments);

  useEffect(() => {
    const persisted = loadPersistedSegments();
    if (persisted) {
      useSegmentStore.setState({
        currentSegmentName: persisted.currentSegmentName,
        currentFilters: persisted.currentFilters,
        savedSegments: persisted.savedSegments,
      });

      useFilterStore.setState((state) => ({
        ...state,
        ...persisted.currentFilters,
      }));
    }

    const segmentName = readSegmentFromSearchParams(searchParams?.toString() ?? '');
    if (!segmentName) return;

    const segment = useSegmentStore.getState().savedSegments.find((item) => item.name === segmentName);
    if (!segment) return;

    useSegmentStore.getState().applySavedSegment(segment.id);
    useFilterStore.setState((state) => ({
      ...state,
      ...segment.filters,
    }));
  }, [searchParams]);

  useEffect(() => {
    persistSegments({ currentSegmentName, currentFilters, savedSegments });
  }, [currentSegmentName, currentFilters, savedSegments]);

  return null;
}
