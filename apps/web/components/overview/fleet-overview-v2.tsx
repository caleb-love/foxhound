'use client';

import { useMemo, useState } from 'react';
import { Filter, X, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SegmentAwareLink } from '@/components/layout/segment-aware-link';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { createDefaultDashboardFilters } from '@/lib/stores/dashboard-filter-presets';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import { DEFAULT_DASHBOARD_DATE_PRESETS } from '@/lib/stores/dashboard-filter-presets';
import {
  computeFleetVerdict,
  computeDelta,
  type FleetMetrics,
} from '@/lib/verdict-engine';
import type { SparkPoint } from '@/components/charts/chart-types';
import { FleetVerdictBar } from './fleet-verdict-bar';
import { MetricStrip, type MetricStripItem } from './metric-strip';
import { ActionQueue } from './action-queue';
import { SandboxQuickBar } from './sandbox-quick-bar';
import { PageContainer } from '@/components/system/page';
import { StackedBarChart } from '@/components/charts/stacked-bar-chart';
import { TrendChart } from '@/components/charts/trend-chart';
import { ViewModeToggle } from '@/components/charts/view-mode-toggle';

// ---------------------------------------------------------------------------
// Prop Types
// ---------------------------------------------------------------------------

export interface FleetMetricInput {
  label: string;
  value: string;
  numericValue: number;
  previousValue?: number;
  higherIsBetter: boolean;
  tone?: 'default' | 'healthy' | 'warning' | 'critical';
  sparklineData?: SparkPoint[];
  href?: string;
}

export interface FleetActionItem {
  title: string;
  context: string;
  severity: 'critical' | 'warning' | 'healthy';
  agentIds: string[];
  actions: Array<{ label: string; href: string }>;
}

export interface FleetOverviewV2Props {
  fleetMetrics: FleetMetrics;
  metricCards: FleetMetricInput[];
  actionItems: FleetActionItem[];
  demoMode?: boolean;
}

// ---------------------------------------------------------------------------
// Filter definitions
// ---------------------------------------------------------------------------

