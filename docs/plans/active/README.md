# Active Plans Index

**Purpose:** quick navigation for the current execution-driving plan set.

Use this file when `docs/plans/active/` still has more than a handful of items and you need to know which documents are the primary execution drivers versus supporting active plans.

## Primary execution plans

### 1. Phase 6 hardening
- `2026-04-12-phase6-prompt-management-hardening.md`
- **Role:** primary product/backend hardening lane
- **Use when:** continuing Phase 6 prompt-management work or adjacent backend hardening

### 2. Testing / QA gap closure
- `2026-04-12-testing-qa-gap-analysis.md`
- **Role:** primary verification-gap plan
- **Use when:** choosing the next highest-value testing or verification investment

### 3. Dashboard execution roadmap
- `2026-04-13-dashboard-implementation-roadmap.md`
- **Role:** primary dashboard execution plan
- **Use when:** deciding what dashboard slice to build next
- **Supporting archived context:** dashboard strategy, chart-system plan, and filter-system plan now live under `docs/plans/archive/dashboard/`

### 4. Architecture consolidation
- `2026-04-14-architecture-consolidation-plan.md`
- **Role:** primary repo cleanup / consolidation plan
- **Use when:** continuing structural simplification, package cleanup, docs-truth cleanup, or refactor prioritization

### 5. GTM execution
- `2026-04-14-gtm-execution-plan.md`
- **Role:** primary GTM operating plan
- **Use when:** working on outreach, discovery, pilots, messaging execution, or proof capture
- **Supporting archived context:** GTM synthesis/message-testing/tracker docs now live under `docs/plans/archive/gtm/`

## Supporting active plans

### Demo / marketing demo planning cluster
These remain active because they serve different purposes in the same lane.

#### 6. Demo seed-data strategy
- `2026-04-13-marketing-demo-seed-data-plan.md`
- **Role:** primary strategy for demo data structure and usage

#### 7. Demo scenario catalog
- `2026-04-13-marketing-demo-scenario-catalog.md`
- **Role:** canonical scenario/source-content catalog

#### 8. Shared demo-domain module plan
- `2026-04-13-shared-demo-domain-module-plan.md`
- **Role:** package-boundary and implementation-direction plan for reusable demo domain data

## Selection guide

If unsure where to start:

- **backend / prompts / product hardening** → `2026-04-12-phase6-prompt-management-hardening.md`
- **test debt / verification debt** → `2026-04-12-testing-qa-gap-analysis.md`
- **dashboard work** → `2026-04-13-dashboard-implementation-roadmap.md`
- **repo cleanup / refactors / architecture debt** → `2026-04-14-architecture-consolidation-plan.md`
- **GTM / outreach / pilot motion** → `2026-04-14-gtm-execution-plan.md`
- **demo-data / marketing demo** → start with `2026-04-13-marketing-demo-seed-data-plan.md`

## Rule of thumb

Before adding another active plan, ask:
1. Is this actually a new execution lane?
2. Could this be a section inside an existing active plan?
3. Is it really a support artifact that belongs in `archive/` or `sessions/` instead?
