# Marketing Demo Scenario Catalog

**Date:** 2026-04-13  
**Status:** Active  
**Depends on:** `docs/plans/active/2026-04-13-marketing-demo-seed-data-plan.md`

## Purpose

This document turns the seed-data plan into an implementation-oriented scenario catalog.

It defines:

- exact orgs
- exact agent identities
- prompt names and versions
- curated trace scenarios
- run-diff pairs
- replay targets
- regression records
- datasets and dataset items
- evaluators and experiment stories
- budget, SLA, and notification fixtures

This is the source-of-truth catalog for building:

- local demo mode in `apps/web`
- future interactive demo mode on the marketing site
- screenshots, videos, and review walkthroughs

---

## Catalog design rules

### 1. Every important dashboard card should have a named source scenario

No orphan rollups.

### 2. Every hero regression should have a complete chain

A complete chain means:

- trace(s)
- replay target
- run diff pair
- prompt metadata
- regression record
- dataset membership
- evaluator outcome
- experiment context

### 3. Scenario names should be stable

Use stable identifiers that can survive refactors and multiple consumers.

### 4. Public demo content should be safe by default

All names, tickets, customers, and policy content should be fictional but plausible.

---

# 1. Organizations

## ORG-001 — Support Copilot

### ID
`org_support_copilot`

### Display name
`Support Copilot`

### Slug
`support-copilot`

### Plan
`team`

### Role in demo
Primary hero org. Powers nearly every major product narrative.

### Demo posture
- medium/high activity
- mixed health
- active prompt iteration
- active improvement loop
- active governance signals

---

## ORG-002 — Code Review Bot

### ID
`org_code_review`

### Display name
`Code Review Bot`

### Slug
`code-review-bot`

### Plan
`pro`

### Role in demo
Technical buyer secondary narrative focused on cost and engineering-agent workflows.

---

## ORG-003 — Research Ops

### ID
`org_research_ops`

### Display name
`Research Ops`

### Slug
`research-ops`

### Plan
`enterprise`

### Role in demo
Long-running, tool-heavy traces and replay variety.

---

## ORG-004 — Quiet Healthy Tenant

### ID
`org_quiet_healthy`

### Display name
`Quiet Healthy Tenant`

### Slug
`quiet-healthy-tenant`

### Plan
`free`

### Role in demo
Low-volume healthy control tenant.

---

# 2. Users

## Support Copilot users

### USER-001
- id: `user_alex_platform`
- name: `Alex Rivera`
- role: owner
- persona: platform lead

### USER-002
- id: `user_jordan_reliability`
- name: `Jordan Lee`
- role: admin
- persona: reliability engineer

### USER-003
- id: `user_sam_eval`
- name: `Sam Patel`
- role: member
- persona: evaluation operator

---

# 3. Agents

## Support Copilot agents

### AGENT-001
- agentId: `support-router`
- purpose: classify and route incoming support issues

### AGENT-002
- agentId: `support-rag-agent`
- purpose: answer common support requests with policy and customer context

### AGENT-003
- agentId: `refund-policy-agent`
- purpose: handle refund-specific reasoning and policy decisions

### AGENT-004
- agentId: `escalation-agent`
- purpose: determine when human escalation is required

## Code Review Bot agents
- `pr-triage-agent`
- `review-agent`
- `test-fix-agent`

## Research Ops agents
- `research-agent`
- `citation-agent`
- `synthesis-agent`

---

# 4. Prompt catalog

## PROMPT-001 — support-reply

### Prompt ID
`prompt_support_reply`

### Name
`support-reply`

### Purpose
Main support answer generation prompt. Central to hero regression story.

### Versions

#### v17 — Stable baseline
- version: `17`
- model: `gpt-4o`
- narrative role: last known good version
- behavior: balanced correctness and escalation

#### v18 — Cost-optimized regression
- version: `18`
- model: `gpt-4o-mini`
- narrative role: cheaper/faster but introduces refund regression
- intentional diff themes:
  - stronger brevity bias
  - reduced uncertainty language
  - weakened escalation guardrail

