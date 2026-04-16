/**
 * Global state for trace comparison
 */

import { create } from "zustand";

interface CompareState {
  selectedTraceIds: string[];
  traceAId: string | null;
  traceBId: string | null;

  // Actions
  toggleTrace: (traceId: string) => void;
  clearSelection: () => void;
  canCompare: () => boolean;
  setTraceSlot: (slot: "a" | "b", traceId: string) => void;
  setComparePair: (traceAId: string, traceBId: string) => void;
  swapComparePair: () => void;
}

export const useCompareStore = create<CompareState>((set, get) => ({
  selectedTraceIds: [],
  traceAId: null,
  traceBId: null,

  toggleTrace: (traceId) =>
    set((state) => {
      const isSelected = state.selectedTraceIds.includes(traceId);

      if (isSelected) {
        const nextSelectedTraceIds = state.selectedTraceIds.filter((id) => id !== traceId);
        const [traceAId, traceBId] = nextSelectedTraceIds;
        return {
          selectedTraceIds: nextSelectedTraceIds,
          traceAId: traceAId ?? null,
          traceBId: traceBId ?? null,
        };
      }

      const nextSelectedTraceIds =
        state.selectedTraceIds.length >= 2
          ? [state.selectedTraceIds[1], traceId]
          : [...state.selectedTraceIds, traceId];
      const [traceAId, traceBId] = nextSelectedTraceIds;

      return {
        selectedTraceIds: nextSelectedTraceIds,
        traceAId: traceAId ?? null,
        traceBId: traceBId ?? null,
      };
    }),

  clearSelection: () => set({ selectedTraceIds: [], traceAId: null, traceBId: null }),

  canCompare: () => {
    const { traceAId, traceBId, selectedTraceIds } = get();
    if (traceAId && traceBId) return true;
    return selectedTraceIds.length === 2;
  },

  setTraceSlot: (slot, traceId) =>
    set((state) => {
      const nextTraceAId = slot === "a" ? traceId : state.traceAId;
      const nextTraceBId = slot === "b" ? traceId : state.traceBId;
      const nextSelectedTraceIds = [nextTraceAId, nextTraceBId].filter((id): id is string =>
        Boolean(id),
      );
      return {
        traceAId: nextTraceAId,
        traceBId: nextTraceBId,
        selectedTraceIds: nextSelectedTraceIds,
      };
    }),

  setComparePair: (traceAId, traceBId) =>
    set({
      traceAId,
      traceBId,
      selectedTraceIds: [traceAId, traceBId],
    }),

  swapComparePair: () =>
    set((state) => ({
      traceAId: state.traceBId,
      traceBId: state.traceAId,
      selectedTraceIds: [state.traceBId, state.traceAId].filter((id): id is string => Boolean(id)),
    })),
}));
