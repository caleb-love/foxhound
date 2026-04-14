# Shared Demo Domain Module Plan

**Date:** 2026-04-13  
**Status:** Active  
**Purpose:** Define the recommended shared demo-domain package that can power both the web app demo mode and the future marketing-site interactive demo.

## Decision summary

**Recommendation:** Create a shared workspace package instead of keeping demo fixtures inside `apps/web`.

### Proposed package
`packages/demo-domain`

This package should own:

- demo org definitions
- scenario definitions
- curated traces
- run-diff pair definitions
- replay target registry
- prompts and versions
- regression records
- datasets and representative dataset items
- evaluator and experiment fixtures
- governance fixtures (budgets, SLAs, notifications)
- derived rollup builders for overview/executive/demo summaries

### Why this is the right move

You already expect the seed data to become a **demo mode on the marketing website**. If the data lives only in `apps/web/lib/*`, you will eventually duplicate logic, drift story content, and lose narrative consistency.

A shared package gives you:

- one source of truth for demo scenarios
- portable data across app surfaces
- consistent screenshots, local review, and marketing demos
- testability independent of Next.js page code
- cleaner separation between domain fixtures and presentation

---

## Why not leave it in `apps/web/lib`

Current demo data lives in:

- `apps/web/lib/demo-data.ts`
- `apps/web/lib/demo-data-advanced.ts`

That was fine for a UI-only demo phase, but it is now too narrow because:

1. the product story spans many surfaces beyond traces
2. the future consumer is not just `apps/web`
3. some demo records are domain entities, not page-local UI fixtures
4. marketing/demo-site use will want the same canonical story data

Keeping the demo model inside `apps/web` would make the marketing handoff harder and encourage partial rewrites.

---

## Why a new package instead of `@foxhound/types`

Do **not** put demo fixtures in `@foxhound/types`.

`@foxhound/types` should stay focused on shared domain contracts and type definitions.

Demo content is:

- data-rich
- scenario-oriented
- partially opinionated
- likely to grow fast
- likely to include builders, selectors, and projections

That makes it a bad fit for a pure types package.

---

## Why a package instead of docs-site-owned code

The future marketing demo may live in or near the docs/marketing surface, but the demo story itself should not be owned by `docs-site` because:

- the same story needs to power local product review in `apps/web`
- web app QA should not depend on docs-site implementation details
- docs-site is a consumer, not the source of truth

---

## Proposed package responsibilities

## 1. Core demo catalog

Exports stable definitions for:

- orgs
- users/personas
- agents
- prompts and prompt versions
- curated scenarios
- curated trace IDs
- run-diff pairs
- replay targets

## 2. Scenario materialization

Exports builders that turn scenario definitions into concrete records such as:

- `Trace[]`
- prompt metadata
- regression rows
- evaluator rows
- experiment rows
- budget hotspot rows
- SLA risk rows
- notification channel rows

## 3. Page projections

Exports projection functions tailored to consumers, for example:

- `buildFleetOverviewDemo(orgId)`
- `buildExecutiveSummaryDemo(orgId)`
- `buildTraceTableDemo(orgId)`
- `buildBudgetsDemo(orgId)`
- `buildExperimentsDemo(orgId)`

These are not UI components. They are demo-ready view-model builders.

## 4. Consumer-safe content selection

Exports subsets for different surfaces:

- `fullLocalReviewDemo`
- `marketingHeroDemo`
- `marketingLiteDemo`

This will matter later when the marketing site needs a smaller, faster, more legible subset than the full app demo mode.

---

## Proposed package structure

```text
packages/demo-domain/
  package.json
  tsconfig.json
  src/
    index.ts

    types.ts

    catalog/
      orgs.ts
      agents.ts
      prompts.ts
      scenarios.ts
      curated-traces.ts
      diff-pairs.ts
      replay-targets.ts
      regressions.ts
      datasets.ts
      evaluators.ts
      experiments.ts
      governance.ts

    builders/
      trace-builder.ts
      prompt-builder.ts
      overview-builder.ts
      executive-summary-builder.ts
      regressions-builder.ts
      datasets-builder.ts
      evaluators-builder.ts
      experiments-builder.ts
      budgets-builder.ts
      slas-builder.ts
      notifications-builder.ts

    projections/
      local-review.ts
      marketing-hero.ts
      marketing-lite.ts

    generators/
      background-support-traffic.ts
      background-code-review-traffic.ts
      background-research-traffic.ts

    utils/
      ids.ts
      time.ts
      random.ts
      narrative-consistency.ts
```

---

## Recommended dependency boundaries

## Allowed dependencies

Prefer very few dependencies.

Ideal package deps:

- `@foxhound/types`
- maybe `date-fns` only if truly needed

## Avoid

- Next.js-specific code
- React components
- Docusaurus-specific code
- browser-only logic
- API transport logic

This package should stay framework-agnostic and portable.

---

## Type strategy

Add shared demo-domain types in this package, while reusing `@foxhound/types` for core observability objects.

### Reuse from `@foxhound/types`
- `Trace`
- `Span`
- any future shared core observability contracts

### Define locally in `packages/demo-domain`
- `DemoOrg`
- `DemoPrompt`
- `DemoScenario`
- `DemoDiffPair`
- `DemoRegression`
- `DemoDataset`
- `DemoEvaluator`
- `DemoExperiment`
- `DemoBudgetStatus`
- `DemoSlaStatus`
- `DemoNotificationFixture`
- projection types for page-ready data

