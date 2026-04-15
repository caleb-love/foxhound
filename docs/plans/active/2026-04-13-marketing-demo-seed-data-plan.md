# Marketing Demo Seed Data Plan

**Date:** 2026-04-13  
**Status:** Active  
**Scope:** Narrative-driven seed/test data for local web app review now, with a migration path to a reusable demo mode on the marketing website later.

## Why this plan exists

This is the primary active planning doc for demo-data strategy.

Supporting active companions:
- `docs/plans/active/2026-04-13-marketing-demo-scenario-catalog.md` — canonical scenario content
- `docs/plans/active/2026-04-13-shared-demo-domain-module-plan.md` — package boundary / implementation direction

The web app has grown beyond a basic traces UI. It now presents a fuller Foxhound story:

- fleet overview and leadership summary
- trace investigation
- replay and run diff
- regression detection
- prompt history and prompt diffs
- datasets, evaluators, and experiments
- budgets, SLAs, and notifications

Random synthetic data is no longer enough. Review data now needs to:

1. support believable operator workflows
2. demonstrate causality across pages
3. reinforce Foxhound positioning
4. evolve into a reusable product demo mode for the marketing site

This plan defines a seed-data strategy that works first for local review and later for a polished public-facing demo surface.

---

## Evaluation / done criteria

This planning work is done when we have:

1. a clear narrative set for Foxhound demo use cases
2. a seeded dataset matrix covering the major product surfaces
3. a map from story data to current web app screens
4. a local review walkthrough for manually evaluating the app
5. a forward-compatible structure for future marketing demo mode

---

## Source files reviewed

- `docs/overview/start-here.md`
- `apps/web/README.md`
- `apps/web/lib/demo-data.ts`
- `apps/web/lib/demo-data-advanced.ts`
- `apps/web/components/overview/executive-summary-dashboard.tsx`
- `apps/web/components/overview/fleet-overview.tsx`
- `apps/web/components/traces/trace-table.tsx`
- `apps/web/components/traces/trace-detail-view.tsx`
- `apps/web/components/replay/replay-detail-view.tsx`
- `apps/web/components/diff/run-diff-view.tsx`
- `apps/web/components/datasets/datasets-dashboard.tsx`
- `apps/web/components/evaluators/evaluators-dashboard.tsx`
- `apps/web/components/experiments/experiments-dashboard.tsx`
- `apps/web/components/budgets/budgets-govern-dashboard.tsx`
- `apps/web/components/slas/slas-govern-dashboard.tsx`
- `apps/web/components/regressions/regressions-dashboard.tsx`
- `apps/web/components/prompts/prompt-list-view.tsx`
- `apps/web/components/prompts/prompt-diff-view.tsx`
- `apps/web/components/notifications/notifications-govern-dashboard.tsx`
- `packages/db/src/schema.ts`

---

## Planning principles

### 1. Story beats matter more than realism alone

The seed data should feel realistic, but more importantly it should make the value chain obvious:

**observe → investigate → explain → improve → govern**

### 2. Data must connect across surfaces

A regression shown on the regressions page should also have:

- traces in the trace table
- a replay-worthy failing run
- a useful run diff pair
- prompt metadata if prompt changes are implicated
- dataset items derived from the failure
- evaluator and experiment outcomes tied to the fix

### 3. The same seed system should power two environments

The same narrative data should eventually support:

- **local review mode** inside the web app
- **public marketing demo mode** on the marketing site

That means the data model should be reusable and not tightly coupled to one page implementation.

### 4. Use layered demo data, not one generator

The long-term demo seed strategy should have three layers:

1. **background synthetic data**
   - bulk traces for realism and list density
2. **curated story fixtures**
   - specific traces, prompts, regressions, datasets, and experiments
3. **page rollup summaries**
   - metrics and dashboard summaries aligned to the same story

---

## Recommended narrative portfolio

## Primary narrative: Support Copilot

This should be the flagship demo story.

### Why it is the best main story

- easy to understand without technical context
- supports traces, replay, diff, prompts, regressions, evals, budgets, SLAs, and alerts
- creates a strong before/after improvement narrative
- works for both product review and marketing storytelling

