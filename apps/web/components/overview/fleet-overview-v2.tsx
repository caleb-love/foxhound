'use client';

import { useState } from 'react';
import { Filter, X, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SegmentAwareLink } from '@/components/layout/segment-aware-link';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { filterByDashboardScope } from '@/lib/dashboard-segmentation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import type { DashboardFilterDefinition } from '@/lib/stores/dashboard-filter-types';
import {
  computeFleetVerdict,
  computeDelta,
  type FleetMetrics,
} from '@/lib/verdict-engine';
import type { SparkPoint } from '@/components/charts/chart-types';
import { FleetVerdictBar } from './fleet-verdict-bar';
import { MetricStrip, type MetricStripItem } from './metric-strip';
import { ActionQueue, type ActionQueueItem } from './action-queue';
import { SandboxQuickBar } from './sandbox-quick-bar';
import { PageContainer } from '@/components/system/page';

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
    presets: [
      { label: 'Last 24h', hours: 24 },
      { label: 'Last 7d', hours: 24 * 7 },
      { label: 'Last 30d', hours: 24 * 30 },
    ],
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
  const filters = useSegmentStore((state) => state.currentFilters);
  const currentSegmentName = useSegmentStore((state) => state.currentSegmentName);

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
