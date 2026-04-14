import type { DashboardFilters } from './dashboard-filter-types';

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start, end };
}

export function createDefaultDashboardFilters(): DashboardFilters {
  return {
    status: 'all',
    severity: 'all',
    agentIds: [],
    environments: [],
    promptIds: [],
    promptVersionIds: [],
    evaluatorIds: [],
    datasetIds: [],
    models: [],
    toolNames: [],
    tags: [],
    searchQuery: '',
    dateRange: getDefaultDateRange(),
  };
}

export function createDateRangeFromHours(hours: number) {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  return { start, end };
}
