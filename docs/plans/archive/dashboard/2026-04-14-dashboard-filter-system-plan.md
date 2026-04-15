# Foxhound Dashboard Filter System Plan

**Date:** 2026-04-14  
**Status:** Active  
**Scope:** Shared, extensible dashboard filters for `apps/web`

---

## 1. Goal

Create a consistent filter system that can be applied across dashboard surfaces and chart widgets without page-by-page reinvention.

This system must support:
- one shared filter grammar across overview, traces, budgets, SLAs, regressions, diff, and future pages
- easy addition of new filter dimensions later
- page-level opt-in to only the filters that matter on that surface
- widget-level reuse of the active filter scope

---

## 2. Core Rule

**Filters are data, not hardcoded UI.**

Each page should declare which filter dimensions it supports.
The filter UI should render from those definitions.
The store should hold one normalized filter state shape.

---

## 3. Shared filter dimensions

Initial shared dimensions:
- `status`
- `agentIds`
- `dateRange`
- `searchQuery`
- `environments`
- `promptIds`
- `promptVersionIds`
- `evaluatorIds`
- `datasetIds`
- `models`
- `toolNames`
- `severity`
- `tags`

Not every page needs every dimension. That is fine.

---

## 4. Architecture

### 4.1 Store
Use one shared dashboard filter store with:
- normalized state
- typed setters by dimension
- reset/clear behavior
- page/widget scoping later if needed

### 4.2 Config-driven UI
Each page declares a list of filter definitions, for example:
- search
- status select
- agent multi-select
- date preset select
- severity select

### 4.3 Reuse strategy
Charts and pages should read the same resolved filter scope.
That makes it easy to apply active filters consistently across KPI tiles, trends, lists, and diff views.

---

## 5. First implementation slice

1. Upgrade the current trace-only filter store into a reusable dashboard filter store while preserving current compatibility fields.
2. Add shared filter types/config helpers.
3. Keep trace filters working.
4. Add one reusable dashboard filter bar component that can be reused by overview/governance pages.
5. Migrate at least one non-trace surface to use the shared filter bar.

---

## 6. Progress Update — 2026-04-14

### Completed in this session cluster

#### Shared filter contracts + store
Implemented:
- `apps/web/lib/stores/dashboard-filter-types.ts`
- `apps/web/lib/stores/dashboard-filter-presets.ts`
- upgraded `apps/web/lib/stores/filter-store.ts`
- added `apps/web/components/dashboard/dashboard-filter-bar.tsx`

The filter model now supports reusable dimensions such as:
- `status`
- `severity`
- `agentIds`
- `environments`
- `promptIds`
- `promptVersionIds`
- `evaluatorIds`
- `datasetIds`
- `models`
- `toolNames`
- `tags`
- `searchQuery`
- `dateRange`

#### Segmentation evolved from filters into product state
Implemented:
- `apps/web/lib/stores/segment-store.ts`
- `apps/web/lib/stores/segment-persistence.ts`
- `apps/web/components/layout/segment-switcher.tsx`
- `apps/web/components/layout/segment-persistence-bridge.tsx`
- `apps/web/lib/segment-url.ts`
- `apps/web/components/layout/segment-aware-link.tsx`

Capabilities now include:
- active segment scope
- saved segments
- persistence across reloads via localStorage
- URL-aware saved segment hydration using `?segment=<name>`
- segment-aware action links, command palette navigation, and sidebar navigation
- shared page chrome showing current segment

#### Segment-aware surfaces now in scope
Overview / govern / investigate / improve surfaces now read segment scope across:
- Fleet Overview
- Executive Summary
- Budgets
- SLAs
- Regressions
- Datasets
- Prompts
- Evaluators
- Experiments
- Traces (segment-first read path with compatibility fallback)
- Trace detail action cards
- Replay detail action cards

#### Verification completed
Focused passing tests now cover:
- filter store
- segment store
- dashboard filter bar
- persistence + persistence bridge
- segment URL helpers
- segment-aware links
- sidebar + command palette segment continuity
- representative page integrations across overview/govern/improve/investigate

### Remaining work
- reduce the long-term dual-store compatibility path between `useSegmentStore` and `useFilterStore`
- consider richer shareability later (beyond saved segment name in URL) only if product needs it
- move from local-only persistence to org/user-backed saved segments when API/storage work is prioritized
- extend segment-aware routing to any remaining raw `<a href>` surfaces not yet migrated

## 7. Extensibility rule

Adding a new filter later should normally require only:
1. add a new typed key to the shared filter state
2. add a filter definition config entry
3. optionally expose it on a page's allowed filter list

It should **not** require rewriting page-local filter state from scratch.