const overviewFilters: DashboardFilterDefinition[] = [
  {
    key: 'searchQuery',
    kind: 'search',
    label: 'Search',
    placeholder: 'Search agents, prompts, incidents, or traces...',
  },
  {
    key: 'status',
    kind: 'single-select',
    label: 'Status',
    options: [
      { value: 'all', label: 'All' },
      { value: 'success', label: 'Healthy' },
      { value: 'error', label: 'Needs attention' },
    ],
  },
  {
    key: 'severity',
    kind: 'single-select',
    label: 'Severity',
    options: [
      { value: 'all', label: 'All severities' },
      { value: 'healthy', label: 'Healthy' },
      { value: 'warning', label: 'Warning' },
      { value: 'critical', label: 'Critical' },
    ],
  },
  {
    key: 'agentIds',
    kind: 'multi-select',
    label: 'Agents',
    options: [
      { value: 'planner-agent', label: 'planner-agent' },
      { value: 'support-agent', label: 'support-agent' },
      { value: 'onboarding-router', label: 'onboarding-router' },
    ],
  },
  {
    key: 'dateRange',
    kind: 'date-preset',
    label: 'Date range',
    presets: DEFAULT_DASHBOARD_DATE_PRESETS,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FleetOverviewV2({
  fleetMetrics,
  metricCards,
  actionItems,
  demoMode = false,
}: FleetOverviewV2Props) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [groupBy, setGroupBy] = useState('agent');
  const filters = useSegmentStore((state) => state.currentFilters);
  const currentSegmentName = useSegmentStore((state) => state.currentSegmentName);
  const setCurrentFilters = useSegmentStore((state) => state.setCurrentFilters);
  const setCurrentSegmentName = useSegmentStore((state) => state.setCurrentSegmentName);

  // Compute verdict
  const verdict = computeFleetVerdict(fleetMetrics);

  // Build metric strip items with deltas
  const metricStripItems: MetricStripItem[] = metricCards.map((card) => ({
    label: card.label,
    value: card.value,
    delta: computeDelta(card.numericValue, card.previousValue, card.higherIsBetter),
    sparklineData: card.sparklineData,
    href: card.href,
    tone: card.tone,
  }));

  // Filter action items
  const filteredActions = filterByDashboardScope(actionItems, filters, {
    searchableText: (item) => `${item.title} ${item.context}`,
    severity: (item) => item.severity,
    status: (item) => (item.severity === 'healthy' ? 'healthy' : item.severity === 'critical' ? 'critical' : 'warning'),
    agentIds: (item) => item.agentIds,
  });

  const hasActiveFilters =
    filters.searchQuery !== '' ||
    filters.status !== 'all' ||
    filters.severity !== 'all' ||
    filters.agentIds.length > 0;

  const concentrationData = useMemo(() => {
    if (groupBy === 'severity') {
      return [
        {
          label: 'Current posture',
          healthy: filteredActions.filter((item) => item.severity === 'healthy').length,
          warning: filteredActions.filter((item) => item.severity === 'warning').length,
          critical: filteredActions.filter((item) => item.severity === 'critical').length,
          drillIn: {
            href: filters.severity === 'critical'
              ? (demoMode ? '/sandbox/regressions' : '/regressions')
              : filters.severity === 'warning'
                ? (demoMode ? '/sandbox/slas' : '/slas')
                : (demoMode ? '/sandbox/traces' : '/traces'),
          },
        },
      ];
    }

    const grouped = new Map<string, { label: string; healthy: number; warning: number; critical: number }>();
    for (const item of filteredActions) {
      const keys = groupBy === 'agent' ? item.agentIds : [item.actions[0]?.label ?? 'Workflow'];
      for (const key of keys) {
        const existing = grouped.get(key) ?? { label: key, healthy: 0, warning: 0, critical: 0 };
        existing[item.severity] += 1;
        grouped.set(key, existing);
      }
    }
    return [...grouped.values()].sort((a, b) => (b.critical + b.warning + b.healthy) - (a.critical + a.warning + a.healthy)).slice(0, 5).map((entry) => ({
      ...entry,
      drillIn: groupBy === 'agent'
        ? {
            onClick: () => {
              const defaults = createDefaultDashboardFilters();
              setCurrentFilters({ ...defaults, agentIds: [entry.label] });
              setCurrentSegmentName(`${entry.label} drill-in`);
            },
          }
        : {
            href: groupBy === 'workflow'
              ? entry.label.toLowerCase().includes('budget')
                ? (demoMode ? '/sandbox/budgets' : '/budgets')
                : entry.label.toLowerCase().includes('sla')
                  ? (demoMode ? '/sandbox/slas' : '/slas')
                  : entry.label.toLowerCase().includes('regression') || entry.label.toLowerCase().includes('trace')
                    ? (demoMode ? '/sandbox/traces' : '/traces')
                    : (demoMode ? '/sandbox/experiments' : '/experiments')
              : undefined,
          },
    }));
  }, [demoMode, filteredActions, filters.severity, groupBy, setCurrentFilters, setCurrentSegmentName]);

  const segmentationScale = Math.max(1, filteredActions.length || actionItems.length || 1);
  const riskTrendSeries = [
    {
      id: 'reliability',
      label: 'Reliability posture',
      tone: metricCards[0]?.tone === 'critical' ? 'critical' as const : metricCards[0]?.tone === 'warning' ? 'warning' as const : 'healthy' as const,
      values: metricCards[0]?.sparklineData?.map((point, index) => ({ label: `P${index + 1}`, value: Number((point.value * (filteredActions.length > 0 ? filteredActions.length / segmentationScale : 1)).toFixed(2)) })) ?? [],
      href: demoMode ? '/sandbox/traces' : '/traces',
      cta: 'Open traces',
    },
    {
      id: 'regressions',
      label: 'Regression pressure',
      tone: metricCards[1]?.tone === 'critical' ? 'critical' as const : metricCards[1]?.tone === 'warning' ? 'warning' as const : 'healthy' as const,
      values: metricCards[1]?.sparklineData?.map((point, index) => ({ label: `P${index + 1}`, value: Number((point.value * (filteredActions.filter((item) => item.severity !== 'healthy').length / segmentationScale || 1)).toFixed(2)) })) ?? [],
      href: demoMode ? '/sandbox/regressions' : '/regressions',
      cta: 'Review regressions',
    },
    {
      id: 'budget',
      label: 'Budget pressure',
      tone: metricCards[3]?.tone === 'critical' ? 'critical' as const : metricCards[3]?.tone === 'warning' ? 'warning' as const : 'healthy' as const,
      values: metricCards[3]?.sparklineData?.map((point, index) => ({ label: `P${index + 1}`, value: Number((point.value * (filteredActions.filter((item) => item.severity === 'critical').length / segmentationScale || 1)).toFixed(2)) })) ?? [],
      href: demoMode ? '/sandbox/budgets' : '/budgets',
      cta: 'Open budgets',
    },
  ];

  return (
    <PageContainer>
      {/* 1. Verdict bar */}
      <FleetVerdictBar
        verdict={verdict}
        trailing={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--tenant-panel-stroke)' }}
            >
              <Filter className="h-3.5 w-3.5" style={{ color: 'var(--tenant-text-muted)' }} />
              <span style={{ color: 'var(--tenant-text-secondary)' }}>Filter</span>
              {hasActiveFilters ? (
                <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-[10px]">
                  Active
                </Badge>
              ) : null}
            </button>
            {currentSegmentName !== 'All traffic' ? (
              <Badge variant="outline" className="text-[11px]">
                {currentSegmentName}
              </Badge>
            ) : null}
          </div>
        }
      />

      {/* 2. Collapsed filter bar (only when open) */}
      {filterOpen ? (
        <div className="relative">
          <DashboardFilterBar definitions={overviewFilters} />
          <button
            type="button"
            onClick={() => setFilterOpen(false)}
            className="absolute right-3 top-3 rounded-md p-1 transition-colors hover:bg-white/[0.06]"
            aria-label="Close filters"
          >
            <X className="h-4 w-4 text-tenant-text-muted" />
          </button>
        </div>
      ) : null}

      {/* 3. Risk metrics strip */}
      <MetricStrip items={metricStripItems} />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <ViewModeToggle
            label="Group concentration by"
            value={groupBy}
            options={[
              { value: 'agent', label: 'Agent' },
              { value: 'workflow', label: 'Workflow' },
              { value: 'severity', label: 'Severity' },
            ]}
            onChange={setGroupBy}
          />
          <StackedBarChart
            title="Risk concentration"
            description="See where active risk is concentrated before jumping into traces or regressions. Segmentation should change the dominant owner, not just the total count."
            data={concentrationData}
          />
        </div>
        <TrendChart
          title="Risk posture trend band"
          description="Read whether reliability, regressions, and budget pressure are moving together or independently before escalating the wrong issue."
          series={riskTrendSeries}
        />
      </div>

      {/* 4. Unified action queue */}
      <ActionQueue items={filteredActions} />

      {/* 5. Cross-link to Executive Summary */}
      <div className="flex items-center justify-end">
        <SegmentAwareLink
          href={demoMode ? '/sandbox/executive' : '/executive'}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-white/5"
        >
          <BarChart3 className="h-3.5 w-3.5 text-tenant-text-muted" />
          <span style={{ color: 'var(--tenant-text-secondary)' }}>Executive summary</span>
        </SegmentAwareLink>
      </div>

      {/* 6. Sandbox floating toolbar (replaces full-width section) */}
      {demoMode ? <SandboxQuickBar /> : null}
    </PageContainer>
  );
}
