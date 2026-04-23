import type { DashboardDatePreset, DashboardFilters } from "./dashboard-filter-types";

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start, end };
}

export function createDefaultDashboardFilters(): DashboardFilters {
  return {
    status: "all",
    severity: "all",
    agentIds: [],
    environments: [],
    promptIds: [],
    promptVersionIds: [],
    evaluatorIds: [],
    datasetIds: [],
    models: [],
    toolNames: [],
    tags: [],
    searchQuery: "",
    dateRange: getDefaultDateRange(),
  };
}

export const DEFAULT_DASHBOARD_DATE_PRESETS: DashboardDatePreset[] = [
  { label: "Last 24h", durationHours: 24 },
  { label: "Last 7d", durationHours: 24 * 7 },
  { label: "Last 30d", durationHours: 24 * 30 },
];

export function createDateRangeFromHours(hours: number) {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  return { start, end };
}

export function createDateRangeFromPreset(preset: DashboardDatePreset) {
  return createDateRangeFromHours(preset.durationHours);
}

export function getMatchingDatePresetLabel(
  dateRange: DashboardFilters["dateRange"],
  presets: DashboardDatePreset[],
  toleranceMs = 5 * 60 * 1000,
) {
  const durationMs = dateRange.end.getTime() - dateRange.start.getTime();
  return (
    presets.find(
      (preset) => Math.abs(durationMs - preset.durationHours * 60 * 60 * 1000) <= toleranceMs,
    )?.label ?? null
  );
}
