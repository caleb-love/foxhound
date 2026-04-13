/**
 * Global filter state for trace list
 */

import { create } from 'zustand';

export type StatusFilter = 'all' | 'success' | 'error';

interface FilterState {
  // Filters
  status: StatusFilter;
  agentIds: string[];
  dateRange: {
    start: Date;
    end: Date;
  };
  searchQuery: string;

  // Actions
  setStatus: (status: StatusFilter) => void;
  setAgentIds: (agentIds: string[]) => void;
  setDateRange: (start: Date, end: Date) => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;
}

const now = new Date();
const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

export const useFilterStore = create<FilterState>((set) => ({
  // Initial state
  status: 'all',
  agentIds: [],
  dateRange: {
    start: last24h,
    end: now,
  },
  searchQuery: '',

  // Actions
  setStatus: (status) => set({ status }),
  setAgentIds: (agentIds) => set({ agentIds }),
  setDateRange: (start, end) => set({ dateRange: { start, end } }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clearFilters: () =>
    set({
      status: 'all',
      agentIds: [],
      dateRange: { start: last24h, end: now },
      searchQuery: '',
    }),
}));
