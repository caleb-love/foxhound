# Foxhound Dashboard Chart System Plan

**Date:** 2026-04-14  
**Status:** Active  
**Scope:** Define reusable chart primitives, widget contracts, dashboard composition model, and first implementation slices for `apps/web`

---

## 1. Purpose

Turn the chart/graph brainstorm into an implementation-ready plan for the Foxhound web app.

This plan answers:
- which chart primitives to build first
- how to make them reusable across features
- which dashboards should ship first
- how widgets should be configured and saved
- what first implementation slice to code next

This is intentionally **implementation-first**, not just strategy prose.

---

## 2. Outcome

Foxhound should have a **small, reusable visualization system** that powers:
- Overview / executive summary
- Traces and trace detail
- Session Replay
- Run Diff
- Prompts
- Evaluators / Experiments / Datasets
- Budgets / SLAs / Regressions / Notifications

The chart system should feel like one coherent operator console, not separate micro-products.

---

## 3. Core Design Rule

**Do not create charts for pages. Create charts for operator questions.**

Every widget should answer one of these semantic questions:
1. **Volume** — how much activity is happening?
2. **Quality** — how well is it performing?
3. **Speed** — how fast / slow is it?
4. **Cost** — what is it costing and where?
5. **Change** — what shifted, regressed, or improved?

If a new visualization does not fit one of those categories, it may want to be:
- a table
- an event feed
- a replay UI
- a diff panel
- a form/config panel

---

## 4. Reusable Primitive Set

Build these as reusable component families under a new chart system area in `apps/web/components/`.

### P0 primitives

These are the minimum viable system.

#### 4.1 `MetricTile`
**Purpose:** one KPI + optional sparkline + delta + threshold state.

**Use in:**
- fleet overview
- executive summary
- budgets
- SLAs
- regressions
- evaluators
- prompts

**Props concept:**
- `label`
- `value`
- `delta`
- `deltaDirection`
- `sparklineData`
- `status`
- `threshold`
- `href`

---

#### 4.2 `TrendChart`
**Purpose:** time-series line/area chart with optional threshold, compare series, anomalies.

**Use in:**
- throughput
- success rate
- latency trend
- cost burn
- score trend
- SLA attainment
- regression count trend

**Props concept:**
- `title`
- `metric`
- `series`
- `timeRange`
- `thresholds`
- `compareSeries`
- `annotations`
- `onPointClick`

---

#### 4.3 `BreakdownChart`
**Purpose:** stacked bar/area or grouped bar for composition.

**Use in:**
- cost by model
- traffic by agent
- failures by type
- outcome mix by evaluator
- spend by prompt version

**Props concept:**
- `dimension`
- `series`
- `stacked`
- `orientation`
- `legend`
- `onSegmentClick`

---

#### 4.4 `TopNList`
**Purpose:** ranked list with bars, badges, and drilldown.

**Use in:**
- top hotspots
- top failing traces
- slowest agents
- most expensive prompts
- highest-severity regressions

**Props concept:**
- `title`
- `items`
- `metricLabel`
- `secondaryMetricLabel`
- `status`
- `hrefBuilder`

---

#### 4.5 `DistributionChart`
**Purpose:** histogram / bucketed distribution view.

**Use in:**
- latency distribution
- score distribution
- trace duration buckets
- token usage buckets
- tool-call count buckets

**Props concept:**
- `title`
- `buckets`
- `metric`
- `thresholds`
- `compareBuckets`

---

#### 4.6 `DiffScorecard`
**Purpose:** baseline vs comparison summary for key metrics.

**Use in:**
- run diff
- prompt compare
- regression analysis
- experiment compare
- release compare

**Props concept:**
- `baselineLabel`
- `comparisonLabel`
- `metrics`
- `narrative`
- `ctaLinks`

---

#### 4.7 `EventTimeline`
**Purpose:** ordered event stream with icons, statuses, metadata, and contextual links.

