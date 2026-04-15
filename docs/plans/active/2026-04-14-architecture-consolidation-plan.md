# Foxhound Architecture Consolidation Plan

**Date:** 2026-04-14  
**Source review:** `docs/sessions/2026-04-14-architecture-review-deck.html`  
**Goal:** Reduce bloat, lower maintenance cost, improve architecture cohesion, and preserve the product/platform direction without a rewrite.

## Audit scope declaration

This plan is based on a **surface-exhaustive** repo review:
- broad coverage across apps, packages, docs, and configs
- representative reads of key subsystem files
- targeted sampling of the web app, DB layer, SDK/client surfaces, MCP server, and docs structure
- recent git history cross-check

This is **not** a file-by-file exhaustive remediation plan.

---

## Executive recommendation

Do **not** rewrite Foxhound.

Instead, run a **3-track consolidation pass** over the next 1–3 weeks:

1. **Code structure cleanup** — split oversized modules, reduce duplication, sharpen boundaries
2. **Repo truth cleanup** — prune/archive plans and review artifacts, reduce retrieval noise
3. **Architecture hardening** — formalize control-plane vs telemetry boundaries before scaling further

This should be treated as a focused maintenance milestone, not background cleanup.

---

## Success criteria

At the end of the consolidation pass:

- no major product/domain surface is owned by a single oversized grab-bag file
- SDK/client/MCP surface contracts are easier to evolve without drift
- `docs/plans/active/` only contains truly active work
- review/session/audit artifacts are clearly separated from durable truth
- web/dashboard breadth is mapped to a realistic near-term product priority
- future telemetry scaling path is reflected in code boundaries, not only docs

---

## Priority order

### P0 — Highest ROI, lowest regret

#### 1. Finish DB query decomposition
**Why:** This is the most structurally important debt in the repo.

**Current issue:**
- `packages/db/src/queries.ts` still acts as a central export and risk magnet
- auth, traces, prompts, datasets, evaluators, notifications, and platform concerns are still mentally grouped in one DB package surface

**Actions:**
- preserve `queries-auth.ts`, `queries-traces.ts`, `queries-prompts.ts`, etc. as the real domain entrypoints
- reduce `queries.ts` into a minimal compatibility barrel or remove it as the default place to add code
- create clear per-domain exports from `packages/db/src/index.ts`
- explicitly document where new DB code belongs
- add per-domain integration tests where coverage is currently broad but not modular

**Done looks like:**
- future DB code is added to domain files by default
- reviewers can reason about one domain at a time
- cross-domain accidental coupling becomes more obvious

**Estimated payoff:** very high

---

#### 2. Split MCP server into tool modules
**Why:** `packages/mcp-server/src/index.ts` is too large and will get worse.

**Current issue:**
- one giant entry file mixes bootstrapping, formatting, tool registration, and business logic
- adding tools raises merge/conflict risk and review burden

**Actions:**
- create `src/tools/` grouped by domain:
  - `traces.ts`
  - `alerts.ts`
  - `api-keys.ts`
  - `budgets-slas.ts`
  - `evaluators.ts`
  - `scores.ts`
  - `prompts.ts`
  - `regressions.ts`
  - etc.
- keep `index.ts` limited to config, client init, server init, and tool registration
- extract shared formatting helpers into `src/formatters/` or `src/lib/`

**Done looks like:**
- the MCP entrypoint becomes small and boring
- tool additions are localized
- tests can map 1:1 to modules more easily

**Estimated payoff:** very high

---

#### 3. Prune `docs/plans/active/`
**Why:** This is the clearest repo-truth bloat signal.

**Current issue:**
- too many active plans dilute what “current” means
- review HTMLs and plan artifacts are coexisting with execution plans

**Actions:**
- define strict criteria for what stays in `active/`
- move completed, stale, speculative, and artifact-style docs into:
  - `docs/plans/completed/`
  - `docs/plans/archive/`
  - `docs/sessions/`
  - `docs/reference/` (if they became durable truth)
- keep only execution-driving plans active

**Recommended active-plan target:**
- 3–7 items max

**Done looks like:**
- a fresh agent can scan `docs/plans/active/` and actually know what matters

**Estimated payoff:** very high

---

### P1 — Important consolidation work

#### 4. Unify transport/client logic across API client and SDK
**Why:** There is clear duplication and drift risk.

**Current issue:**
- `packages/api-client/src/index.ts` owns a broad HTTP client surface
- `packages/sdk/src/client.ts` reimplements fetch, error handling, and endpoint wrappers for many namespaces

**Actions:**
- define a shared transport primitive or small internal base package/module
- decide whether SDK should:
  - wrap `@foxhound/api-client`, or
  - share a lower-level HTTP core with it
- standardize:
  - endpoint normalization
  - auth header setup
  - error parsing
  - response handling
  - retries/timeouts if added later

**Caution:**
- do not over-abstract
- simplest good outcome is shared transport + shared error handling, not a mega framework

**Done looks like:**
- one place to change client HTTP behavior
- fewer contract mismatches between SDK and API client

**Estimated payoff:** high

---

#### 5. Clarify durable docs vs session evidence vs review artifacts
**Why:** The repo has strong documentation intent but too much documentation surface.

**Current issue:**
- plans, sessions, HTML decks, audits, and generated reports are all close enough to feel equally authoritative

**Actions:**
- codify 3 categories:
  1. **durable truth** → `docs/overview/`, `docs/reference/`, `docs/architecture.md`
  2. **active execution** → `docs/plans/active/`
  3. **evidence/history** → `docs/sessions/`
- move audit HTMLs and review decks out of active plan paths unless they are literal plan artifacts
- add a short “where things go” table near the top of `docs/README.md`

**Done looks like:**
- less ambiguity about what should be read first