### Product framing

Foxhound monitors an AI-powered support operation. A prompt update reduces cost and latency, but introduces a regression in refund handling. Foxhound detects the issue, helps investigate the cause, turns failures into datasets, validates a fix with evaluators and experiments, and gives operators confidence before rollout.

### Primary org

- `org_support_copilot`
- plan: `team`
- llm evaluation enabled
- enough activity to drive all major dashboards

### Primary agents

- `support-router`
- `support-rag-agent`
- `refund-policy-agent`
- `escalation-agent`

---

## Secondary narrative: Code Review Bot

### Purpose

Supports more technical buyer stories and cost-routing narratives.

### Org

- `org_code_review`

### Agents

- `pr-triage-agent`
- `review-agent`
- `test-fix-agent`

### Best use

- budget hotspot examples
- model-routing cost optimization
- trace diversity beyond support workflows

---

## Secondary narrative: Research Analyst

### Purpose

Supports long-running workflows, tool-heavy traces, and replay.

### Org

- `org_research_ops`

### Agents

- `research-agent`
- `citation-agent`
- `synthesis-agent`

### Best use

- long latency examples
- retries and tool chains
- long session replay stories

---

## Control narrative: Quiet Healthy Tenant

### Purpose

Prevents the product from looking unrealistically saturated with incidents.

### Org

- `org_quiet_healthy`

### Best use

- clean baseline tenant
- lower-volume healthy activity
- multi-tenant realism

---

## Core hero story

## “Prompt v18 made support cheaper but worse on refunds”

This should be the anchor use-case used in local review and future marketing demo mode.

### Beginning

- support runs are mostly healthy
- operators want to reduce cost and latency
- prompt `support-reply` version 18 is rolled out

### Middle

- refund-related failures increase
- escalation behavior degrades
- regressions and SLA warnings appear
- notifications route alerts to the team
- trace detail, replay, and run diff isolate the change
- prompt history and prompt diff reveal the likely cause

### End

- failed traces become a dataset
- evaluators score correctness and escalation behavior
- experiments compare v17, v18, and v19
- v19 restores quality at acceptable cost
- leadership gets a clear ship/no-ship signal

This is the best end-to-end Foxhound product narrative in the current surface area.

---

## Seed data architecture recommendation

## Layer 1: Broad background synthetic data

Purpose: make the product feel active and real.

Should provide:

- trace volume for table filtering/search
- mixed environments
- mixed statuses
- sessions and agents
- enough recent activity to populate overview surfaces

This can remain generator-based.

## Layer 2: Curated story fixtures

Purpose: support high-value demo moments.

Should include:

- paired baseline/regression/fix traces
- replay-worthy traces
- prompt version histories
- regression records
- datasets derived from bad traces
- evaluator records and mixed health
- experiments with clear outcomes
- budget/SLA hotspots
- alert routing examples

This should be mostly hand-authored or generated from explicit scenario definitions.

## Layer 3: Rollup summary fixtures

Purpose: make overview, executive, and governance pages tell a consistent story.

Should include:

- executive summary metrics
- fleet overview change feed
- budget hotspots
- SLA risk states
- notification routing summaries
- regression headlines

These should align with the curated fixtures, not be independent random summaries.

---

## Primary org seed specification

## Organization

### `org_support_copilot`

Recommended fields:

- name: `Support Copilot`
- slug: `support-copilot`
- plan: `team`
- `llmEvaluationEnabled: true`
- retention days: `90`
- sampling rate: `1.0`

## Users and memberships

Create at least three users attached to the primary org:

1. owner / platform lead
2. admin / reliability engineer
3. member / evaluation operator

Even if not all user surfaces are visible yet, this makes the tenant feel operationally real.

---

## Trace plan for the primary org

### Volume

Seed approximately **140 traces** over the last **14 days**.

### Distribution

- healthy: 70%
- degraded but completed: 20%
- failed: 10%

### Agent mix

- `support-router`: 25%
- `support-rag-agent`: 45%
- `refund-policy-agent`: 20%
- `escalation-agent`: 10%

