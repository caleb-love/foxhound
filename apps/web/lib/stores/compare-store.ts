/**
 * Global state for trace comparison
 */

import { create } from 'zustand';

interface CompareState {
  selectedTraceIds: string[];
  
  // Actions
  toggleTrace: (traceId: string) => void;
  clearSelection: () => void;
  canCompare: () => boolean;
}

export const useCompareStore = create<CompareState>((set, get) => ({
  selectedTraceIds: [],
  
  toggleTrace: (traceId) =>
    set((state) => {
      const isSelected = state.selectedTraceIds.includes(traceId);
      
      if (isSelected) {
        // Deselect
        return {
          selectedTraceIds: state.selectedTraceIds.filter((id) => id !== traceId),
        };
      } else {
        // Select (max 2)
        if (state.selectedTraceIds.length >= 2) {
          // Replace oldest with newest
          return {
            selectedTraceIds: [state.selectedTraceIds[1], traceId],
          };
        }
        return {
          selectedTraceIds: [...state.selectedTraceIds, traceId],
        };
      }
    }),
  
  clearSelection: () => set({ selectedTraceIds: [] }),
  
  canCompare: () => get().selectedTraceIds.length === 2,
}));
