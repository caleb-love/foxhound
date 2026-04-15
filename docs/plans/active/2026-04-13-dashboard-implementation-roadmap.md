# Foxhound Dashboard Implementation Roadmap

**Date:** 2026-04-13  
**Status:** Active  
**Companion strategy doc:** `docs/plans/archive/dashboard/2026-04-13-dashboard-strategy-world-class-ia.md`

---

## 1. Purpose

This roadmap is the primary execution plan for dashboard work.

Supporting plans that now act as subordinate implementation detail or archived strategy context:
- `docs/plans/archive/dashboard/2026-04-13-dashboard-strategy-world-class-ia.md`
- `docs/plans/active/2026-04-14-dashboard-chart-system-plan.md`
- `docs/plans/active/2026-04-14-dashboard-filter-system-plan.md`

This roadmap translates the dashboard strategy into a multi-session execution plan.

It is designed to be usable across many sessions without requiring chat memory.

Use this document to answer:
- what to build next
- why it matters
- what “done” means for each slice
- what to verify before moving on
- where to resume if a session ends mid-stream

---

## 2. Product Goal

Turn the current Foxhound dashboard from a feature-first wireframe into a world-class operator console for AI agent fleets.

Target positioning:

> **Foxhound is the operating console for production AI agents.**

The dashboard should help users move cleanly through four workflows:
- **Overview** — what needs attention now?
- **Investigate** — why did it happen?
- **Improve** — how do we make it better?
- **Govern** — are we within cost, reliability, and policy constraints?

---

## 3. Execution Principles

1. **IA before polish**  
   Fix the structure before over-investing in visual refinement.

2. **Home must become a decision surface**  
   `/` should become a fleet overview, not a redirect to traces.

3. **Each slice must be independently reviewable**  
   Every session should leave behind a visible, verifiable improvement.

4. **Preserve wireframe-first discipline**  
   Do not get trapped in pixel polish before workflow clarity exists.

5. **Cross-link workflows aggressively**  
   Trace → prompt → diff → dataset → experiment → regression should feel like one system.

6. **Only ship real handoffs**  
   If a link carries workflow context via query params (for example `focus`, `baseline`, `comparison`, or `sourceTrace`), the destination page must parse and apply those params before the handoff is considered done.

---

## 4. Delivery Phases

## Phase A — Fix the dashboard spine

### Goal
Establish the new information architecture and core navigation model.

### Why this phase first
Without this, every future page improvement lands in the wrong product structure.

### Slices

#### A1. Fleet Overview homepage
**Build:**
- replace `/` redirect with real dashboard homepage
- add summary cards:
  - fleet health
  - active incidents/regressions
  - SLA risk
  - budget risk
- add “what changed” section
- add “what needs action” section
- add “recommended next actions” CTA area

**Done means:**
- `/` is a true overview page
- user can understand overall fleet status in under 10 seconds
- page does not depend on future polish to be useful

**Verification:**
- targeted page tests
- screenshot of overview page
- typecheck

**Resume note:**
If paused mid-slice, finish the summary/action section before adding trend details.

---

#### A2. Sidebar/navigation redesign
**Build:**
- replace current feature-inventory sidebar with workflow-based nav
- primary groups:
  - Overview
  - Investigate
  - Improve
  - Govern
  - Settings
- ensure prompts appear in nav
- make active state rules robust

**Done means:**
- the nav communicates user jobs, not just database nouns
- all current pages still remain reachable
- future pages have clear homes

**Verification:**
- sidebar test coverage
- screenshot of nav state
- click-path sanity check
- typecheck

**Resume note:**
If interrupted, land the IA labels first, then refine grouping and icons.

---

#### A3. Route normalization pass
**Build:**
- confirm route grouping matches IA direction
- document target route map for future additions:
  - Overview
  - Investigate
  - Improve
  - Govern
- identify any temporary mismatches and leave TODO markers if necessary

**Done means:**
- future sessions know where pages belong
- no ambiguity on whether a feature belongs under Investigate vs Improve vs Govern

**Verification:**
- route map documented in code comments or plan notes
- nav and page structure consistent enough to continue

**Status update — 2026-04-13:**
- Current implemented route grouping now aligns to the workflow IA at the dashboard-shell level.
- Confirmed current route ownership:
  - **Overview:** `/`, `/executive`
  - **Investigate:** `/traces`, `/traces/[id]`, `/diff`, `/replay/[id]`, `/prompts`, `/prompts/[id]`, `/prompts/[id]/diff`
  - **Improve:** `/datasets`, `/evaluators`, `/experiments`
  - **Govern:** `/budgets`, `/slas`, `/regressions`, `/notifications`
  - **Settings:** `/settings`