### Scenario buckets

#### Bucket A: healthy common support

Examples:

- password reset
- order status
- shipping delay
- account access

Purpose:

- healthy baseline traces
- supports comparison against regressions
- gives trace table realistic density

#### Bucket B: refund edge cases

Examples:

- refund requested after 35 days
- damaged item with no receipt
- annual subscription refund request
- partial refund for duplicate charge

Purpose:

- flagship regression story
- source for datasets
- strongest experiment/evaluator use case

#### Bucket C: escalation-required cases

Examples:

- chargeback mention
- legal threat
- abusive customer behavior
- VIP customer complaint

Purpose:

- supports escalation correctness evaluation
- useful for prompt and replay review

#### Bucket D: noisy infra/tool failures

Examples:

- knowledge base search timeout
- tool retry chain
- LLM rate limiting
- malformed context payload

Purpose:

- makes replay and investigation surfaces richer
- prevents all failures from looking prompt-related

---

## Required trace metadata for story continuity

All primary-org traces should include rich metadata, especially traces used for diff/replay/regression stories.

### Required metadata fields

- `workflow`
- `environment`
- `user_id`
- `ticket_id`
- `customer_tier`
- `issue_type`
- `language`
- `prompt_name`
- `prompt_version`
- `release_version`
- `model_provider`
- `model_name`

### Recommended values

#### `issue_type`
- `refund`
- `shipping`
- `billing`
- `account`
- `safety`

#### `customer_tier`
- `self-serve`
- `premium`
- `enterprise`

#### prompt/release fields
- `prompt_name: support-reply`
- `prompt_version: 17 | 18 | 19`
- `release_version: 2026.04.10 | 2026.04.12 | 2026.04.13`

These metadata fields are especially important because current trace detail and run diff views explicitly surface prompt context.

---

## Span design for the primary story

Use a stable workflow shape for support traces so run diff remains interpretable.

### Recommended span sequence

1. `Handle Support Ticket` (`workflow`)
2. `Classify Intent` (`llm_call`)
3. `Retrieve Customer Context` (`tool_call`)
4. `Search Policy Knowledge Base` (`tool_call`)
5. `Generate Draft Response` (`llm_call`)
6. `Check Refund Eligibility` (`agent_step` or `tool_call`)
7. `Escalation Decision` (`agent_step`)
8. `Finalize Response` (`llm_call`)

### Recommended span attributes

#### On llm spans
- `model`
- `input_tokens`
- `output_tokens`
- `cost`
- `temperature`

#### On tool spans
- `tool`
- `latency_ms`
- `result_count`
- `retry_count`
- `timeout`

#### On agent-step spans
- `policy_result`
- `confidence`
- `escalation_required`
- `quality_score`

This gives trace detail, replay, and diff enough signal to tell a meaningful story.

---

## Curated run-diff pairs

Run Diff should be powered by deliberate trace pairs, not arbitrary selections alone.

Seed at least **8 curated pairs**.

### Pair 1: refund baseline vs regression
- same refund request
- v17 correct
- v18 incorrect denial
- lower cost and lower latency, but worse behavior

### Pair 2: damaged-item baseline vs regression
- v17 escalates correctly
- v18 hallucinates unsupported policy outcome

### Pair 3: refund regression vs fix
- v18 bad
- v19 corrected
- slightly higher cost, much better correctness

### Pair 4: VIP complaint regression vs fix
- v18 misses escalation
- v19 escalates correctly

### Pair 5: cost optimization win
- same shipping inquiry
- cheaper model route performs equally well
- demonstrates Foxhound can validate improvements, not just failures

### Pair 6: timeout vs resilient recovery
- one run fails due to tool timeout
- paired run succeeds via retry/fallback path

### Pair 7: latency optimization
- same quality, better duration
- useful for SLA story without being a regression

### Pair 8: release-change, same prompt
- prompt same, release version changed
- proves not every divergence is caused by prompt edits

---

## Replay-worthy traces

Seed at least **10 traces** optimized for replay.

Characteristics:

- 8–15 spans each
- visible state evolution
- at least 4 with error transitions
- at least 2 with retries and recovery
- at least 2 tied directly to prompt regression story

### Best replay scenarios

1. KB timeout → retry → fallback → degraded answer
2. refund lookup mismatch
3. escalation threshold missed
4. multi-step enterprise ticket flow
5. long successful resolution
6. contradictory customer data from tools
7. circuit breaker triggered
8. partial success then manual escalation
9. prompt v18 changed policy behavior
10. v19 corrected path

---

## Prompt seed plan

The prompt surfaces need meaningful version histories, not placeholder content.

### Prompt: `support-reply`
Versions:
- v17: trusted baseline
- v18: cost-optimized but risky
- v19: corrected version

### Prompt: `refund-policy-check`
Versions:
- v3: baseline
- v4: too strict / regression-inducing
- v5: corrected

### Prompt: `escalation-triage`
Versions:
- v7
- optional v8 if a second comparison path is helpful

### Prompt diff goals

At least one prompt diff should visibly show:

- removal of an uncertainty/escalation guardrail
- stronger pressure toward brevity or cost reduction
- a policy wording shift that plausibly explains a regression
- optionally a model/config change, not just content change

---

## Regression dashboard seed plan

Seed **5–7 regression records** for the primary org.

### Recommended regression set

1. refund denials increased after `support-reply v18`
2. escalation misses on premium customers
3. shipping-delay latency increased after KB reindex
4. duplicate retrieval path increased support cost
5. refund lookup timeout spike
6. unsupported policy claims in edge refund cases
7. one resolved regression shown as healthy

Each regression should point back to:

- a trace
- a run diff
- prompt history when relevant

---

## Dataset seed plan

Seed **4 datasets** for the primary org.

### Dataset 1: `refund-edge-cases`
- 24 items
- from low-scoring or failed refund traces
- flagship improvement dataset

### Dataset 2: `escalation-policy-cases`
- 16 items
- from cases requiring correct escalation behavior

### Dataset 3: `support-hallucination-guardrails`
- 12 items
- from unsupported claims and grounding failures

### Dataset 4: `latency-sensitive-common-questions`
- 20 items
- from healthy but high-volume support workflows
- used for cost/speed optimization experiments

### Required dataset item fields

- `input`
- `expectedOutput`
- `metadata`
  - `issue_type`
  - `severity`
  - `customer_tier`
  - `source`
  - `prompt_version_at_capture`
- `sourceTraceId` when applicable

These datasets should directly support the experiments and evaluators pages.

---

## Evaluator seed plan

Seed **4 core evaluators** for the primary story.

### Evaluator 1: `helpfulness`
- numeric
- broad response quality

### Evaluator 2: `refund_policy_correctness`
- categorical
- labels: `correct | incorrect | partial`

### Evaluator 3: `escalation_correctness`
- categorical
- labels: `escalate | no_escalate | unclear`

### Evaluator 4: `policy_groundedness`
- numeric or categorical
- ensures outputs stay tied to supported policy

### Optional evaluator 5
- `tone_professionalism`

### Evaluator health mix

Seed mixed health so the Evaluators dashboard has shape:

- 2 healthy
- 1 warning
- 1 critical or stale/failing latest run

---

## Experiment seed plan

Seed **3 experiments**.

### Experiment 1: `refund-recovery-v19`
- dataset: `refund-edge-cases`
- compares v17 vs v18 vs v19
- status: completed
- result: v19 restores correctness with acceptable cost increase

### Experiment 2: `cheap-common-support-routing`
- dataset: `latency-sensitive-common-questions`
- status: completed
- result: cheaper route preserves quality

### Experiment 3: `escalation-threshold-tuning`
- dataset: `escalation-policy-cases`
- status: running or warning
- result: still unresolved

This mix yields:

- one clear recovery story
- one optimization success story
- one unresolved active investigation

---

## Budget seed plan

The budgets page should show clear hotspots and healthy contrast.

Create `agent_configs` for the primary org.

### `support-rag-agent`
- monthly budget: `$2,500`
- current state: warning, ~91% consumed