#### v19 — Corrected recovery
- version: `19`
- model: `gpt-4o-mini`
- narrative role: restores quality at acceptable cost
- intentional diff themes:
  - explicit escalation on ambiguity
  - stricter policy grounding
  - preserved cost controls where safe

---

## PROMPT-002 — refund-policy-check

### Prompt ID
`prompt_refund_policy_check`

### Name
`refund-policy-check`

### Versions

#### v3 — Stable baseline
#### v4 — Overly strict interpretation
#### v5 — Corrected interpretation

### Narrative role
Useful secondary prompt diff for refund-specific reasoning.

---

## PROMPT-003 — escalation-triage

### Prompt ID
`prompt_escalation_triage`

### Name
`escalation-triage`

### Versions

#### v7 — baseline active version
#### optional v8 — stricter premium-customer escalation

### Narrative role
Supports escalation correctness workflows.

---

# 5. Scenario taxonomy

All curated scenarios should use this pattern:

- **SCN** = scenario definition
- **TRACE** = concrete trace instance
- **PAIR** = run-diff comparison set
- **REG** = regression record
- **DSI** = dataset item
- **EXP** = experiment

---

# 6. Support Copilot hero scenarios

## SCN-001 — common_shipping_status_healthy

### Description
A healthy support response for a routine shipping-status inquiry.

### Issue type
`shipping`

### Customer tier
`self-serve`

### Prompt context
- `support-reply v18` or `v19`

### Expected behavior
- classify correctly
- retrieve context
- answer accurately
- no escalation

### Primary use
- healthy baseline traffic
- cost optimization comparison candidate

---

## SCN-002 — password_reset_healthy

### Description
Routine account-help request resolved quickly.

### Issue type
`account`

### Primary use
- healthy baseline traces
- low-latency examples

---

## SCN-003 — refund_after_window_baseline

### Description
Customer requests refund after policy window; baseline behavior is correct refusal with grounded explanation and optional escalation path if conditions are unclear.

### Issue type
`refund`

### Customer tier
`self-serve`

### Prompt context
- `support-reply v17`
- `refund-policy-check v3`

### Expected behavior
- uses policy lookup
- refuses refund correctly
- grounded explanation
- no hallucinated exception

### Primary use
- baseline for hero diff pair

---

## SCN-004 — refund_after_window_regression

### Description
Same case as SCN-003 under the regression prompt. Response becomes terse, misses nuance, and mishandles escalation guidance.

### Prompt context
- `support-reply v18`
- `refund-policy-check v4`

### Expected behavior in demo
- lower latency
- lower cost
- lower correctness
- likely evaluator failure

### Primary use
- hero regression pair
- dataset source
- regression source

---

## SCN-005 — damaged_item_missing_receipt_baseline

### Description
Customer reports damaged item but lacks receipt. System should escalate or request clarification instead of inventing approval/denial.

### Prompt context
- `support-reply v17`
- `refund-policy-check v3`

### Primary use
- baseline for hallucination/groundedness story

---

## SCN-006 — damaged_item_missing_receipt_regression

### Description
Regression version hallucinates policy and incorrectly denies refund.

### Prompt context
- `support-reply v18`
- `refund-policy-check v4`

### Primary use
- replay target
- prompt-diff-backed regression
- dataset source

---

## SCN-007 — annual_subscription_partial_refund_fix

### Description
v19 handles a difficult subscription refund correctly after v18 failed.

### Prompt context
- `support-reply v19`
- `refund-policy-check v5`

### Primary use
- recovery experiment example
- fix-validation pair

---

## SCN-008 — vip_chargeback_escalation_baseline

### Description
VIP customer mentions chargeback; system must escalate.

### Prompt context
- `support-reply v17`
- `escalation-triage v7`

### Primary use
- escalation correctness baseline

---

## SCN-009 — vip_chargeback_escalation_regression

### Description
Regression version answers directly instead of escalating quickly enough.

### Prompt context
- `support-reply v18`
- `escalation-triage v7`

### Primary use
- escalation regression
- SLA/reliability narrative

---

## SCN-010 — vip_chargeback_escalation_fix

### Description
Corrected version restores escalation.

### Prompt context
- `support-reply v19`
- `escalation-triage v7`

