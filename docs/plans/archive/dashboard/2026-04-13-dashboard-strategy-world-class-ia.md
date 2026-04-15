# Foxhound Dashboard Strategy — World-Class IA, JTBD, and Outcome Mapping

**Date:** 2026-04-13  
**Status:** Active planning artifact  
**Scope:** Re-evaluate the current Foxhound dashboard and define a world-class dashboard strategy comparable in clarity and operator usefulness to LangSmith/LangChain-class products, while organizing Foxhound around its differentiated capabilities and user outcomes.

---

## 1. Executive Summary

Foxhound's current dashboard is a **functional wireframe foundation**, not yet a strategic operator console.

It already contains the seeds of the right product:
- trace inspection
- run comparison
- prompt versioning and comparison
- route shells for budgets, SLAs, regressions, datasets, and experiments

But the current information architecture is still **feature-first**, not **job-to-be-done-first**.

A world-class Foxhound dashboard should not feel like a bag of observability features. It should feel like an **AI agent fleet operating system** that helps users answer four questions quickly:

1. **What is broken right now?**
2. **What changed, and why did behavior shift?**
3. **What is this costing us, and are we within policy?**
4. **How do we turn production behavior into safer future behavior?**

That means Foxhound should evolve from:
- current model: **entity pages** (`/traces`, `/datasets`, `/experiments`, `/budgets`, `/slas`)

To:
- target model: **operator workflows** centered on:
  - Monitor
  - Investigate
  - Improve
  - Govern

This preserves all Foxhound features while presenting them in the order users naturally think about outcomes.

---

## 2. Evidence-Based Current-State Audit

### 2.1 Existing dashboard routes

Current dashboard routes in `apps/web/app/(dashboard)/`:
- `/` → redirects to `/traces`
- `/traces`
- `/traces/[id]`
- `/diff`
- `/prompts`
- `/prompts/[id]`
- `/prompts/[id]/diff`
- `/datasets`
- `/experiments`
- `/budgets`
- `/slas`
- `/regressions`
- `/settings`

Sources:
- `apps/web/app/(dashboard)/page.tsx`
- `apps/web/app/(dashboard)/traces/page.tsx`
- `apps/web/app/(dashboard)/traces/[id]/page.tsx`
- `apps/web/app/(dashboard)/diff/page.tsx`
- `apps/web/app/(dashboard)/prompts/page.tsx`
- `apps/web/app/(dashboard)/prompts/[id]/page.tsx`
- `apps/web/app/(dashboard)/prompts/[id]/diff/page.tsx`

### 2.2 Sidebar/navigation state

Current sidebar items:
- Traces
- Experiments
- Datasets
- Budgets
- SLAs
- Regressions
- Settings

Source:
- `apps/web/components/layout/sidebar.tsx`

Observations:
- navigation is **feature inventory**, not workflow-oriented
- prompts are not yet in the sidebar
- diff is reachable indirectly, not framed as part of a larger investigation workflow
- there is no “home” dashboard with operator-level summaries

### 2.3 Surface maturity by section

#### Implemented with meaningful behavior
- **Traces list** — data load + compare affordance
- **Trace detail** — metadata, timeline, status summary
- **Run diff** — side-by-side comparison
- **Prompt list/detail/diff** — minimal but usable discovery chain
- **Shared page states** — good foundation for consistent redesign

Evidence:
- `apps/web/components/traces/*`
- `apps/web/components/diff/*`
- `apps/web/components/prompts/*`
- `apps/web/components/ui/page-state.tsx`

#### Placeholder / coming soon
- Datasets
- Experiments
- Budgets
- SLAs
- Regressions

Evidence:
- `apps/web/app/(dashboard)/datasets/page.tsx`
- `apps/web/app/(dashboard)/experiments/page.tsx`
- `apps/web/app/(dashboard)/budgets/page.tsx`
- `apps/web/app/(dashboard)/slas/page.tsx`
- `apps/web/app/(dashboard)/regressions/page.tsx`

### 2.4 UX maturity assessment

**Current grade:** solid internal wireframe / 10  
**Not yet:** category-defining operating console / 10

Strengths:
- clean route scaffolding
- behavioral correctness focus
- good reuse of state components
- useful core primitives already exist (trace detail, diff, prompt diff)

Weaknesses:
- no opinionated dashboard landing page
- weak workflow guidance
- no fleet-level health summary
- no persona-based prioritization
- no “what should I do next?” affordances
- too many latent sections with little connective tissue

---

## 3. What “World-Class” Means for Foxhound

