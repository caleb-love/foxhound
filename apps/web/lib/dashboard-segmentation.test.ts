import { describe, expect, it } from "vitest";
import { filterByDashboardScope } from "./dashboard-segmentation";
import { createDefaultDashboardFilters } from "./stores/dashboard-filter-presets";

const items = [
  {
    id: "a",
    title: "Planner regression",
    description: "Critical planner behavior drift",
    severity: "critical",
    agentIds: ["planner-agent"],
    promptIds: ["planner-routing"],
    models: ["claude-3-5-sonnet"],
  },
  {
    id: "b",
    title: "Support warning",
    description: "Support prompt latency drift",
    severity: "warning",
    agentIds: ["support-agent"],
    promptIds: ["support-routing"],
    models: ["gpt-4o"],
  },
];

describe("filterByDashboardScope", () => {
  it("filters by search query", () => {
    const filters = createDefaultDashboardFilters();
    filters.searchQuery = "planner";

    const result = filterByDashboardScope(items, filters, {
      searchableText: (item) => `${item.title} ${item.description}`,
      severity: (item) => item.severity,
      status: (item) => item.severity,
      agentIds: (item) => item.agentIds,
      promptIds: (item) => item.promptIds,
      models: (item) => item.models,
    });

    expect(result.map((item) => item.id)).toEqual(["a"]);
  });

  it("filters by severity and agent", () => {
    const filters = createDefaultDashboardFilters();
    filters.severity = "warning";
    filters.agentIds = ["support-agent"];

    const result = filterByDashboardScope(items, filters, {
      searchableText: (item) => `${item.title} ${item.description}`,
      severity: (item) => item.severity,
      status: (item) => item.severity,
      agentIds: (item) => item.agentIds,
      promptIds: (item) => item.promptIds,
      models: (item) => item.models,
    });

    expect(result.map((item) => item.id)).toEqual(["b"]);
  });
});