### Primary use
- fix pair
- experiment validation

---

## SCN-011 — kb_timeout_with_retry_failure

### Description
Knowledge base retrieval times out, retry path still degrades answer quality.

### Prompt context
- `support-reply v18`

### Primary use
- replay target
- non-prompt-only failure mode
- regression alternative cause

---

## SCN-012 — kb_timeout_with_retry_recovery

### Description
Similar path, but fallback succeeds and produces acceptable answer.

### Primary use
- resilience comparison
- replay target

---

## SCN-013 — cheap_routing_win_shipping_question

### Description
A common shipping question shifts to a cheaper model route with no quality loss.

### Prompt context
- `support-reply v18` or `v19`

### Primary use
- prove Foxhound supports improvement, not only incident debugging

---

## SCN-014 — duplicate_retrieval_cost_hotspot

### Description
Support-rag flow performs redundant retrieval work and drives overspend.

### Primary use
- budgets hotspot story
- trace-to-cost investigation

---

## SCN-015 — premium_safety_issue_requires_handoff

### Description
Sensitive complaint should trigger clear escalation and careful tone.

### Primary use
- escalation correctness
- helpfulness and tone evals

---

# 7. Concrete trace instances

Use stable trace IDs for curated records. Generated bulk traffic can use synthetic IDs.

## TRACE-001
- id: `trace_support_refund_v17_baseline`
- scenario: `SCN-003`
- status: healthy
- replay priority: medium
- diff priority: high

## TRACE-002
- id: `trace_support_refund_v18_regression`
- scenario: `SCN-004`
- status: degraded/error
- replay priority: high
- diff priority: highest

## TRACE-003
- id: `trace_support_refund_v19_fix`
- scenario: `SCN-007`
- status: healthy
- replay priority: medium
- diff priority: high

## TRACE-004
- id: `trace_damage_receipt_v17_baseline`
- scenario: `SCN-005`
- status: healthy

## TRACE-005
- id: `trace_damage_receipt_v18_hallucination`
- scenario: `SCN-006`
- status: error
- replay priority: high

## TRACE-006
- id: `trace_vip_chargeback_v17_escalate`
- scenario: `SCN-008`
- status: healthy

## TRACE-007
- id: `trace_vip_chargeback_v18_missed_escalation`
- scenario: `SCN-009`
- status: degraded
- replay priority: high

## TRACE-008
- id: `trace_vip_chargeback_v19_restored_escalation`
- scenario: `SCN-010`
- status: healthy

## TRACE-009
- id: `trace_kb_timeout_failed`
- scenario: `SCN-011`
- status: error
- replay priority: high

## TRACE-010
- id: `trace_kb_timeout_recovered`
- scenario: `SCN-012`
- status: healthy
- replay priority: high

## TRACE-011
- id: `trace_shipping_cheap_route_good`
- scenario: `SCN-013`
- status: healthy

## TRACE-012
- id: `trace_duplicate_retrieval_cost_hotspot`
- scenario: `SCN-014`
- status: healthy but expensive

## TRACE-013
- id: `trace_premium_safety_handoff`
- scenario: `SCN-015`
- status: healthy

Add 120+ generated support traces around these curated anchors.

---

# 8. Run diff pairs

## PAIR-001 — hero_refund_regression
- baseline: `trace_support_refund_v17_baseline`
- comparison: `trace_support_refund_v18_regression`
- narrative: cheaper and faster, but incorrect handling

## PAIR-002 — refund_fix_recovery
- baseline: `trace_support_refund_v18_regression`
- comparison: `trace_support_refund_v19_fix`
- narrative: quality restored with modest cost increase

## PAIR-003 — hallucination_regression
- baseline: `trace_damage_receipt_v17_baseline`
- comparison: `trace_damage_receipt_v18_hallucination`
- narrative: groundedness failure and hallucinated policy

## PAIR-004 — escalation_regression
- baseline: `trace_vip_chargeback_v17_escalate`
- comparison: `trace_vip_chargeback_v18_missed_escalation`
- narrative: escalation failure

