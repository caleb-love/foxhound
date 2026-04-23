import type {
  SegmentationQuery,
  SegmentationSeverityFilter,
  SegmentationStatusFilter,
} from "@foxhound/types";

export type StatusFilter = SegmentationStatusFilter;
export type SeverityFilter = SegmentationSeverityFilter;

export interface DashboardDateRange {
  start: Date;
  end: Date;
}

export interface DashboardDatePreset {
  label: string;
  durationHours: number;
}

export interface DashboardFilters {
  status: StatusFilter;
  severity: SeverityFilter;
  agentIds: NonNullable<SegmentationQuery["agentIds"]>;
  environments: NonNullable<SegmentationQuery["environmentIds"]>;
  promptIds: NonNullable<SegmentationQuery["promptIds"]>;
  promptVersionIds: NonNullable<SegmentationQuery["promptVersionIds"]>;
  evaluatorIds: NonNullable<SegmentationQuery["evaluatorIds"]>;
  datasetIds: NonNullable<SegmentationQuery["datasetIds"]>;
  models: NonNullable<SegmentationQuery["modelIds"]>;
  toolNames: NonNullable<SegmentationQuery["toolNames"]>;
  tags: NonNullable<SegmentationQuery["tags"]>;
  searchQuery: NonNullable<SegmentationQuery["searchQuery"]>;
  dateRange: DashboardDateRange;
}

export type DashboardFilterKey = keyof DashboardFilters;

export interface DashboardFilterOption {
  value: string;
  label: string;
}

export type DashboardFilterDefinition =
  | {
      key: "searchQuery";
      kind: "search";
      label: string;
      placeholder?: string;
    }
  | {
      key: "status" | "severity";
      kind: "single-select";
      label: string;
      options: DashboardFilterOption[];
    }
  | {
      key:
        | "agentIds"
        | "environments"
        | "promptIds"
        | "promptVersionIds"
        | "evaluatorIds"
        | "datasetIds"
        | "models"
        | "toolNames"
        | "tags";
      kind: "multi-select";
      label: string;
      options: DashboardFilterOption[];
    }
  | {
      key: "dateRange";
      kind: "date-preset";
      label: string;
      presets: DashboardDatePreset[];
    };
