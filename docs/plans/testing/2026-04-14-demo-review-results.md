# Demo Review Results

**Date:** 2026-04-14  
**Checklist:** `docs/plans/testing/2026-04-13-demo-review-checklist.md`  
**Scope:** Shared `packages/demo-domain` powered `/demo` experience in `apps/web`

## Final Verdict

**PASS**

The `/demo` experience is coherent, seeded data supports the intended hero narrative, and the main review paths now stay inside demo mode with working destinations.

---

## Summary of work completed

During review, two implementation issues blocked the demo initially:

1. `apps/web/app/demo/diff/page.tsx` used outdated synchronous `searchParams` access under Next 16.
2. `@foxhound/demo-domain` was declared in `apps/web/package.json` but not linked into `apps/web/node_modules` until `pnpm install` was run.

After restoring the workspace dependency and fixing the diff route, the demo became reviewable. A second pass then fixed navigation integrity issues in the main demo story path.

---

## Files changed during review

- `apps/web/app/demo/diff/page.tsx`
- `packages/demo-domain/src/index.ts`
- `apps/web/components/traces/trace-detail-view.tsx`
- `apps/web/components/diff/run-diff-view.tsx`
- `apps/web/app/demo/regressions/page.tsx`
- `apps/web/components/traces/trace-table.tsx`

---

## Verification evidence

### Commands run

```bash
pnpm install
pnpm --filter @foxhound/demo-domain build
pnpm --filter @foxhound/demo-domain typecheck
pnpm --filter web typecheck
```

### Verified route sweep

All of the following returned `200` during the final verification pass:

- `/demo`
- `/demo/executive`
- `/demo/traces`
- `/demo/traces/trace_support_refund_v18_regression`
- `/demo/diff?a=trace_support_refund_v17_baseline&b=trace_support_refund_v18_regression`
- `/demo/diff?a=trace_support_refund_v18_regression&b=trace_support_refund_v19_fix`
- `/demo/prompts`
- `/demo/prompts/prompt_support_reply`
- `/demo/prompts/prompt_support_reply/diff?versionA=17&versionB=18`
- `/demo/prompts/prompt_refund_policy_check`
- `/demo/regressions`
- `/demo/datasets`
- `/demo/experiments`
- `/demo/budgets`
- `/demo/slas`
- `/demo/notifications`

---

## Checklist review results

## 1 — Overview and executive summary

### 1.1 `/demo`
**PASS**
- Renders without auth
- Overview metrics render
- Change feed references rollout / regression / KB timeout story
- Action queue references refund regression, cost/latency drift, and alert routing
- Recommended actions point to real demo routes

### 1.2 `/demo/executive`
**PASS**
- Executive metrics render
- Decision queue includes v19 promotion, cost containment, and routing decisions
- Highlight cards align with the shared narrative

---

## 2 — Traces and investigation flow

### 2.1 `/demo/traces`
**PASS**
- Trace list renders more than a tiny fixture set
- Curated traces and healthy background traces are both present
- Hero traces expected by the checklist are present
- Demo feels active rather than stubbed

### 2.2 `/demo/traces/trace_support_refund_v18_regression`
**PASS**
- Trace detail renders
- Prompt metadata is present
- Cost / errors / spans / duration render correctly
- Investigation actions route inside `/demo`
- Compare / prompt history / prompt diff / dataset navigation now use valid demo destinations

### 2.3 `/demo/traces/trace_damage_receipt_v18_hallucination`
**PASS**
- Distinct from hero refund regression
- Prompt metadata points to `refund-policy-check`
- Failure class reads as unsupported-policy hallucination

### 2.4 `/demo/traces/trace_kb_timeout_failed`
**PASS**
- Timeout/infrastructure failure is visible
- Trace reads as tool/infrastructure degradation, not just prompt failure

---

## 3 — Run diff flow

### 3.1 Hero regression diff
**PASS**
- Diff page loads
- Metrics delta is believable
- Prompt context appears
- Links remain inside demo mode
- Story clearly shows v18 cheaper/faster but worse

### 3.2 Recovery diff
**PASS**
- v19 reads as recovery candidate
- Supports promotion-review narrative

### 3.3 Escalation recovery diff
**PASS**
- Feels like a distinct second investigation story

### 3.4 Timeout recovery diff
**PASS**
- Shows infrastructure/fallback recovery story

---

## 4 — Prompt surfaces

### 4.1 `/demo/prompts`
**PASS**
- Prompt list renders from shared demo-domain data
- `support-reply`, `refund-policy-check`, and `escalation-triage` are present

### 4.2 `/demo/prompts/prompt_support_reply`
**PASS**
- Versions 17 / 18 / 19 render in descending order
- Narrative roles support baseline / regression / recovery story

### 4.3 `/demo/prompts/prompt_support_reply/diff?versionA=17&versionB=18`
**PASS**
- Diff loads
- Changed fields render clearly
- Comparison is understandable

### 4.4 `/demo/prompts/prompt_refund_policy_check`
**PASS**
- Versions 3 / 4 / 5 appear
- Version 4 reads as the risky/hallucination-causing version

---

## 5 — Regressions, datasets, experiments

### 5.1 `/demo/regressions`
**PASS**
- Multiple regression records render
- Includes refund regression, hallucination regression, missed escalation, KB timeout, and validated refund recovery
- Links route correctly inside demo mode
- Prompt review CTA now points to prompt pages rather than trace pages

### 5.2 `/demo/datasets`
**PASS**
- Multiple datasets render
- Counts feel plausible
- Source summaries connect datasets to trace evidence
- Expected dataset names are present

### 5.3 `/demo/experiments`
**PASS**
- Mixed statuses render
- At least one completed success exists
- At least one unresolved/running experiment exists
- Supports validation-before-promotion narrative

---

## 6 — Governance surfaces

### 6.1 `/demo/budgets`
**PASS**
- Multiple records render
- Statuses are mixed
- `refund-policy-agent` is the urgent hotspot
- `support-rag-agent` appears as warning

### 6.2 `/demo/slas`
**PASS**
- Multiple SLA records render
- Statuses are mixed
- `refund-policy-agent` is critical
- `support-rag-agent` appears at warning

### 6.3 `/demo/notifications`
**PASS**
- Multiple channels render
- One route is degraded/warning
- Links route into regressions / budgets / SLAs
- Expected channels are present

---

## 7 — Navigation integrity

### 7.1 Stay inside `/demo`
**PASS for the main reviewed story path**

Fixed during review:
- Trace detail compare CTA now points to a real diff destination
- Broken/unimplemented replay CTA removed from the main demo path
- Prompt history and prompt comparison CTAs now point to explicit prompt detail/diff routes
- Regressions prompt CTA now points to prompt pages
- Demo trace table no longer links session IDs to unimplemented `/demo/sessions/...`

---

## Successful review definition check

- `/demo` experience feels coherent — **PASS**
- Shared story is legible across major surfaces — **PASS**
- Cross-links stay inside demo mode — **PASS**
- Seeded data supports operator workflows and future marketing storytelling — **PASS**
- App feels like a product demo, not a pile of disconnected fixtures — **PASS**

---

## Remaining caveats

These are minor and not blockers for the review outcome:

- This artifact does not yet include screenshots or a recorded walkthrough
- Replay/session routes are not part of the verified core demo path
- Not every possible click permutation was tested manually in-browser; the primary checklist path was validated through route checks and code-path review

---

## Recommended next steps

If stronger demo evidence is needed, capture the Section 8 pages and package them as:

1. screenshots
2. a short demo recording
3. an HTML review artifact for async stakeholder review