## PAIR-005 — escalation_fix
- baseline: `trace_vip_chargeback_v18_missed_escalation`
- comparison: `trace_vip_chargeback_v19_restored_escalation`
- narrative: restored escalation logic

## PAIR-006 — timeout_resilience
- baseline: `trace_kb_timeout_failed`
- comparison: `trace_kb_timeout_recovered`
- narrative: retry/fallback recovery path

## PAIR-007 — cheap_route_win
- baseline: a higher-cost shipping-answer baseline trace
- comparison: `trace_shipping_cheap_route_good`
- narrative: lower cost with no quality loss

## PAIR-008 — cost_hotspot_release_change
- baseline: normal support-rag trace
- comparison: `trace_duplicate_retrieval_cost_hotspot`
- narrative: release change introduced spend inflation without prompt change

---

# 9. Replay targets

These traces should be explicitly surfaced in review docs and possibly future marketing demo navigation.

## Primary replay targets
- `trace_support_refund_v18_regression`
- `trace_damage_receipt_v18_hallucination`
- `trace_vip_chargeback_v18_missed_escalation`
- `trace_kb_timeout_failed`
- `trace_kb_timeout_recovered`

## Secondary replay targets
- `trace_support_refund_v19_fix`
- `trace_premium_safety_handoff`

---

# 10. Regression records

## REG-001 — refund_denials_increased_after_v18
- title: `Refund denials increased after support-reply v18`
- severity: critical
- primary trace: `trace_support_refund_v18_regression`
- pair: `PAIR-001`
- prompt link: `support-reply`

## REG-002 — damaged_item_policy_hallucination
- title: `Damaged-item flow hallucinated unsupported policy text`
- severity: critical
- primary trace: `trace_damage_receipt_v18_hallucination`
- pair: `PAIR-003`
- prompt link: `refund-policy-check`

## REG-003 — premium_chargeback_missed_escalation
- title: `Premium chargeback cases missed escalation`
- severity: warning
- primary trace: `trace_vip_chargeback_v18_missed_escalation`
- pair: `PAIR-004`
- prompt link: `support-reply`

## REG-004 — kb_retrieval_timeout_spike
- title: `Knowledge-base timeouts raised degraded-response rate`
- severity: warning
- primary trace: `trace_kb_timeout_failed`
- pair: `PAIR-006`
- prompt link: none required

## REG-005 — duplicate_retrieval_cost_increase
- title: `Duplicate retrieval path inflated support-rag costs`
- severity: warning
- primary trace: `trace_duplicate_retrieval_cost_hotspot`
- pair: `PAIR-008`
- prompt link: none required

## REG-006 — refund_fix_validated
- title: `Refund fix validated in v19 recovery run`
- severity: healthy
- primary trace: `trace_support_refund_v19_fix`
- pair: `PAIR-002`
- prompt link: `support-reply`

---

# 11. Datasets

## DATASET-001 — refund-edge-cases
- id: `dataset_refund_edge_cases`
- item count target: 24
- primary source traces:
  - `trace_support_refund_v18_regression`
  - `trace_damage_receipt_v18_hallucination`
  - `trace_support_refund_v19_fix`

## DATASET-002 — escalation-policy-cases
- id: `dataset_escalation_policy_cases`
- item count target: 16
- primary source traces:
  - `trace_vip_chargeback_v18_missed_escalation`
  - `trace_vip_chargeback_v19_restored_escalation`
  - `trace_premium_safety_handoff`

## DATASET-003 — support-hallucination-guardrails
- id: `dataset_support_hallucination_guardrails`
- item count target: 12
- primary source traces:
  - `trace_damage_receipt_v18_hallucination`
  - selected generated low-groundedness traces

## DATASET-004 — latency-sensitive-common-questions
- id: `dataset_latency_sensitive_common_questions`
- item count target: 20
- primary source traces:
  - `trace_shipping_cheap_route_good`
  - healthy shipping/account traces from background traffic

---

# 12. Representative dataset items

These should be explicitly hand-authored.

## DSI-001
- id: `dsi_refund_after_window_001`
- dataset: `dataset_refund_edge_cases`
- source trace: `trace_support_refund_v18_regression`
- issue_type: `refund`
- expected behavior: grounded refusal with clear explanation

