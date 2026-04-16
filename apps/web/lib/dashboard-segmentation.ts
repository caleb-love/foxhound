import type {
  DashboardFilters,
  SeverityFilter,
  StatusFilter,
} from "./stores/dashboard-filter-types";

function matchesSearch(text: string, query: string) {
  if (!query) return true;
  return text.toLowerCase().includes(query.toLowerCase());
}

function matchesStatus(status: string | undefined, filter: StatusFilter) {
  if (filter === "all") return true;
  if (!status) return true;
  if (filter === "success") return status === "healthy" || status === "success";
  if (filter === "error")
    return status === "critical" || status === "error" || status === "warning";
  return true;
}

function matchesSeverity(severity: string | undefined, filter: SeverityFilter) {
  if (filter === "all") return true;
  if (!severity) return true;
  return severity === filter;
}

function matchesArray(values: string[] | undefined, selected: string[]) {
  if (selected.length === 0) return true;
  if (!values || values.length === 0) return false;
  return values.some((value) => selected.includes(value));
}

export function filterByDashboardScope<T>(
  items: T[],
  filters: DashboardFilters,
  resolver: {
    searchableText: (item: T) => string;
    status?: (item: T) => string | undefined;
    severity?: (item: T) => string | undefined;
    agentIds?: (item: T) => string[];
    promptIds?: (item: T) => string[];
    datasetIds?: (item: T) => string[];
    models?: (item: T) => string[];
  },
) {
  return items.filter((item) => {
    if (!matchesSearch(resolver.searchableText(item), filters.searchQuery)) return false;
    if (!matchesStatus(resolver.status?.(item), filters.status)) return false;
    if (!matchesSeverity(resolver.severity?.(item), filters.severity)) return false;
    if (!matchesArray(resolver.agentIds?.(item), filters.agentIds)) return false;
    if (!matchesArray(resolver.promptIds?.(item), filters.promptIds)) return false;
    if (!matchesArray(resolver.datasetIds?.(item), filters.datasetIds)) return false;
    if (!matchesArray(resolver.models?.(item), filters.models)) return false;
    return true;
  });
}
