import { create } from "zustand";
import { createDefaultDashboardFilters } from "./dashboard-filter-presets";
import type { DashboardFilters } from "./dashboard-filter-types";

export interface SavedSegment {
  id: string;
  name: string;
  description?: string;
  filters: DashboardFilters;
}

interface SegmentState {
  currentSegmentName: string;
  savedSegments: SavedSegment[];
  currentFilters: DashboardFilters;
  setCurrentFilters: (filters: DashboardFilters) => void;
  updateCurrentFilters: (partial: Partial<DashboardFilters>) => void;
  setCurrentSegmentName: (name: string) => void;
  resetCurrentSegment: () => void;
  saveCurrentSegment: (name: string, description?: string) => void;
  applySavedSegment: (segmentId: string) => void;
  deleteSavedSegment: (segmentId: string) => void;
}

const defaultFilters = createDefaultDashboardFilters();

const seededSegments: SavedSegment[] = [
  {
    id: "seg-critical-prod",
    name: "Critical production issues",
    description: "Critical severity issues in the last 24 hours.",
    filters: {
      ...defaultFilters,
      severity: "critical",
    },
  },
  {
    id: "seg-planner-agent",
    name: "Planner agent",
    description: "Focused view on planner-agent behavior and cost.",
    filters: {
      ...defaultFilters,
      agentIds: ["planner-agent"],
    },
  },
];

export const useSegmentStore = create<SegmentState>((set, get) => ({
  currentSegmentName: "All traffic",
  savedSegments: seededSegments,
  currentFilters: defaultFilters,
  setCurrentFilters: (filters) => set({ currentFilters: filters }),
  updateCurrentFilters: (partial) =>
    set((state) => ({ currentFilters: { ...state.currentFilters, ...partial } })),
  setCurrentSegmentName: (name) => set({ currentSegmentName: name }),
  resetCurrentSegment: () =>
    set({ currentSegmentName: "All traffic", currentFilters: createDefaultDashboardFilters() }),
  saveCurrentSegment: (name, description) =>
    set((state) => ({
      currentSegmentName: name,
      savedSegments: [
        {
          id: `segment-${Date.now()}`,
          name,
          description,
          filters: state.currentFilters,
        },
        ...state.savedSegments,
      ],
    })),
  applySavedSegment: (segmentId) => {
    const segment = get().savedSegments.find((item) => item.id === segmentId);
    if (!segment) return;

    set({ currentSegmentName: segment.name, currentFilters: segment.filters });
  },
  deleteSavedSegment: (segmentId) =>
    set((state) => ({
      savedSegments: state.savedSegments.filter((segment) => segment.id !== segmentId),
    })),
}));