**Use in:**
- trace detail
- replay
- alert history
- deployment/recent changes
- notifications feed
- regression event stream

**Props concept:**
- `items`
- `variant`
- `grouping`
- `dense`
- `onItemClick`

---

### P1 primitives

#### 4.8 `HeatmapChart`
**Use in:** evaluator x agent, version x failure mode, hour x breach count, prompt x dataset slice.

#### 4.9 `ScatterCompareChart`
**Use in:** cost vs quality, quality vs latency, throughput vs failure rate.

#### 4.10 `FunnelChart`
**Use in:** production issue → dataset → experiment → promoted fix, workflow stage completion, alert handling.

#### 4.11 `ForecastOverlay`
**Use in:** budget projection, SLA risk projection, anticipated regression trend continuation.

### P2 primitives

#### 4.12 `CoordinationGraph`
**Use in:** multi-agent handoff maps, tool dependency graphs, specialized replay/debug moments.

Only build once the rest of the system is mature.

---

## 5. Shared Widget Contracts

Every primitive should share the same cross-widget contract where possible.

### 5.1 Scope contract

All widgets should be able to accept a common scope object.

```ts
interface DashboardScope {
  orgId?: string;
  environment?: string;
  timeRange?: '1h' | '24h' | '7d' | '30d' | '90d' | 'custom';
  agentId?: string;
  promptId?: string;
  promptVersionId?: string;
  evaluatorId?: string;
  datasetId?: string;
  experimentId?: string;
  model?: string;
  toolName?: string;
  status?: 'success' | 'error' | 'partial';
  tags?: string[];
}
```

### 5.2 Compare contract

Any widget that can compare should use one shared compare shape.

```ts
interface CompareScope {
  baseline?: DashboardScope;
  comparison?: DashboardScope;
  mode?: 'period' | 'version' | 'run' | 'prompt' | 'experiment';
}
```

### 5.3 Drilldown contract

All widgets should define what happens when a user clicks data.

```ts
interface DrilldownTarget {
  route: string;
  params?: Record<string, string>;
  searchParams?: Record<string, string>;
}
```

### 5.4 Threshold contract

```ts
interface ThresholdRule {
  label: string;
  value: number;
  direction: 'above_bad' | 'below_bad' | 'target';
  severity?: 'info' | 'warning' | 'critical';
}
```

---

## 6. Proposed File Structure

Add a reusable chart layer in `apps/web/components/charts/`.

```text
apps/web/components/
  charts/
    metric-tile.tsx
    trend-chart.tsx
    breakdown-chart.tsx
    top-n-list.tsx
    distribution-chart.tsx
    diff-scorecard.tsx
    event-timeline.tsx
    heatmap-chart.tsx
    scatter-compare-chart.tsx
    funnel-chart.tsx
    chart-shell.tsx
    chart-legend.tsx
    chart-empty-state.tsx
    chart-types.ts
    chart-utils.ts
```

Support dashboard composition in:

```text
apps/web/components/dashboard/
  dashboard-grid.tsx
  dashboard-widget.tsx
  dashboard-section.tsx
  widget-registry.ts
  widget-types.ts
```

This keeps chart primitives separate from feature-level dashboards.

---

## 7. Widget Registry Model

To support customizable dashboards, define widgets as data.

```ts
interface DashboardWidgetDefinition {
  id: string;
  type:
    | 'metric_tile'
    | 'trend_chart'
    | 'breakdown_chart'
    | 'top_n_list'
    | 'distribution_chart'
    | 'diff_scorecard'
    | 'event_timeline'
    | 'heatmap_chart'
    | 'scatter_compare_chart'
    | 'funnel_chart';
  title: string;
  description?: string;
  defaultSize: 'sm' | 'md' | 'lg' | 'xl';
  category: 'overview' | 'investigate' | 'improve' | 'govern';
  metricKey: string;
  supportsCompare?: boolean;
  supportsCustomScope?: boolean;
}
```