If some of these later become cross-package product contracts, they can move into `@foxhound/types` deliberately.

---

## Consumer model

## Consumer 1 — `apps/web`

Use the package for:

- `/demo` routes
- local review fixtures
- page stories / manual QA
- eventually tests that need realistic multi-surface data

## Consumer 2 — marketing site

Potential future consumers include:

- embedded interactive product demo
- hero narrative widgets
- screenshots and comparison visuals
- guided story walkthroughs

## Consumer 3 — docs/eval artifacts

Could also power:

- HTML evaluation packs
- demo decks
- walkthrough scripts

---

## Migration plan from current state

## Current state

`apps/web/lib/demo-data.ts` and `apps/web/lib/demo-data-advanced.ts` provide trace-only demo generation.

## Migration recommendation

### Step 1
Create `packages/demo-domain` and move only **new** multi-surface demo modeling there.

### Step 2
Adapt `apps/web` demo routes to consume shared package outputs.

### Step 3
Either:
- keep old web-local generators temporarily for generic background traffic, or
- move them into `packages/demo-domain/generators/`

### Step 4
Deprecate `apps/web/lib/demo-data*.ts` after new package fully covers the current needs.

This avoids a risky big-bang rewrite.

---

## Initial minimal package scope

Do not try to model everything at once.

### First shipping slice

The package should first support the hero story only:

- `support-reply` prompt versions 17/18/19
- curated traces:
  - `trace_support_refund_v17_baseline`
  - `trace_support_refund_v18_regression`
  - `trace_support_refund_v19_fix`
- diff pairs:
  - hero regression
  - hero recovery
- one regression record
- one dataset
- one evaluator
- one experiment
- one budget hotspot
- one SLA hotspot
- one notification route
- one overview/executive projection

That gives the team a working vertical slice for both web review and future marketing demo.

---

## Naming recommendation

Use `demo-domain`, not `demo-data`.

### Why

`demo-data` sounds like inert fixtures.

But this package is likely to own:

- scenario definitions
- builders
- projections
- curated narrative relationships

That is a domain module, not just a blob of data.

---

## Suggested package exports

Example top-level exports:

```ts
export * from './types';

export {
  demoOrgs,
  demoAgents,
  demoPrompts,
  demoScenarios,
  demoCuratedTraces,
  demoDiffPairs,
  demoReplayTargets,
} from './catalog';

export {
  buildLocalReviewDemo,
  buildMarketingHeroDemo,
  buildMarketingLiteDemo,
} from './projections';
```

And optionally narrower exports:

```ts
export { buildSupportCopilotHeroStory } from './projections/marketing-hero';
```

---

## File ownership recommendations

## Keep in `packages/demo-domain`
- all story definitions
- all demo records
- all builders and projection logic

## Keep in `apps/web`
- route wiring
- page component composition
- web-only state and UX behavior

## Keep in `docs-site` or marketing surface
- presentation of the demo
- marketing-specific copy and layout
- embeddings / tour orchestration

---

## Risks and mitigations

## Risk 1: package grows into a second app model

### Mitigation
Keep it strictly fixture/domain/projection focused. No UI, no app routing.

## Risk 2: duplicated page-shape types

### Mitigation
Define explicit projection interfaces in the package and import them in consumers.

## Risk 3: too much randomness weakens narrative consistency

### Mitigation
Keep curated anchor scenarios deterministic. Use randomization only for background traffic.

## Risk 4: marketing needs a much smaller subset later

### Mitigation
Add projection tiers now: full/local vs marketing-hero vs marketing-lite.

---

## Suggested implementation phases

## Phase 1 — Package scaffold
- create package
- add package exports
- define demo-domain types
- add support-copilot hero catalog entries

## Phase 2 — Vertical slice
- implement curated traces and prompt versions
- implement diff pair and replay target outputs
- implement one regression, one dataset, one evaluator, one experiment
- wire `apps/web` demo route to consume this slice

## Phase 3 — Governance layer
- add budgets, SLAs, notifications, overview, executive projections

## Phase 4 — Background traffic and secondary orgs
- add generated support traffic
- add code-review and research orgs
- add quiet healthy tenant

## Phase 5 — Marketing projection
- add `marketingHero` and `marketingLite` outputs
- ensure payload size and story density fit marketing UX

---

## Recommended next coding task

Create the package scaffold and define the first vertical slice for the Support Copilot hero story.

Specifically:

1. create `packages/demo-domain`
2. add local types for scenarios and projections
3. add catalog entries for:
   - org_support_copilot
   - support-reply v17/v18/v19
   - 3 curated hero traces
   - 2 diff pairs
   - 1 regression
   - 1 dataset
   - 1 evaluator
   - 1 experiment
4. export a `buildMarketingHeroDemo()` function
5. export a `buildLocalReviewDemo()` function

That gives immediate reuse value without overbuilding.

---

## Recommendation

Proceed with `packages/demo-domain` as a shared workspace package and treat it as the canonical demo-story source for both:

- `apps/web` local demo/review mode
- future marketing-site interactive demo mode

This is the cleanest long-term architecture and avoids inevitable duplication later.