### `refund-policy-agent`
- monthly budget: `$900`
- current state: critical, ~118% consumed

### `support-router`
- monthly budget: `$300`
- current state: healthy, ~42% consumed

### `escalation-agent`
- monthly budget: `$500`
- current state: healthy, ~64% consumed

### Hotspot explanations should mention

- duplicate retrieval path
- retries increasing spend
- larger context windows or heavier routing choices

---

## SLA seed plan

Seed visible drift aligned to the same story.

### `support-router`
- max duration: `2000ms`
- min success rate: `99%`
- status: healthy

### `support-rag-agent`
- max duration: `12000ms`
- min success rate: `96%`
- status: warning

### `refund-policy-agent`
- max duration: `8000ms`
- min success rate: `97%`
- status: critical

### `escalation-agent`
- max duration: `5000ms`
- min success rate: `99%`
- status: warning or healthy

### Recommended displayed outcomes

- `refund-policy-agent`: success rate `91.8%`, latency `9.6s`
- `support-rag-agent`: success rate `95.2%`, latency `11.4s`

---

## Notifications seed plan

Seed a simple but believable routing model.

### Channels

1. `#support-ai-alerts`
   - slack
   - healthy
2. `#platform-ops`
   - slack
   - warning
3. `#exec-digest`
   - slack
   - healthy

### Alert rules

- cost budget exceeded
- SLA duration breach
- SLA success-rate breach
- behavior regression

### Notification log

Seed around **12–20 records** with:

- several sent alerts
- one failed delivery
- one recent critical regression notification
- one recent SLA warning

This keeps the notifications page grounded and useful.

---

## Executive and overview rollups

These pages should summarize the same underlying story.

### Fleet overview example metrics

- monitored agents: `14`
- runs in last 24h: `3,842`
- regressions needing review: `3`
- budget risk agents: `2`

### Executive summary example metrics

- fleet reliability: `96.8%`
- budget exposure: `$1.3k at risk`
- open regressions: `3`
- candidates ready to promote: `1`

### Good highlight examples

- `Refund-policy-agent regression emerged within 2 hours of prompt v18 rollout.`
- `v19 recovered policy correctness on 92% of refund edge cases while adding only 6% cost.`
- `One Slack notification route failed delivery; critical alerts still reached platform ops.`

---

## Minimum viable seeded dataset matrix

## Primary org: `org_support_copilot`

- traces: 140
- replay-optimized traces: 10
- curated run-diff pairs: 8
- prompts: 3
- total prompt versions: 7–8
- regressions: 5–7
- datasets: 4
- total dataset items: 72
- evaluators: 4–5
- experiments: 3
- budget-configured agents: 4
- SLA-configured agents: 4
- notification channels: 3
- alert rules: 4
- notification log records: 12–20

## Secondary org: `org_code_review`

- traces: 30
- one budget hotspot story
- one optimization story

## Secondary org: `org_research_ops`

- traces: 20
- several long-running replay-worthy traces

## Control org: `org_quiet_healthy`

- traces: 6
- all healthy or nearly all healthy

---

## Screen-to-data mapping

## Overview / Fleet Overview
Needs:
- mixed fleet health
- recent changes
- action queue
- at least one regression and one cost hotspot

## Executive Summary
Needs:
- leadership metrics
- decision queue
- short, boardroom-friendly highlights

## Traces Table
Needs:
- enough density for filters and search
- multiple agents
- healthy and failing traces
- some session IDs
- repeated comparable scenarios

## Trace Detail
Needs:
- rich metadata
- span-level cost
- prompt name/version
- links to replay, diff, prompts, datasets

## Replay
Needs:
- meaningful state transitions
- retries, timeouts, and branching outcomes

## Run Diff
Needs:
- curated paired traces
- measurable deltas in cost, duration, spans, and errors
- prompt metadata where relevant

## Regressions
Needs:
- clear causal clues
- links to trace, diff, and prompt history

## Prompts
Needs:
- named prompts with meaningful version history
- at least one compelling diff