This will make it possible to:
- render opinionated dashboards
- pin widgets from feature pages
- save per-user dashboard layouts later

---

## 8. First Dashboards to Implement

### 8.1 Fleet Overview dashboard

**Why first:** highest leverage and reuses many P0 primitives.

**Widgets:**
- fleet health `MetricTile`
- success rate `MetricTile`
- monthly spend `MetricTile`
- critical alerts `MetricTile`
- success/failure `TrendChart`
- latency percentile `TrendChart`
- spend by agent/model `BreakdownChart`
- top regressions `TopNList`
- top cost hotspots `TopNList`
- alert feed `EventTimeline`

### 8.2 Budget / SLA governance dashboard

**Why second:** strong Foxhound differentiator and highly reusable.

**Widgets:**
- budget status KPI row
- burn trend + forecast
- cost composition breakdown
- SLA attainment trend
- breach event timeline
- at-risk agents list

### 8.3 Investigation summary dashboard

**Why third:** bridges overview to trace-level workflows.

**Widgets:**
- failing traces list
- recent changes event timeline
- compare candidates list
- latest regressions list
- replay candidates list

---

## 9. Named Widget Backlog

These should be treated as first-class backlog items, not implicit future work.

### Overview widgets
- `fleetHealthTile`
- `activeIncidentsTile`
- `budgetRiskTile`
- `slaRiskTile`
- `successRateTrend`
- `latencyPercentileTrend`
- `costBurnTrend`
- `costHotspotsList`
- `regressionSeverityList`
- `alertsTimeline`

### Investigate widgets
- `traceVolumeTrend`
- `errorTypeBreakdown`
- `traceDurationDistribution`
- `traceSpanComposition`
- `runDiffSummary`
- `executionDivergenceSummary`
- `replayStepTimeline`
- `replayStateDiffSummary`
- `promptVersionCompare`

### Improve widgets
- `evaluatorScoreTrend`
- `evaluatorOutcomeBreakdown`
- `scoreDistribution`
- `evaluatorAgentHeatmap`
- `experimentLeaderboard`
- `liftVsCostScatter`
- `datasetCoverageBreakdown`
- `productionToDatasetFunnel`

### Govern widgets
- `projectedSpendTrend`
- `costByModelBreakdown`
- `slaAttainmentTrend`
- `slaBreachHeatmap`
- `regressionTimeline`
- `versionShiftCompare`
- `notificationEventsTimeline`

---

## 10. Data Sourcing Strategy

### Short term

Use existing demo/dashboard data sources and existing feature dashboard patterns to stand up reusable chart shells quickly.

Likely source files to leverage:
- `apps/web/lib/demo-data.ts`
- `apps/web/lib/demo-data-advanced.ts`
- existing overview/budgets/evaluators/experiments components

### Medium term

Move widget data loading behind normalized dashboard selectors or server-side aggregators.

Target shape:
- widget-level metric adapters
- dashboard composition receives already-shaped data
- no page-specific bespoke transformation logic buried inside chart components

### Rule

**Chart components should not know Foxhound business logic.**
They should know how to render shaped data.

Business logic belongs in:
- feature adapters
- data selectors
- page/server loaders

---

## 11. Implementation Progress Update — 2026-04-14

### Completed in this session cluster

#### Shared chart primitives shipped
Implemented under `apps/web/components/charts/`:
- `chart-types.ts`
- `chart-shell.tsx`
- `metric-tile.tsx`
- `trend-chart.tsx`
- `top-n-list.tsx`
- `event-timeline.tsx`
- `diff-scorecard.tsx`

#### Dashboard surfaces migrated to shared primitives
- `components/overview/fleet-overview.tsx`
- `components/overview/executive-summary-dashboard.tsx`
- `components/budgets/budgets-govern-dashboard.tsx`
- `components/slas/slas-govern-dashboard.tsx`
- `components/regressions/regressions-dashboard.tsx`
- `components/datasets/datasets-dashboard.tsx`
- `components/evaluators/evaluators-dashboard.tsx`
- `components/experiments/experiments-dashboard.tsx`