- Temporary mismatches / known gaps:
  - `Improve` does not yet include experiment comparison routes because those pages are not implemented yet.
  - `Overview` does not yet include `/overview/incidents` or `/overview/changes`; those remain target-state routes from the strategy doc.
  - Session Replay is first-class in navigation, but currently uses `/replay/[id]` rather than the earlier notation `/replay/[traceId]`; this is semantically aligned and acceptable.
- Conclusion: route grouping is normalized enough to continue feature work without ambiguity.

---

## Phase B — Make Investigate world-class

### Goal
Turn Foxhound’s strongest current area into a category-level investigation workflow.

### Slices

#### B1. Trace list upgrade
**Build:**
- improve filters and saved/default views
- add status groupings and stronger scanability
- surface compare / investigate CTAs more clearly
- optionally add prompt/version context columns if data is available

**Done means:**
- traces page feels like an investigation workbench, not just a table

**Verification:**
- targeted tests for filters and actions
- screenshot(s)
- typecheck

---

#### B2. Trace detail upgrade
**Build:**
- richer summary hero
- cost / latency / prompt / model context
- stronger tabs or sections for metadata, replay, and evidence
- direct CTAs to:
  - compare against another run
  - inspect prompt version
  - add to dataset

**Done means:**
- trace detail is the primary debug entry point
- users can move to the next investigative step without hunting

**Verification:**
- targeted tests
- screenshot
- typecheck

---

#### B3. Run diff upgrade
**Build:**
- stronger narrative summary
- clearer baseline vs changed framing
- anomaly callouts
- links back to trace detail / prompt comparison / regressions where relevant

**Done means:**
- run diff explains change, not just displays difference

**Verification:**
- targeted tests
- screenshot
- typecheck

---

#### B4. Session replay first-class route
**Build:**
- ensure replay is first-class in nav or trace detail workflow
- give it a dedicated route/surface if missing
- connect replay to trace timeline and diff workflows

**Done means:**
- replay feels like a flagship feature, not a hidden utility

**Verification:**
- route exists and is reachable from trace detail
- screenshot/demo
- typecheck

---

#### B5. Prompt investigation integration
**Build:**
- tighten prompt detail + diff UX
- link prompt surfaces from traces when metadata supports it
- make prompt change review feel like part of investigation, not a separate product area

**Done means:**
- prompt version history is clearly part of root-cause analysis

**Verification:**
- prompt navigation tests
- screenshot
- typecheck

---

## Phase C — Make Improve coherent

### Goal
Create the production-failure → improvement loop that can differentiate Foxhound.

### Slices

#### C1. Datasets page
**Build:**
- list datasets
- show counts and trace lineage context
- frame datasets as cases derived from real behavior

**Done means:**
- users understand datasets as improvement fuel, not just storage

---

#### C2. Evaluators page
**Build:**
- create evaluator management UI
- show status, last run, score type, adoption

**Done means:**
- eval capability is visible and manageable from the product

---

#### C3. Experiments page
**Build:**
- show experiment list and comparison summaries
- answer “which variant won?”

**Done means:**
- experiments feel tied to evidence and decisions

---

#### C4. Closed-loop improvement links
**Build:**
- connect trace detail → add to dataset
- dataset → experiment
- experiment → compare result
- prompt candidate → promote when validated

**Done means:**
- Foxhound visibly closes the loop from production issue to validated fix

---

## Phase D — Make Govern differentiated

### Goal
Elevate the features LangSmith-class tools underemphasize: cost, SLA, and behavior governance.

### Slices

#### D1. Budgets page
**Build:**
- actual budget overview UI
- over-budget / at-risk states
- top spenders and hotspots

**Done means:**
- budgets page drives action, not passive reading

---

#### D2. SLAs page
**Build:**
- breach summary
- trend views
- at-risk agents
- drill-down into failing traces

**Done means:**
- SLA page serves platform owners, not just as a placeholder

---

#### D3. Regressions page
**Build:**
- regression detection summary
- severity and recency
- linked traces / comparisons
- “what changed?” framing

**Done means:**
- regressions becomes one of Foxhound’s hero experiences

---

#### D4. Notifications / alert routing page
**Build:**
- show alert channels and policy status
- show what alerts route where
- future-ready home for alert governance

**Done means:**
- governance has a coherent operational home

---

## Phase E — Polish to category standard