Foxhound should not simply imitate LangSmith.

LangSmith is strongest when the user already thinks in terms of:
- traces
- evaluations
- datasets
- experiments

Foxhound’s opportunity is broader and more operational because its differentiators include:
- Session Replay
- Run Diff
- eval-from-traces
- cost budgets
- SLA monitoring
- behavior regression detection
- prompt management
- MCP debugging tools

So a world-class Foxhound dashboard should behave less like a generic LLM observability app and more like:

**“The operating console for agent systems in production.”**

That implies:
- outcome-first framing
- fast diagnosis workflows
- explicit state transitions from issue → investigation → fix → validation
- stronger prioritization of cost/reliability/behavioral drift than generic tracing products

---

## 4. Primary Personas and JTBDs

### Persona A — Agent Engineer / Prompt Engineer

**JTBD:**
- When an agent behaves unexpectedly, help me find the bad run, compare it to a good run, inspect prompts/tool usage, and understand exactly what changed.

**Core outcomes:**
- faster debugging
- safer prompt iteration
- confidence before shipping a change

**Primary Foxhound features:**
- traces
- session replay
- run diff
- prompt versioning/diff
- datasets
- experiments
- evaluators

### Persona B — Platform / Reliability Owner

**JTBD:**
- Help me understand whether our fleet is healthy, breaching SLAs, or regressing in behavior so I can intervene before customers feel it.

**Core outcomes:**
- fewer incidents
- quicker triage
- confidence in production reliability

**Primary features:**
- fleet health dashboard
- SLA monitoring
- regressions
- trace drill-down
- alerts
- run diff

### Persona C — Engineering Lead / Product Lead

**JTBD:**
- Show me whether the system is improving over time, what our biggest risks are, and whether recent changes improved reliability/cost/outcomes.

**Core outcomes:**
- better prioritization
- better shipping decisions
- visibility into ROI of improvement work

**Primary features:**
- executive summary dashboard
- trend cards
- regressions
- cost/risk summaries
- eval coverage
- experiments outcomes

### Persona D — Ops / FinOps / Governance Owner

**JTBD:**
- Help me control cost, enforce policy, and understand where spend or policy breaches are coming from.

**Core outcomes:**
- predictable spend
- fewer policy breaches
- easier accountability

**Primary features:**
- budgets
- cost hotspots
- SLAs
- auditability
- prompt governance / production labels

---

## 5. Outcome Model: The Four Core Operator Workflows

A world-class Foxhound dashboard should organize around four top-level workflows.

### 5.1 Monitor

**Question:** What needs attention now?

Contains:
- org/fleet overview
- recent incidents
- SLA breaches
- regressions
- cost anomalies
- alert feed
- top failing agents / routes / prompts

### 5.2 Investigate

**Question:** Why did this happen?

Contains:
- traces
- trace detail
- session replay
- run diff
- timeline diff
- prompt detail and prompt diff
- cross-links from incidents / regressions / alerts into traces

### 5.3 Improve

**Question:** How do we turn observed failures into better behavior?

Contains:
- datasets
- evals/evaluators
- experiments
- prompt iteration
- add-to-dataset from trace
- compare experiment outcomes

### 5.4 Govern

**Question:** Are we operating within cost, reliability, and policy constraints?

Contains:
- budgets
- SLAs
- policy states
- regression baselines
- notifications / alert routing
- prompt labels and production control

This model is simpler and stronger than a flat feature menu.

---

## 6. Recommended Information Architecture

### 6.1 Recommended primary navigation

**Top-level sidebar**
1. **Overview**
2. **Investigate**
3. **Improve**
4. **Govern**
5. **Settings**

### 6.2 Recommended secondary navigation

#### Overview
- Fleet Overview
- Alerts & Incidents
- Recent Changes

#### Investigate
- Traces
- Run Diff
- Session Replay
- Prompts

#### Improve
- Datasets
- Evaluators
- Experiments
- Prompt Iteration

#### Govern
- Budgets
- SLAs
- Regressions
- Notifications

This structure is not just cleaner — it matches how users think:
- see problem
- inspect problem
- improve system
- keep it under control

### 6.3 Why this beats the current nav

Current nav is fine for builders who already know every feature.  
World-class nav must help users who are asking for outcomes, not entities.

Current nav says:
- “Here are our nouns.”

Target nav says:
- “Here’s how to get your job done.”

---

## 7. Recommended Dashboard Landing Experience

### 7.1 Replace `/` → `/traces` redirect

Current:
- dashboard home redirects to traces