**Estimated payoff:** high

---

#### 6. Re-scope the web dashboard around realistic operator priorities
**Why:** The dashboard is broad and promising, but likely ahead of backend/operator maturity in some areas.

**Current issue:**
- lots of pages/components imply platform breadth
- some surfaces are more wireframe than settled workflow

**Actions:**
- classify dashboard routes into:
  - **tier 1:** daily operator surfaces
  - **tier 2:** important but secondary workflows
  - **tier 3:** demo/vision/prototype surfaces
- ensure persistent navigation favors tier 1
- move tier 3/demo logic toward demo-domain or explicit preview paths
- avoid polishing low-traffic surfaces before core flows feel excellent

**Suggested likely tier 1 set:**
- overview/executive summary
- traces
- replay
- run diff
- prompts (if Phase 6 is near-term)

**Estimated payoff:** medium-high

---

### P2 — Medium-term hardening

#### 7. Formalize control-plane vs telemetry boundaries in code
**Why:** The docs are ahead of the code here.

**Current issue:**
- the architecture doc correctly describes future separation
- code still largely reflects a Postgres-first telemetry world

**Actions:**
- tag or document modules as one of:
  - control-plane reads/writes
  - telemetry ingest
  - telemetry analytics
  - async policy/jobs
- avoid new product features directly depending on raw span scans when summaries would do
- define the minimal Postgres-resident summaries you want long-term

**Done looks like:**
- future ClickHouse/object-store adoption becomes incremental instead of invasive

**Estimated payoff:** medium-high

---

#### 8. Reduce manual queue plumbing repetition
**Why:** Queue code is fine today, but repetitive.

**Current issue:**
- multiple near-identical queue getters and queue setup patterns
- easy to drift in behavior or naming

**Actions:**
- create a small queue registry/helper in API and worker
- centralize queue names/constants
- standardize Redis parse/connection creation

**Caution:**
- keep it explicit; avoid clever generic abstractions

**Estimated payoff:** medium

---

#### 9. Add module size / repo-health guardrails
**Why:** Prevent reaccumulation.

**Actions:**
- add a lightweight script/report for:
  - files above a threshold size
  - active-plan count
  - generated artifact detection
  - maybe high-risk barrel exports
- run it in hygiene checks or local repo-health workflow

**Done looks like:**
- future sprawl is caught earlier

**Estimated payoff:** medium

---

## Suggested sequencing

### Week 1 — Structural cleanup
1. DB query decomposition completion
2. MCP tool modularization
3. active plan pruning and docs categorization

### Week 2 — Contract cleanup
4. shared transport/client consolidation
5. queue plumbing simplification
6. docs/readme/source-of-truth cleanup

### Week 3 — Product-surface prioritization
7. dashboard route/feature tiering
8. control-plane vs telemetry boundary hardening
9. small guardrails for file size and repo hygiene

---

## Concrete file targets

### DB layer
- `packages/db/src/index.ts`
- `packages/db/src/queries.ts`
- `packages/db/src/queries-auth.ts`
- `packages/db/src/queries-traces.ts`
- `packages/db/src/queries-prompts.ts`
- remaining domain query files

### MCP server
- `packages/mcp-server/src/index.ts`
- new `packages/mcp-server/src/tools/*`
- new shared formatter/helper modules as needed

### Shared client/SDK surface
- `packages/api-client/src/index.ts`
- `packages/sdk/src/client.ts`
- maybe introduce `packages/api-client/src/http.ts` or a small shared internal module

### Docs and plans
- `docs/README.md`
- `docs/plans/active/*`
- `docs/plans/archive/*`
- `docs/plans/completed/*`
- `docs/sessions/*`

### Web tiering
- `apps/web/README.md`
- `apps/web/components/layout/sidebar.tsx`
- route and component inventory under `apps/web/app/` and `apps/web/components/`

---

## What to archive/delete/move first

### Likely archive/move candidates
- speculative or superseded plan docs in `docs/plans/active/`
- HTML review decks living in plan directories
- one-off audit artifacts that are no longer execution drivers

### Likely keep active
- current Phase 6 hardening plan
- testing/QA gap analysis if still actively used
- dashboard implementation roadmap only if still driving daily work

### Keep as evidence/history
- architecture review deck
- session analysis decks
- transcript-derived review artifacts

---

## Risks during cleanup

1. **Over-abstracting while trying to reduce duplication**
   - mitigation: prefer tiny shared primitives over framework-like layers

2. **Breaking external package contracts**
   - mitigation: preserve public interfaces while refactoring internals first

3. **Mistaking breadth for value**
   - mitigation: explicitly tier UI and package surfaces by current product importance

4. **Docs cleanup creating accidental information loss**
   - mitigation: archive before deleting; keep redirect/index notes for moved artifacts

---

## Recommended operating rules after consolidation

1. No new domain logic goes into oversized catch-all files
2. `docs/plans/active/` stays intentionally small
3. session evidence is not treated as durable architecture truth
4. external surfaces share contracts and transport behavior wherever practical
5. web breadth follows validated operator workflows, not just roadmap enthusiasm
6. new telemetry-heavy features should respect the eventual OLTP/analytics split

---

## My recommendation if choosing only 3 things

If time is tight, do these first:

1. **Split the MCP server by tool domain**
2. **Finish DB query decomposition**
3. **Prune active plans and clean docs truth hierarchy**

That gives the largest reduction in cognitive load per unit effort.

---

## Final recommendation

Foxhound has good bones.

The right move is not to reduce ambition — it is to make the codebase match the ambition more cleanly.

A focused consolidation pass should make the repo:
- easier to navigate
- safer to extend
- less noisy for future agents and humans
- better prepared for the next architecture jump (telemetry scale and Phase 6 depth)
