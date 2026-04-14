export type StatusFilter = 'all' | 'success' | 'error';
export type SeverityFilter = 'all' | 'healthy' | 'warning' | 'critical';

export interface DashboardDateRange {
  start: Date;
  end: Date;
}

export interface DashboardFilters {
  status: StatusFilter;
  severity: SeverityFilter;
  agentIds: string[];
  environments: string[];
  promptIds: string[];
  promptVersionIds: string[];
  evaluatorIds: string[];
  datasetIds: string[];
  models: string[];
  toolNames: string[];
  tags: string[];
  searchQuery: string;
  dateRange: DashboardDateRange;
}

export type DashboardFilterKey = keyof DashboardFilters;

export interface DashboardFilterOption {
  value: string;
  label: string;
}

export type DashboardFilterDefinition =
  | {
      key: 'searchQuery';
      kind: 'search';
      label: string;
      placeholder?: string;
    }
  | {
      key: 'status' | 'severity';
      kind: 'single-select';
      label: string;
      options: DashboardFilterOption[];
    }
  | {
      key:
        | 'agentIds'
        | 'environments'
        | 'promptIds'
        | 'promptVersionIds'
        | 'evaluatorIds'
        | 'datasetIds'
        | 'models'
        | 'toolNames'
        | 'tags';
      kind: 'multi-select';
      label: string;
      options: DashboardFilterOption[];
    }
  | {
      key: 'dateRange';
      kind: 'date-preset';
      label: string;
      presets: Array<{ label: string; hours: number }>;
    };