Recommended:
- dashboard home becomes **Fleet Overview**

This is the single most important IA change.

### 7.2 Fleet Overview content hierarchy

#### Hero row: outcome summary
- Fleet health score
- Active incidents / critical regressions
- SLA breach count
- Cost at risk / over budget count

#### Section 1: What changed
- latest deployments / prompt changes / agent version changes
- recent regressions correlated to changes

#### Section 2: What needs action
- failing agents
- traces with highest user impact
- budget anomalies
- unresolved alerts

#### Section 3: Where to go next
- CTA cards:
  - Investigate failing traces
  - Review regressions
  - Compare recent runs
  - Inspect prompt changes

#### Section 4: Trends
- success rate trend
- latency trend
- cost trend
- eval score trend

This page should answer in under 10 seconds:
- is my fleet healthy?
- what should I click next?

---

## 8. Recommended Page Architecture by Workflow

## 8.1 Overview pages

### Fleet Overview
Purpose:
- home page for operators and leads

Key modules:
- health score
- incidents feed
- change feed
- at-risk agents
- trends
- action queue

### Alerts & Incidents
Purpose:
- triage inbox for operational issues

Key modules:
- status
- severity
- affected agent/prompt/version
- linked traces
- linked regression or SLA breach

### Recent Changes
Purpose:
- correlate breakage with prompt, model, or version changes

Key modules:
- deployments
- prompt promotions / label changes
- experiment launches
- regression detections

---

## 8.2 Investigate pages

### Traces
Keep, but upgrade positioning.

Should become:
- primary investigation workbench
- stronger filters by agent/version/prompt/status/user impact
- stronger saved views

### Trace Detail
Current structure is directionally correct.

Needs eventual upgrades:
- richer summary card
- cost + token + prompt metadata
- causal timeline
- fast “compare against baseline” CTA
- “add to dataset” CTA
- “open prompt version” CTA

### Run Diff
Already aligned with Foxhound’s differentiation.

Needs upgrades:
- clearer baseline vs changed version context
- stronger narrative summary
- links back to incident / regression / prompt change
- anomaly callouts

### Session Replay
Should become first-class, not buried.

If Foxhound has Session Replay as a core moat, it must visually feel like one of the product’s stars.

### Prompts
Prompt pages should stay in Investigate rather than Improve because users often inspect prompt history while debugging current problems.

---

## 8.3 Improve pages

### Datasets
Should be reframed as:
- “Cases” or “Evaluation Cases” in some UX copy
- fed directly from traces

### Evaluators
Should be first-class, not implicit.

Recommended page:
- evaluator templates
- last run status
- score distributions
- adoption / coverage

### Experiments
Should answer:
- what variant won?
- why?
- is it safe to promote?

### Prompt Iteration
Foxhound should unify prompt editing history, evaluation, and trace evidence.

That could become a later integrated workflow:
- prompt detail
- experiment result
- compare production vs candidate
- promote label

---

## 8.4 Govern pages

### Budgets
Not just spend display.
Should answer:
- who is burning money?
- where are overruns coming from?
- what action is required?

### SLAs
Should answer:
- which agents are violating latency or success thresholds?
- is this transient or trending?

### Regressions
This should be one of Foxhound’s hero pages, not a hidden utilities page.

Should answer:
- what changed in behavior?
- how severe is it?
- when did it start?
- what traces prove it?

### Notifications
Should eventually centralize alert routing, ownership, and status.

---

## 9. Strategic Differentiation vs LangSmith / LangChain UX

Foxhound should not win by having more tabs.
It should win by making a few workflows dramatically clearer.

### Where Foxhound can be better

#### 1. Stronger incident-to-root-cause workflow
LangSmith is strong on traces and evals. Foxhound can be stronger on:
- incident detection
- behavior change detection
- diff-driven debugging
- replay + prompt linkage

#### 2. Better production operations framing
Foxhound can own:
- budget enforcement
- SLA monitoring
- regression monitoring
- prompt governance in production

#### 3. Better “eval from traces” loop
Foxhound should visually connect:
- bad trace → dataset case → experiment → improved prompt/model → promotion

That closed loop is product-defining if the UI makes it obvious.

#### 4. Better fleet-level command center
LangSmith often feels artifact-centric. Foxhound can feel more operationally decisive.

---

## 10. Design Principles for the Dashboard Rewrite