## DSI-002
- id: `dsi_damaged_item_no_receipt_001`
- dataset: `dataset_refund_edge_cases`
- source trace: `trace_damage_receipt_v18_hallucination`
- expected behavior: request clarification or escalate, not hallucinate policy

## DSI-003
- id: `dsi_vip_chargeback_001`
- dataset: `dataset_escalation_policy_cases`
- source trace: `trace_vip_chargeback_v18_missed_escalation`
- expected behavior: immediate escalation

## DSI-004
- id: `dsi_shipping_status_fastpath_001`
- dataset: `dataset_latency_sensitive_common_questions`
- source trace: `trace_shipping_cheap_route_good`
- expected behavior: accurate quick response without escalation

Create the remaining items in the same style.

---

# 13. Evaluators

## EVAL-001 — helpfulness
- id: `eval_helpfulness`
- scoring type: numeric
- model: `gpt-4o`
- dashboard health: healthy

## EVAL-002 — refund_policy_correctness
- id: `eval_refund_policy_correctness`
- scoring type: categorical
- labels: `correct | incorrect | partial`
- model: `gpt-4o`
- dashboard health: critical or warning during regression window

## EVAL-003 — escalation_correctness
- id: `eval_escalation_correctness`
- scoring type: categorical
- labels: `escalate | no_escalate | unclear`
- model: `gpt-4o-mini`
- dashboard health: warning

## EVAL-004 — policy_groundedness
- id: `eval_policy_groundedness`
- scoring type: numeric
- model: `gpt-4o`
- dashboard health: healthy

## Optional EVAL-005 — tone_professionalism
- id: `eval_tone_professionalism`
- scoring type: numeric
- dashboard health: healthy

---

# 14. Evaluator run story

Use evaluator runs to reinforce the same storyline.

## refund regression window
- `eval_refund_policy_correctness` should score several v18 traces as `incorrect`
- `eval_policy_groundedness` should be lower on hallucination traces

## fix validation window
- v19 traces should show recovery on correctness and groundedness

## unresolved area
- one evaluator should have recent failed or stale runs to make the evaluators page visually honest

---

# 15. Experiments

## EXP-001 — refund-recovery-v19
- id: `exp_refund_recovery_v19`
- dataset: `dataset_refund_edge_cases`
- candidates: `support-reply v17, v18, v19`
- status: completed
- winning candidate: `v19`
- summary: restores policy correctness with acceptable cost increase

## EXP-002 — cheap-common-support-routing
- id: `exp_cheap_common_support_routing`
- dataset: `dataset_latency_sensitive_common_questions`
- status: completed
- winning candidate: cheaper route
- summary: lower cost, same quality

## EXP-003 — escalation-threshold-tuning
- id: `exp_escalation_threshold_tuning`
- dataset: `dataset_escalation_policy_cases`
- status: running
- summary: unresolved tradeoff between over-escalation and missed escalation

---

# 16. Budget fixtures

## BUDGET-001
- agent: `support-rag-agent`
- budget period: monthly
- budget: `2500`
- displayed state: warning
- narrative: context growth and duplicate retrieval are driving spend

## BUDGET-002
- agent: `refund-policy-agent`
- budget period: monthly
- budget: `900`
- displayed state: critical
- narrative: retries and low-quality routing are pushing spend beyond plan

## BUDGET-003
- agent: `support-router`
- budget: `300`
- displayed state: healthy

## BUDGET-004
- agent: `escalation-agent`
- budget: `500`
- displayed state: healthy

---

# 17. SLA fixtures

## SLA-001
- agent: `support-router`
- max duration: `2000ms`
- min success rate: `99%`
- displayed state: healthy

## SLA-002
- agent: `support-rag-agent`
- max duration: `12000ms`
- min success rate: `96%`
- displayed state: warning

## SLA-003
- agent: `refund-policy-agent`
- max duration: `8000ms`
- min success rate: `97%`
- displayed state: critical

## SLA-004
- agent: `escalation-agent`
- max duration: `5000ms`
- min success rate: `99%`
- displayed state: warning or healthy

---

