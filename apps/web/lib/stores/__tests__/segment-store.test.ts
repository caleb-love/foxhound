import { beforeEach, describe, expect, it } from "vitest";
import { useSegmentStore } from "../segment-store";
import { createDefaultDashboardFilters } from "../dashboard-filter-presets";

describe("useSegmentStore", () => {
  beforeEach(() => {
    const defaults = createDefaultDashboardFilters();
    useSegmentStore.setState({
      currentSegmentName: "All traffic",
      savedSegments: [
        {
          id: "seg-critical-prod",
          name: "Critical production issues",
          description: "Critical severity issues in the last 24 hours.",
          filters: { ...defaults, severity: "critical" },
        },
      ],
      currentFilters: defaults,
    });
  });

  it("starts with all traffic segment", () => {
    const state = useSegmentStore.getState();
    expect(state.currentSegmentName).toBe("All traffic");
  });

  it("saves current segment with current filters", () => {
    const state = useSegmentStore.getState();
    state.updateCurrentFilters({ agentIds: ["planner-agent"], severity: "warning" });
    state.saveCurrentSegment("Planner warning");

    const next = useSegmentStore.getState();
    expect(next.currentSegmentName).toBe("Planner warning");
    expect(next.savedSegments[0]?.name).toBe("Planner warning");
    expect(next.savedSegments[0]?.filters.agentIds).toEqual(["planner-agent"]);
    expect(next.savedSegments[0]?.filters.severity).toBe("warning");
  });

  it("applies a saved segment", () => {
    const state = useSegmentStore.getState();
    state.applySavedSegment("seg-critical-prod");

    const next = useSegmentStore.getState();
    expect(next.currentSegmentName).toBe("Critical production issues");
    expect(next.currentFilters.severity).toBe("critical");
  });

  it("resets to all traffic", () => {
    const state = useSegmentStore.getState();
    state.updateCurrentFilters({ severity: "critical", agentIds: ["planner-agent"] });
    state.resetCurrentSegment();

    const next = useSegmentStore.getState();
    expect(next.currentSegmentName).toBe("All traffic");
    expect(next.currentFilters.severity).toBe("all");
    expect(next.currentFilters.agentIds).toEqual([]);
  });
});