### Goal
Turn a coherent dashboard into a world-class one.

### Slices

#### E1. Visual system uplift
- premium, infrastructure-grade visual language
- more intentional hierarchy and density
- consistent cards/charts/callouts

#### E2. High-speed operator UX
- keyboard shortcuts
- deep links
- saved views
- strong loading states and optimistic navigation where appropriate

#### E3. Executive mode / summary surfaces
- better trend summaries for leads and decision-makers
- stakeholder-friendly overviews

#### E4. Design QA pass
- consistency, spacing, motion, accessibility, responsiveness

---

## 5. Recommended Session Order

If working across many sessions, use this order:

1. **A1 Fleet Overview homepage**
2. **A2 Sidebar/navigation redesign**
3. **B2 Trace detail upgrade**
4. **B3 Run diff upgrade**
5. **D3 Regressions page**
6. **C1 Datasets page**
7. **C2 Evaluators page**
8. **C3 Experiments page**
9. **D1 Budgets page**
10. **D2 SLAs page**
11. **D4 Notifications page**
12. **E-phase polish**

This order maximizes visible product leverage early.

---

## 6. Suggested Acceptance Criteria by Milestone

### Milestone 1 — Dashboard spine complete
- homepage is Overview, not redirect
- workflow-based sidebar is live
- prompts included in IA
- strategy and route map remain aligned

### Milestone 2 — Investigation workflow complete
- traces, trace detail, diff, replay, and prompts feel connected
- root-cause flow is obvious

### Milestone 3 — Improvement workflow complete
- datasets, evaluators, experiments are present and linked together
- production issue → improvement loop is clear

### Milestone 4 — Governance workflow complete
- budgets, SLAs, regressions, notifications form a coherent operating surface

### Milestone 5 — Category-standard polish
- visual and interaction quality are strong enough for external demos and design review
- demo-mode dashboard preview is accessible without auth friction for local review

---

## 7. Session Resume Checklist

At the start of any future session:

1. Read:
   - `docs/plans/active/2026-04-13-dashboard-strategy-world-class-ia.md`
   - `docs/plans/active/2026-04-13-dashboard-implementation-roadmap.md`
2. Check current dashboard routes in `apps/web/app/(dashboard)/`
3. Check current sidebar in `apps/web/components/layout/sidebar.tsx`
4. Continue the next incomplete slice in phase order
5. Record session progress in `docs/sessions/session-YYYY-MM-DD.md`

---

## 8. “Do Not Forget” Notes

- Do not overfit to current Tailwind layout structures
- Do not ship more placeholders before fixing the spine
- Do not treat prompts as a side utility; they are part of investigation
- Do not leave regressions buried; it is a hero differentiator
- Do not polish empty pages before the IA is corrected

---

## 9. Recommended Next Implementation Slice

**Next slice:** A1 — Fleet Overview homepage

Why:
- highest leverage change
- clarifies product immediately
- provides the right entry point for all future workflow sections

**Definition of ready:**
- data model for overview cards identified
- placeholder/fallback states acceptable for initial version
- page can launch as a wireframe summary even before all downstream pages are complete

---

## 10. Progress Tracker

### Phase A — Spine
- [x] A1 Fleet Overview homepage
- [x] A2 Sidebar/navigation redesign
- [x] A3 Route normalization pass

### Phase B — Investigate
- [ ] B1 Trace list upgrade
- [x] B2 Trace detail upgrade
- [x] B3 Run diff upgrade
- [x] B4 Session replay first-class route
- [x] B5 Prompt investigation integration

### Phase C — Improve
- [x] C1 Datasets page
- [x] C2 Evaluators page
- [x] C3 Experiments page
- [x] C4 Closed-loop improvement links

### Phase D — Govern
- [x] D1 Budgets page
- [x] D2 SLAs page
- [x] D3 Regressions page
- [x] D4 Notifications / alert routing

### Phase E — Polish
- [x] E1 Visual system uplift
- [x] E2 High-speed operator UX
- [x] E3 Executive mode / summary surfaces
- [x] E4 Design QA pass

### Post-sweep follow-ups
- [x] Repo guidance updated from friction review recommendations
- [x] Functional query-param handoffs fixed for prompts/datasets flows
- [x] Demo mode added for auth-free local dashboard review
- [ ] Optional cleanup of legacy `/demo/*` route family or clearer deprecation plan
- [ ] Optional `B1` trace list upgrade and target-state route expansions (`/overview/incidents`, `/overview/changes`, `/experiments/compare`)