## Datasets
Needs:
- datasets visibly derived from production failures or weak scores

## Evaluators
Needs:
- coverage and health mix
- adoption summaries

## Experiments
Needs:
- one clear win
- one cost optimization success
- one unresolved active case

## Budgets
Needs:
- 1 critical hotspot
- 1 warning hotspot
- healthy contrast cases

## SLAs
Needs:
- one clear breach
- one warning trend
- healthy baselines

## Notifications
Needs:
- routing summaries
- delivery recency
- at least one delivery issue

---

## Local review walkthrough

## Walkthrough 1: detect and investigate a regression

1. Open overview
2. Identify refund regression in the action queue
3. Open regressions dashboard
4. Open the linked failing trace
5. Open replay for that trace
6. Compare against baseline in run diff
7. Jump to prompt comparison

## Walkthrough 2: validate the fix

1. Open datasets
2. Open `refund-edge-cases`
3. Review evaluators tied to refund correctness
4. Open experiment `refund-recovery-v19`
5. Verify that v19 is the winning candidate
6. Return to executive summary to review decision-ready outcome

## Walkthrough 3: inspect budget risk

1. Open budgets
2. Select `refund-policy-agent`
3. Jump to traces or regressions
4. Inspect duplicate retrieval or retry-heavy runs
5. Confirm whether experiment data shows acceptable recovery path

## Walkthrough 4: verify operational routing

1. Open notifications
2. Review recent critical and warning deliveries
3. Confirm at least one failed delivery example exists
4. Follow links to regressions or SLA pages

---

## Marketing website future-state design constraints

This seed data will likely become a **demo mode on the marketing website**. That changes how we should structure it now.

### Design constraint 1: data must be portable

Do not design demo fixtures as tightly coupled page mocks. Prefer shared scenario definitions that can be consumed by:

- web app local demo routes
- marketing site interactive product tour
- screenshots, videos, and demo recordings

### Design constraint 2: hero stories must be legible in under 30 seconds

For marketing demo use, the data should support very fast understanding:

- what changed
- why it matters
- how Foxhound helps
- what decision the user can make next

### Design constraint 3: public demo should feel real but safe

The eventual marketing demo should avoid anything that feels too obviously fake while also avoiding customer-like sensitive data.

Use fictional but coherent:

- company names
- tickets
- policy scenarios
- users and identifiers

### Design constraint 4: narrative density beats raw volume

The marketing site will benefit more from:

- fewer but better-linked records
- stronger before/after pairs
- clearer rollups

than from large amounts of random traffic.

### Design constraint 5: support both passive and interactive review

The same seed set should work for:

- passive screenshots and landing-page embeds
- interactive self-serve product demo
- local QA/dogfooding

---

## Recommended implementation direction for future work

When implementation starts, create a reusable demo domain package or shared module that separates:

### A. scenario definitions
Examples:
- `support_refund_regression`
- `support_refund_fix`
- `kb_timeout_recovery`
- `cheap_routing_win`

### B. derived entities
Examples:
- traces
- prompts and prompt versions
- regressions
- datasets and dataset items
- evaluators and runs
- experiments and results
- budgets, SLAs, and alerts

### C. page projections
Examples:
- overview metrics
- executive summary cards
- budget hotspot list
- regression dashboard rows

This will keep marketing demo mode maintainable and prevent page-specific fixture duplication.

---

## Recommended next deliverables

## Deliverable 1: scenario catalog

A concrete fixture blueprint listing:

- all orgs
- all prompts and versions
- all curated trace pairs
- all datasets
- all evaluators
- all experiments
- all regressions

## Deliverable 2: implementation-oriented data schema

A TypeScript-first seed blueprint for:

- scenario definitions
- trace builders
- derived rollup builders
- marketing-demo-safe content model

## Deliverable 3: review checklist

A page-by-page local review checklist that references exact seeded entities to click.

---

## Recommendation

Proceed with the **Support Copilot** story as the primary seed foundation and treat all other orgs as supporting context.

That gives the team one extremely strong narrative now for local review and one reusable hero story later for the marketing website’s demo mode.
