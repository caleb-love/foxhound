# Demo Narrative Cheat Sheet — 2026-04-14

Use this artifact for live demos, screenshot capture, async reviews, and future handoffs.

## Goal

Tell a coherent story across a **7-day operating window**:
- stable baseline
- mid-week rollout
- regression fallout
- investigation
- evaluation
- recovery
- governance follow-through

The current shared source of truth for this story is:
- `packages/demo-domain/src/support-copilot.ts`

---

## Primary Demo Flow

Use this order for the strongest live narrative:

1. `/demo`
2. `/demo/traces/trace_support_refund_v18_regression`
3. `/demo/diff?a=trace_support_refund_v17_baseline&b=trace_support_refund_v18_regression`
4. `/demo/replay/trace_support_refund_v18_regression`
5. `/demo/regressions`
6. `/demo/datasets`
7. `/demo/experiments`
8. `/demo/budgets`
9. `/demo/slas`
10. `/demo/notifications`
11. `/demo/diff?a=trace_support_refund_v18_regression&b=trace_support_refund_v19_fix`

---

## 60–90 Second Talk Track

### 1. Overview
**Route:** `/demo`

**What to say**
- “This tenant now shows a full week of agent operations, not just a few static traces.”
- “You can see the pattern: stable baseline, a mid-week rollout, regression fallout, and late-week recovery.”

**What to point at**
- 7-day trace corpus
- open regressions
- budget risk
- promotion candidates

---

### 2. Hero Regression Trace
**Route:** `/demo/traces/trace_support_refund_v18_regression`

**What to say**
- “This is the hero failing run.”
- “The system got cheaper and a bit faster after v18, but refund quality dropped.”

**What to point at**
- `refund-policy-agent`
- prompt version context
- error/degraded path
- trace detail as the root of the entire story

---

### 3. Diff: Baseline vs Regression
**Route:** `/demo/diff?a=trace_support_refund_v17_baseline&b=trace_support_refund_v18_regression`

**What to say**
- “Here’s the before/after.”
- “The baseline handled the policy correctly. The rollout reduced cost, but removed enough nuance to break refund behavior.”

**What to point at**
- baseline vs regression
- cheaper/faster vs lower quality
- prompt/version-linked root cause

---

### 4. Replay
**Route:** `/demo/replay/trace_support_refund_v18_regression`

**What to say**
- “Replay shows exactly where the workflow drifted.”
- “This is what makes debugging agent systems faster than reading logs in isolation.”

**What to point at**
- step-by-step execution
- exact transition into degraded behavior
- prompt context links

---

### 5. Regressions
**Route:** `/demo/regressions`

**What to say**
- “The regression wasn’t isolated.”
- “Once the rollout happened, we saw related issues: hallucinated policy behavior, missed escalation, and KB timeout pressure.”

**What to point at**
- multiple regressions from the same incident week
- prompt families implicated
- validated recovery path

---

### 6. Datasets
**Route:** `/demo/datasets`

**What to say**
- “We turn production failures into reusable evaluation datasets.”
- “That means the fix is tested against what actually broke in production.”

**What to point at**
- refund dataset
- escalation dataset
- premium billing recovery dataset
- source-trace linkage

---

### 7. Experiments
**Route:** `/demo/experiments`

**What to say**
- “Now we compare candidate fixes against trace-derived datasets.”
- “The system doesn’t just suggest a fix — it gives you evidence for promotion.”

**What to point at**
- `refund-recovery-v19`
- `cheap-common-support-routing`
- `premium-billing-recovery`
- multiple promotion-ready candidates

---

### 8. Budgets
**Route:** `/demo/budgets`

**What to say**
- “Behavior regressions are also cost events.”
- “Bad routing and retries drove refund-policy spend over budget.”

**What to point at**
- refund-policy-agent critical overspend
- support-rag-agent near limit
- escalation-agent warning pressure

---

### 9. SLAs
**Route:** `/demo/slas`

**What to say**
- “The same incident also shows up as reliability drift.”
- “So quality, cost, and latency are all tied together.”

**What to point at**
- refund-policy-agent critical breach
- support-rag-agent warning
- support-router healthy baseline

---

### 10. Notifications
**Route:** `/demo/notifications`

**What to say**
- “And these aren’t isolated dashboards — they route into ops channels.”
- “The same incident flows through platform ops, support AI alerts, exec digest, and premium support monitoring.”

**What to point at**
- one warning route for realism
- premium support channel
- governance surfaces tied to the same incident week

---

### 11. Recovery Diff
**Route:** `/demo/diff?a=trace_support_refund_v18_regression&b=trace_support_refund_v19_fix`

**Closing line**
- “This is the recovery story.”
- “Foxhound detects the regression, explains it, builds the eval set from real traces, validates the fix, and shows the budget/SLA impact before promotion.”

---

## Short Pitch Versions

### One-line product pitch
“Foxhound turns one week of real agent failures into a single investigation, evaluation, and governance loop — from trace replay to safe promotion.”

### Stronger positioning line
“Not just observability — observability that closes the loop on agent behavior.”

---

## Best Pages for Screenshots

Capture these first:

1. `/demo`
2. `/demo/traces`
3. `/demo/traces/trace_support_refund_v18_regression`
4. `/demo/diff?a=trace_support_refund_v17_baseline&b=trace_support_refund_v18_regression`
5. `/demo/regressions`
6. `/demo/experiments`
7. `/demo/budgets`
8. `/demo/slas`
9. `/demo/notifications`

---

## Suggested Presenter Timing

### 30-second version
- Overview
- Hero regression trace
- Baseline vs regression diff
- Recovery diff

### 60-second version
- Overview
- Hero trace
- Baseline vs regression diff
- Replay
- Datasets
- Experiments
- Recovery diff

### 90-second version
- Overview
- Hero trace
- Baseline vs regression diff
- Replay
- Regressions
- Datasets
- Experiments
- Budgets
- SLAs
- Notifications
- Recovery diff

---

## Review Checklist

Before using this in a real demo, verify:

- [ ] `/demo` renders the week-long summary cleanly
- [ ] Hero regression trace opens correctly
- [ ] Baseline vs regression diff loads
- [ ] Replay works for the hero trace
- [ ] Regressions page shows multiple linked issues
- [ ] Datasets page reflects weekly evidence coverage
- [ ] Experiments page shows multiple candidates and winners
- [ ] Budgets page shows refund-policy-agent overspend
- [ ] SLAs page shows refund-policy-agent breach
- [ ] Notifications page shows multiple channels including premium-support monitoring
- [ ] Recovery diff loads and clearly shows the v19 fix path

---

## Durable Notes for Future Agents

If the demo data changes again:
- preserve the week-long timeline structure
- keep one clear hero regression + one clear hero recovery path
- make background traffic denser only if it improves realism without obscuring the main story
- keep improve/govern pages tied to the same incident narrative instead of drifting into unrelated examples
