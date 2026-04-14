# Demo Review Checklist

**Date:** 2026-04-13  
**Scope:** Review the shared `packages/demo-domain` powered `/demo` experience in `apps/web`.

## Purpose

This checklist is for reviewing the new narrative-driven demo experience locally.

It is optimized to verify:
- route coverage
- narrative continuity
- cross-link correctness
- story quality for future marketing-demo reuse

---

## Preconditions

Before running this checklist:

1. install dependencies if needed
2. start the web app
3. open the demo routes locally

### Expected commands

From repo root:

```bash
pnpm install
pnpm --filter web dev
```

Expected local app URL:
- `http://localhost:3001`

Primary demo root:
- `http://localhost:3001/demo`

---

## Seeded story to verify

The hero demo story is:

> `support-reply` v18 reduced cost and latency but introduced refund regressions. Foxhound helps detect the issue, investigate the failure, compare runs, inspect prompt changes, derive datasets, validate the recovery candidate, and review governance consequences.

Everything below should reinforce that story.

---

# Section 1 — Overview and executive summary

## 1.1 Demo overview page

### Route
- `/demo`

### Verify
- page renders without auth
- overview metrics render
- change feed references the prompt rollout / regression / KB timeout story
- action queue references refund regression, cost/latency drift, and alert routing
- recommended actions link to real demo routes

### Expected narrative
- refund regression is the main issue
- v19 looks like the recovery path
- governance surfaces matter, not just traces

---

## 1.2 Demo executive summary page

### Route
- `/demo/executive`

### Verify
- executive metrics render
- decision queue includes:
  - promote v19 decision
  - cost containment decision
  - notification/routing decision
- highlight cards reference the shared demo-domain story

### Expected narrative
- leadership can decide whether the recovery is safe to promote
- costs and routing remain part of the decision

---

# Section 2 — Traces and investigation flow

## 2.1 Demo traces list

### Route
- `/demo/traces`

### Verify
- trace list renders more than just 2–3 records
- curated traces exist alongside healthy background traces
- trace table supports filtering/search without looking empty
- hero traces appear:
  - `trace_support_refund_v17_baseline`
  - `trace_support_refund_v18_regression`
  - `trace_support_refund_v19_fix`
  - `trace_damage_receipt_v18_hallucination`
  - `trace_vip_chargeback_v18_missed_escalation`
  - `trace_kb_timeout_failed`

### Expected narrative
- the product feels active
- not every trace is broken
- the demo feels like a real tenant, not just a tiny story stub

---

## 2.2 Hero regression trace detail

### Route
- `/demo/traces/trace_support_refund_v18_regression`

### Verify
- trace detail page renders
- prompt metadata is present
- cost / errors / spans / duration show correctly
- investigation actions link to demo routes, not non-demo routes

### Click and verify
- compare run link
- replay link if route exists in demo flow
- prompt history link
- prompt comparison link
- dataset/improvement link

### Expected narrative
- this trace clearly looks like the central regression artifact

---

## 2.3 Hallucination trace detail

### Route
- `/demo/traces/trace_damage_receipt_v18_hallucination`

### Verify
- trace renders correctly
- this feels distinct from the hero refund regression
- prompt metadata points at refund-policy prompt family

### Expected narrative
- this shows a different but related failure class: unsupported policy claims

---

## 2.4 KB timeout trace detail

### Route
- `/demo/traces/trace_kb_timeout_failed`

### Verify
- timeout/infrastructure-style failure is visible
- trace does not feel like a purely prompt-caused issue

### Expected narrative
- the demo supports both model/prompt problems and infrastructure/tool problems

---

# Section 3 — Run diff flow

## 3.1 Hero regression diff

### Route
- `/demo/diff?a=trace_support_refund_v17_baseline&b=trace_support_refund_v18_regression`

### Verify
- diff page loads
- metrics delta shows believable change
- prompt context appears if available
- links stay inside `/demo`

### Expected narrative
- v18 is cheaper/faster but worse
- this is the cleanest explanation page for the main story

---

## 3.2 Recovery diff
n
### Route
- `/demo/diff?a=trace_support_refund_v18_regression&b=trace_support_refund_v19_fix`

### Verify
- v19 appears to restore quality
- narrative points toward recovery/promotion review

### Expected narrative
- this is the clearest evidence that the fix works

---

## 3.3 Escalation recovery diff

### Route
- `/demo/diff?a=trace_vip_chargeback_v18_missed_escalation&b=trace_vip_chargeback_v19_restored_escalation`

### Verify
- this path feels like a second meaningful investigation story, not a duplicate of refund behavior

---

## 3.4 Timeout recovery diff

### Route
- `/demo/diff?a=trace_kb_timeout_failed&b=trace_kb_timeout_recovered`

### Verify
- shows infrastructure/fallback recovery story

---

# Section 4 — Prompt surfaces

## 4.1 Prompt list

### Route
- `/demo/prompts`

### Verify
- prompt list renders from shared demo-domain data
- prompt families appear:
  - `support-reply`
  - `refund-policy-check`
  - `escalation-triage`