#### Investigate surfaces partially migrated
- `components/traces/trace-detail-view.tsx` now uses segment-aware investigation links
- `components/replay/replay-detail-view.tsx` now uses segment-aware investigation links
- `components/traces/trace-table.tsx` now reads segment scope first, with legacy filter-store compatibility fallback

#### Verified slices
Focused passing Vitest coverage now exists across:
- chart/filter shell affected pages in overview/govern/improve surfaces
- trace table and compare selection behavior
- trace detail and replay detail segment-aware links
- command palette + sidebar + segment-aware links

### What remains for chart-system completion
- add richer chart primitives beyond P0/P1-lite (`distribution-chart`, `heatmap-chart`, `scatter-compare-chart`) when a real page needs them
- migrate `run-diff-view.tsx` onto the shared compare grammar more fully instead of keeping it mostly bespoke
- consider a widget registry/config model once dashboard customization is ready to move beyond saved segments and page-level layouts

## 12. Implementation Order

### Slice 1 — chart foundation
Build:
- `chart-types.ts`
- `chart-shell.tsx`
- `metric-tile.tsx`
- `trend-chart.tsx`
- `top-n-list.tsx`
- `event-timeline.tsx`

Done means:
- overview and governance pages can start using shared primitives

Verification:
- component tests
- responsive render sanity
- typecheck

### Slice 2 — fleet overview migration
Build:
- migrate fleet overview cards/lists to shared chart primitives
- add reusable KPI strip and trend sections

Done means:
- overview page uses the new chart system instead of bespoke cards where reasonable

Verification:
- targeted tests
- screenshot or local visual review
- typecheck

### Slice 3 — budget/SLA migration
Build:
- reusable burn trend and breakdown charts
- wire budgets and SLAs to the same chart grammar

Done means:
- governance surfaces visibly share a system with overview

### Slice 4 — diff/replay chartification
Build:
- `diff-scorecard.tsx`
- `distribution-chart.tsx`
- integrate into run diff and replay summary panels

Done means:
- Foxhound differentiators share the same reusable compare language

### Slice 5 — widget registry scaffolding
Build:
- dashboard widget registry
- dashboard section/grid components
- pinning-ready widget model

Done means:
- future custom dashboards become straightforward

---

## 13. Acceptance Criteria

This plan is successful when:
- at least 4 P0 primitives are implemented and reused across multiple pages
- Overview and at least one Govern page share chart components
- compare mode exists as a reusable UI pattern, not only one-off run diff UI
- new charts can be added without inventing a page-specific pattern each time
- future custom dashboards can be powered by a registry rather than hardcoded layouts alone

---

## 14. Recommended Immediate Next Slice

**Start with Slice 1 — chart foundation.**

Specifically:
1. create `apps/web/components/charts/chart-types.ts`
2. create `apps/web/components/charts/chart-shell.tsx`
3. implement `MetricTile`
4. implement `TrendChart`
5. implement `TopNList`
6. implement `EventTimeline`
7. migrate the fleet overview page to use those pieces where practical

Why this next:
- highest reuse value
- least risky
- unlocks all downstream dashboards
- gives Foxhound a consistent visual grammar fast

---

## 15. Resume Checklist

At the start of the next implementation session:
1. read this file
2. read `apps/web/CLAUDE.md`
3. inspect `apps/web/components/overview/` and `apps/web/components/budgets/`
4. scaffold `components/charts/`
5. keep component props generic and scope-friendly

---

## 16. Evidence Notes

This plan is grounded in:
- repo strategy docs for dashboard IA and workflow model
- existing differentiated product surfaces already present in Foxhound
- current `apps/web` route/component structure
- the chart/dashboard brainstorm artifact at `docs/plans/testing/2026-04-14-foxhound-chart-dashboard-brainstorm.html`