1. **Home is not a table.** The landing page must be a decision surface.
2. **Every page answers one operator question.** No generic pages.
3. **Cross-link aggressively.** Traces, prompts, regressions, experiments, and budgets should connect tightly.
4. **Use progressive disclosure.** Summary first, forensic detail second.
5. **Make change visible.** Foxhound’s moat is understanding deltas over time.
6. **Preserve trust.** Use strong, calm, infrastructure-grade visual design.
7. **Guide next action.** Every important page needs recommended next steps.

---

## 11. Recommended Implementation Roadmap

## Phase A — Fix the IA spine

### A1. Create true dashboard home
- replace `/` redirect with Fleet Overview
- add summary cards, alert queue, recent changes, top investigations

### A2. Restructure sidebar around workflows
- Overview
- Investigate
- Improve
- Govern
- Settings

### A3. Add missing prompts nav
- surface prompts within Investigate

**Why first:** this changes how the product is understood before deeper page polish.

## Phase B — Make Investigate world-class

### B1. Upgrade trace detail
- better summary
- prompt/model/version context
- replay + diff CTAs
- dataset/eval CTAs

### B2. Upgrade run diff
- stronger narrative summaries
- causal callouts
- compare change context

### B3. Elevate session replay
- first-class route and navigation

## Phase C — Make Improve coherent

### C1. Build datasets page around trace-derived cases
### C2. Add evaluator management page
### C3. Build experiment compare flow
### C4. Connect prompt iteration to eval evidence

## Phase D — Make Govern differentiated

### D1. Build budgets page with hotspot analysis
### D2. Build SLA operations page
### D3. Build regressions as a hero workflow
### D4. Add notifications / ownership / routing status

## Phase E — Polish to category standard

### E1. visual system uplift
### E2. keyboard-driven operator workflows
### E3. saved views and deep links
### E4. richer empty states and suggested next actions
### E5. stakeholder-ready executive summary mode

---

## 12. Recommended Priority Order

### Top 5 next moves

1. **Fleet Overview homepage**
2. **Workflow-based sidebar/navigation redesign**
3. **Trace detail upgrade with stronger investigation CTAs**
4. **Regressions page promoted to hero feature**
5. **Datasets/evaluators/experiments connected as one improvement flow**

If only one thing happens next, it should be **the Fleet Overview + new nav model**.

---

## 13. Proposed Route Map (Target State)

### Overview
- `/overview`
- `/overview/incidents`
- `/overview/changes`

### Investigate
- `/traces`
- `/traces/[id]`
- `/diff`
- `/replay/[traceId]`
- `/prompts`
- `/prompts/[id]`
- `/prompts/[id]/diff`

### Improve
- `/datasets`
- `/evaluators`
- `/experiments`
- `/experiments/compare`

### Govern
- `/budgets`
- `/slas`
- `/regressions`
- `/notifications`

### Settings
- `/settings`

### Current implemented route map snapshot (2026-04-13)

This is the route map currently implemented in the web app after the dashboard spine and investigation workflow work completed in this thread.

#### Overview
- `/`

#### Investigate
- `/traces`
- `/traces/[id]`
- `/diff`
- `/replay/[id]`
- `/prompts`
- `/prompts/[id]`
- `/prompts/[id]/diff`

#### Improve
- `/datasets`
- `/evaluators`
- `/experiments`

#### Govern
- `/budgets`
- `/slas`
- `/regressions`
- `/notifications`

#### Settings
- `/settings`

#### Temporary gaps vs target state
- `/overview/incidents` and `/overview/changes` are not implemented yet.
- `/experiments/compare` is not implemented yet.
- `/replay/[id]` is the current implemented equivalent of the target-state replay route.
- The older `/demo/*` route family still exists as legacy preview surface, but the preferred local review path is now the real dashboard with `FOXHOUND_UI_DEMO_MODE=true`.

---

## 14. Final Recommendation

Foxhound should position its dashboard as:

**“The operating console for production AI agents.”**

To achieve that, the dashboard must evolve from a set of feature pages into a structured workflow:

- **Overview** to identify what matters now
- **Investigate** to find root causes quickly
- **Improve** to turn failures into better behavior
- **Govern** to keep cost, reliability, and policy under control

This is the most coherent way to combine Foxhound’s existing capabilities with its roadmap features while creating a product that feels world-class rather than merely complete.

---

## 15. Verification Checklist

- [x] Current routes audited from `apps/web/app/(dashboard)`
- [x] Existing nav audited from `apps/web/components/layout/sidebar.tsx`
- [x] Current roadmap and differentiated capabilities cross-checked from docs
- [x] JTBD/persona model defined
- [x] New IA proposed
- [x] Page hierarchy proposed
- [x] Implementation roadmap prioritized