### Expected narrative
- prompts are clearly part of the investigation/improvement loop

---

## 4.2 support-reply prompt detail

### Route
- `/demo/prompts/prompt_support_reply`

### Verify
- versions render in descending order
- versions 17 / 18 / 19 appear
- narrative roles make sense
- compare links work

### Expected narrative
- v17 = baseline
- v18 = regression
- v19 = recovery

---

## 4.3 support-reply prompt diff

### Route
- `/demo/prompts/prompt_support_reply/diff?versionA=17&versionB=18`

### Verify
- diff page loads
- changed fields render
- comparison is understandable

### Expected narrative
- prompt change plausibly explains the regression

---

## 4.4 refund-policy-check prompt detail

### Route
- `/demo/prompts/prompt_refund_policy_check`

### Verify
- versions 3 / 4 / 5 appear
- version 4 feels like the risky/hallucination-causing state

---

# Section 5 — Regressions, datasets, experiments

## 5.1 Regressions dashboard

### Route
- `/demo/regressions`

### Verify
- multiple regression records render
- includes:
  - refund regression
  - hallucination regression
  - missed escalation regression
  - KB timeout issue
  - validated refund recovery
- links route correctly to traces/diffs/prompts inside demo mode

### Expected narrative
- there are multiple active investigations, but one hero regression leads the story

---

## 5.2 Datasets dashboard

### Route
- `/demo/datasets`

### Verify
- multiple datasets render
- item counts feel plausible
- source summary connects datasets to trace evidence

### Expected datasets
- `refund-edge-cases`
- `escalation-policy-cases`
- `support-hallucination-guardrails`
- `latency-sensitive-common-questions`

---

## 5.3 Experiments dashboard

### Route
- `/demo/experiments`

### Verify
- experiment list renders
- statuses are mixed
- at least one completed success exists
- at least one unresolved/running experiment exists

### Expected experiments
- `refund-recovery-v19`
- `escalation-threshold-tuning`
- `cheap-common-support-routing`

### Expected narrative
- Foxhound validates fixes before promotion, not just diagnoses issues

---

# Section 6 — Governance surfaces

## 6.1 Budgets dashboard

### Route
- `/demo/budgets`

### Verify
- multiple budget records render
- statuses are mixed
- refund-policy-agent is the most urgent hotspot
- support-rag-agent appears as warning

### Expected narrative
- spend risk connects to the same incident family as the regressions

---

## 6.2 SLA dashboard

### Route
- `/demo/slas`

### Verify
- multiple SLA records render
- statuses are mixed
- refund-policy-agent is a critical breach
- support-rag-agent appears at warning level

### Expected narrative
- latency and success-rate drift reinforce the same investigation path

---

## 6.3 Notifications dashboard

### Route
- `/demo/notifications`

### Verify
- multiple channels render
- one route is warning/degraded
- links route into regressions / budgets / SLAs

### Expected channels
- `#platform-ops`
- `#support-ai-alerts`
- `#exec-digest`

### Expected narrative
- alerts reach real operator surfaces and one route has realistic degradation

---

# Section 7 — Navigation integrity

## 7.1 Stay inside `/demo`

For all major flows, verify links stay in demo mode.

### High-priority click chains

#### Chain A
- `/demo`
- `/demo/traces`
- `/demo/traces/trace_support_refund_v18_regression`
- `/demo/diff?...`
- `/demo/prompts/...`

#### Chain B
- `/demo/regressions`
- trace link
- diff link
- prompt link

#### Chain C
- `/demo/experiments`
- `/demo/datasets`
- `/demo/traces/...`

#### Chain D
- `/demo/budgets`
- `/demo/regressions`
- `/demo/slas`
- `/demo/notifications`

### Verify
- no unexpected jumps to non-demo routes unless intentionally desired
- no broken routes
- no empty “Coming Soon” routes in the main demo story path

---

# Section 8 — Review evidence to capture

If capturing screenshots or review evidence, prioritize these pages:

1. `/demo`
2. `/demo/executive`
3. `/demo/traces`
4. `/demo/traces/trace_support_refund_v18_regression`
5. `/demo/diff?a=trace_support_refund_v17_baseline&b=trace_support_refund_v18_regression`
6. `/demo/prompts/prompt_support_reply`
7. `/demo/prompts/prompt_support_reply/diff?versionA=17&versionB=18`
8. `/demo/regressions`
9. `/demo/experiments`
10. `/demo/budgets`
11. `/demo/slas`
12. `/demo/notifications`

---

# Section 9 — Known follow-up candidates

If issues are found, likely follow-up areas are:

1. prompt route polish
2. additional background traces
3. replay route consistency inside demo mode
4. richer trace-to-dataset navigation
5. future marketing-lite projection from `packages/demo-domain`

---

# Definition of a successful review

The review is successful if:

- the `/demo` experience feels coherent
- the shared story is legible across all major surfaces
- cross-links stay inside demo mode
- the seeded data supports both operator workflows and future marketing storytelling
- the app feels like a product demo, not a pile of disconnected fixtures