# 18. Notification fixtures

## Channels

### CH-001
- id: `channel_support_ai_alerts`
- name: `#support-ai-alerts`
- type: slack
- displayed health: healthy

### CH-002
- id: `channel_platform_ops`
- name: `#platform-ops`
- type: slack
- displayed health: warning

### CH-003
- id: `channel_exec_digest`
- name: `#exec-digest`
- type: slack
- displayed health: healthy

## Alert rules

### RULE-001
- event type: `behavior_regression`
- channel: `#support-ai-alerts`

### RULE-002
- event type: `cost_budget_exceeded`
- channel: `#platform-ops`

### RULE-003
- event type: `sla_duration_breach`
- channel: `#platform-ops`

### RULE-004
- event type: `sla_success_rate_breach`
- channel: `#exec-digest` or `#platform-ops`

## Notification log anchors

### NLOG-001
- regression alert for `REG-001`
- status: sent

### NLOG-002
- SLA alert for `SLA-003`
- status: sent

### NLOG-003
- budget alert for `BUDGET-002`
- status: failed
- purpose: make notifications page honest and operational

---

# 19. Overview and executive rollup fixture targets

## Fleet overview

### Metrics
- monitored agents: `14`
- runs in last 24h: `3842`
- regressions needing review: `3`
- budget risk agents: `2`

### Change feed anchors
- rollout to `support-reply v18`
- refund regression discovered
- v19 experiment completed
- KB index refresh increased latency

### Action queue anchors
- investigate refund-policy-agent regression
- review overspend in support-rag-agent
- validate notification route for platform ops

## Executive summary

### Metrics
- fleet reliability: `96.8%`
- budget exposure: `$1.3k at risk`
- open regressions: `3`
- promotion candidates: `1`

### Decision queue anchors
- promote `support-reply v19`
- contain `refund-policy-agent` overspend
- verify alert routing for critical SLA events

---

# 20. Background synthetic volume targets

In addition to curated fixtures, add background traffic.

## Support Copilot
- 127 generated traces + 13 curated traces = 140 total

## Code Review Bot
- 30 generated traces
- include at least one expensive model-routing change scenario

## Research Ops
- 20 generated traces
- include long-running tool-heavy workflows

## Quiet Healthy Tenant
- 6 traces
- nearly all healthy

---

# 21. Local review click-path shortlist

These are the exact records a reviewer should click first.

## Path A — regression investigation
1. `REG-001`
2. `trace_support_refund_v18_regression`
3. `PAIR-001`
4. `support-reply v17 vs v18`

## Path B — fix validation
1. `dataset_refund_edge_cases`
2. `eval_refund_policy_correctness`
3. `exp_refund_recovery_v19`
4. `PAIR-002`

## Path C — cost governance
1. `BUDGET-002`
2. `trace_duplicate_retrieval_cost_hotspot`
3. `PAIR-008`

## Path D — SLA and replay
1. `SLA-003`
2. `trace_kb_timeout_failed`
3. `PAIR-006`

## Path E — alerts
1. `channel_platform_ops`
2. `NLOG-003`
3. linked budget/SLA issue

---

# 22. Suggested implementation order

## Phase 1
Create shared scenario definitions for:
- orgs
- agents
- prompts
- curated traces
- run-diff pairs

## Phase 2
Add derived story artifacts for:
- regressions
- datasets and representative dataset items
- evaluators and evaluator runs
- experiments

## Phase 3
Add governance and summary artifacts for:
- budgets
- SLAs
- notifications
- fleet overview
- executive summary

## Phase 4
Add background generated traffic around the curated anchors

---

# 23. Recommendation

Treat the following as the non-negotiable hero chain for the first implementation:

- `support-reply v17`
- `support-reply v18`
- `support-reply v19`
- `trace_support_refund_v17_baseline`
- `trace_support_refund_v18_regression`
- `trace_support_refund_v19_fix`
- `PAIR-001`
- `PAIR-002`
- `REG-001`
- `dataset_refund_edge_cases`
- `eval_refund_policy_correctness`
- `exp_refund_recovery_v19`

If only one story is fully implemented first, it should be this one.
