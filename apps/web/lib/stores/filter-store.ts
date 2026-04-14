/**
 * Shared dashboard filter state.
 *
 * Backwards compatibility: this store still exports the trace-list fields and actions
 * that current surfaces already use, while extending to a reusable cross-dashboard model.
 */

import { create } from 'zustand';
import {
  createDateRangeFromHours,
  createDefaultDashboardFilters,
} from './dashboard-filter-presets';
import type {
  DashboardFilterKey,
  DashboardFilters,
  SeverityFilter,
  StatusFilter,
} from './dashboard-filter-types';

interface FilterState extends DashboardFilters {
  setStatus: (status: StatusFilter) => void;
  setSeverity: (severity: SeverityFilter) => void;
  setAgentIds: (agentIds: string[]) => void;
  setDateRange: (start: Date, end: Date) => void;
  setSearchQuery: (query: string) => void;
  setStringArrayFilter: (
    key:
      | 'agentIds'
      | 'environments'
      | 'promptIds'
      | 'promptVersionIds'
      | 'evaluatorIds'
      | 'datasetIds'
      | 'models'
      | 'toolNames'
      | 'tags',
    values: string[],
  ) => void;
  clearFilters: () => void;
  resetDateRangeToLast24Hours: () => void;
}

export type { StatusFilter, SeverityFilter } from './dashboard-filter-types';

export const useFilterStore = create<FilterState>((set) => ({
  ...createDefaultDashboardFilters(),
  setStatus: (status) => set({ status }),
  setSeverity: (severity) => set({ severity }),
  setAgentIds: (agentIds) => set({ agentIds }),
  setDateRange: (start, end) => set({ dateRange: { start, end } }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setStringArrayFilter: (key, values) => set({ [key]: values } as Pick<DashboardFilters, typeof key>),
  clearFilters: () => set(createDefaultDashboardFilters()),
  resetDateRangeToLast24Hours: () => set({ dateRange: createDateRangeFromHours(24) }),
}));
