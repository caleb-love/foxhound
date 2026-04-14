# Foxhound Web Copy Review and GTM Alignment

**Date:** 2026-04-14  
**Audit depth:** surface-exhaustive  
**Scope:** Review the current marketing site copy in `~/Developer/foxhound-web` against the current GTM source of truth, preserve what is working, and propose focused copy changes.

---

## Executive summary

The current marketing site is **much better than a typical early infra site**. It already contains:
- a strong pain-led hero
- strong product-specific language
- useful mechanism proof
- clear feature breadth
- framework-specific SEO landing surfaces
- a generally credible developer-first tone

This is not a rewrite-from-scratch situation.

### The good news
The site already aligns with the GTM direction in several important ways:
- it avoids generic AI fluff
- it leads with pain more than features
- it uses concrete mechanisms like replay, run diff, budgets, and SLA alerts
- it is clearly for technical teams
- it has good SEO/category-entry language

### The main issue
The site currently mixes **three different layers too evenly**:
1. category entry: observability
2. wedge: production improvement loop
3. broad platform inventory: many capabilities and adjacent claims

The GTM source of truth says those layers should be **hierarchical**, not equally weighted.

### The practical recommendation
Do not throw away the current copy.

Instead:
- keep the strong hero and pain language
- tighten the subheadline and section intros around the **loop**
- reduce over-rotation on broad “security/compliance-ish” claims
- make the site feel less like “many strong features” and more like “one strong operating workflow”

---

# 1. Source files reviewed

Primary reviewed files:
- `src/app/page.tsx`
- `src/components/landing/Hero.tsx`
- `src/components/landing/CapabilitiesGrid.tsx`
- `src/components/landing/FeatureComparison.tsx`
- `src/components/landing/ProofStrip.tsx`
- `src/components/landing/DeveloperTools.tsx`
- `src/components/landing/SdkIntegration.tsx`
- `src/components/landing/SecuritySection.tsx`
- `src/components/landing/SeoUseCases.tsx`
- `src/styles/design-system.css`

Reference truth used for comparison:
- `docs/reference/foxhound-gtm-source-of-truth.md`
- `docs/plans/completed/brand-gtm/2026-04-12-website-refresh-plan.md`

---

# 2. What is already good and should be preserved

## A. The hero headline is strong
Current headline:

> **Stop guessing why your agents broke.**

This is excellent.

Why it works:
- problem-first
- clear and immediate
- not generic
- emotionally sharp
- matches the investigation/reliability pain

**Recommendation:** keep it.

---

## B. The pain-story structure in the hero is strong
Current hero pain story:
- Friday ship
- Monday bill
- 40,000 loop calls
- $1,200 cost surprise
- with-Foxhound bullets

This is very aligned with the existing GTM and brand review work.

**Recommendation:** keep the structure and most of the content.

---

## C. The hero already uses real mechanism proof
Examples:
- Cost Budgets would have stopped it at $50
- Session Replay shows exactly where it broke
- SLA monitoring would have alerted you Friday night

This is strong because it connects pain to mechanism.

**Recommendation:** keep this pattern.

---

## D. The site is already developer-first
Good examples:
- install command near the top
- SDK section
- GitHub / MCP / GitHub Actions surfacing
- framework pages
- technical tone over soft marketing

This aligns well with the GTM source of truth.

**Recommendation:** preserve this strongly.

---

## E. The capabilities are genuinely differentiated and worth showing
The current capabilities grid covers:
- Trace Explorer
- Session Replay
- Run Diff
- LLM-as-a-Judge
- Datasets from Traces
- Experiments
- GitHub Actions
- Cost Budgets
- SLA Monitoring
- Regression Detection
- Slack Alerts

This is good material. The issue is not the features themselves. The issue is how they are framed.

**Recommendation:** keep almost all of this, but reorganize the copy around the loop.

---

## F. The comparison section has value
The line:

> **Built for agents, not chatbots**

is strong.

The comparison table helps establish differentiation and category context.

**Recommendation:** keep the section, but soften any areas that read as overly declarative or too feature-checklist heavy without nuance.

---

## G. The use-case / SEO pages are directionally good
The separate pages for LangGraph, CrewAI, Claude agents, OpenAI agents, session replay, and run diff are consistent with the category-entry strategy.

This supports the source-of-truth hierarchy:
- category / framework entry first
- wedge can deepen later

**Recommendation:** keep this strategy.

---

# 3. Main alignment gaps vs GTM source of truth

## Gap 1: The subheadline under the hero is too observability-narrow
Current subheadline:

> Foxhound helps teams understand what happened inside a production agent run — what it called, what it saw, where it changed course, and why it failed.

This is good, but it stops at investigation.

The GTM source of truth says the wedge is not just understanding failures — it is:
- understand
- turn failures into evals
- validate fixes
- ship safer releases

### Recommendation
Keep the investigative clarity, but add the loop.

#### Better direction
Foxhound helps teams understand what happened inside a production agent run, compare what changed, turn failures into evaluation inputs, and ship safer fixes.

---

## Gap 2: Capabilities section headline is too generic
Current section headline:

> **Trace every decision.**

This is good, but too category-level for the main body of the page.

Given the hero already established the pain, this section should move the reader deeper into the loop story.

### Recommendation
Shift from pure tracing language to loop or workflow framing.

#### Better directions
- From broken run to safer release.
- The workflow after the bad run.
- Observe, explain, improve, govern.

You can still keep trace language inside the feature cards.

---

## Gap 3: The three capability groups are good, but not yet fully loop-native
Current groups:
- Full Visibility
- Continuous Testing
- Proactive Control

These are respectable and not wrong.
But the GTM source of truth would make them even stronger as:
- Observe
- Improve
- Govern
or
- Investigate
- Validate
- Control

### Recommendation
Do not throw away the content. Rename the section groups so they map to the GTM loop more directly.

#### Suggested mapping
- **Investigate** (Trace Explorer, Session Replay, Run Diff)
- **Improve** (LLM-as-a-Judge, Datasets from Traces, Experiments, GitHub Actions)
- **Govern** (Cost Budgets, SLA Monitoring, Regression Detection, Alerts)

This would align the homepage more tightly with the dashboard/operator narrative.

---

## Gap 4: Security section contains risky or misaligned claims
Current examples:
- "Database-Level Row Security"
- "Every DB query is scoped by org_id at the database layer. Not application logic, not middleware."
- "SOC 2 Ready"

This area is the clearest copy risk.

### Why this is risky
The broader Foxhound GTM/brand review already warned against compliance-adjacent or over-strong claims.

Specific issues:
- “Database-Level Row Security” may imply actual database-native RLS rather than disciplined query scoping
- “Zero chance of cross-org leakage” is too absolute
- “SOC 2 Ready” is too close to unsupported compliance positioning

### Recommendation
This section should be reframed around:
- self-hosted control
- tenant isolation discipline
- key handling
- auditability
- data control

without sounding certification-ish.

#### Safer replacements
- **Tenant-scoped by design** instead of “Database-Level Row Security”
- **Org-scoped API keys** instead of “Zero chance of cross-org leakage”
- **Built for security-sensitive deployments** instead of “SOC 2 Ready”

This is the biggest copy fix needed.

---

## Gap 5: Developer tools section is useful, but copy slightly overstates “agent control”
Current MCP example copy says things like:
- “31 tools for agent control”

That feels a little off versus the current GTM truth.
Foxhound is strongest as:
- debugging
- investigation
- eval workflows
- governance

not “control” in the strong platform/orchestration sense.

### Recommendation
Adjust phrasing toward:
- debugging workflows
- investigation and evaluation tooling
- policy and governance hooks

#### Better framing
- 31 debugging and evaluation tools for agent workflows
- IDE-native trace, replay, scoring, and evaluation operations

---

## Gap 6: The homepage still treats all proof equally instead of emphasizing the hero loop
The site currently shows many strong surfaces, but there is not enough repeated emphasis on the end-to-end workflow:
- failure
- replay/diff
- trace-derived dataset
- validation
- safer release

### Recommendation
Add one section or repeated copy thread that explicitly narrates this loop.

This is the main missing piece.

#### Suggested section concept
**How Foxhound handles a bad production rollout**
1. find the failing run
2. compare it to a good run
3. replay the execution path
4. turn the bad traces into an eval set
5. validate the fix before promotion

That would align the site tightly with the GTM source of truth.

---

# 4. Recommended messaging hierarchy for the site

## Hero
### Keep
- Stop guessing why your agents broke.
- the Friday/Monday pain story
- install CTA

### Change
Current subheadline should evolve from pure observability to loop framing.

#### Recommended hero subheadline
Foxhound helps teams understand what happened inside a production agent run, compare what changed, turn failures into evaluation inputs, and ship safer fixes.

---

## Proof strip
Current items:
- Self-hosted
- Run diff
- Cost budgets
- Framework-native

These are decent, but not all equally powerful as “proof.”

### Recommendation
Make the strip more loop-specific.

#### Better proof strip directions
- Replay failures
- Diff regressions
- Derive evals from bad traces
- Guard cost and SLA drift

Self-hosted and framework-native are better as trust/support signals than the first proof strip.

---

## Capability section
### Keep the content
The content is strong.

### Change the framing
Use loop-aligned grouping and intro copy.

#### Suggested section header
**From broken run to safer release**

#### Suggested intro
Foxhound is strongest after something goes wrong: investigate the failure, validate the recovery, and govern the rollout.

---

## Comparison section
### Keep
- Built for agents, not chatbots
- side-by-side comparison concept

### Improve
Make sure the surrounding copy emphasizes workflow gaps, not just feature gaps.

#### Stronger intro direction
Most observability tools can show traces. Foxhound is designed for what comes next: understanding regressions, deriving evaluations from real failures, and shipping safer changes.

---

## Security section
### Keep
- self-hosted
- BYO keys
- audit trail / data control themes

### Change heavily
Remove or soften anything that smells like unsupported compliance, database-native RLS, or absolute guarantees.

---

## SDK section
### Keep
- Python first
- code-forward presentation
- framework support messaging

### Improve
The section headline “One decorator, full observability” is okay, but still category-level.

#### Better directions
- Add observability to the workflows you already ship
- Instrument production agent workflows in minutes
- Capture the runs you need to debug and improve

---

# 5. Concrete copy changes I would recommend

## Hero subheadline
### Current
Foxhound helps teams understand what happened inside a production agent run — what it called, what it saw, where it changed course, and why it failed.

### Proposed
Foxhound helps teams understand what happened inside a production agent run, compare what changed, turn failures into evaluation inputs, and ship safer fixes.

---

## Capabilities section headline
### Current
Trace every decision.

### Proposed option 1
From broken run to safer release.

### Proposed option 2
The workflow after the bad run.

### Proposed option 3
Investigate, validate, and govern agent behavior.

---

## Capabilities section intro
### Current
From first tool call to final response — structured traces with spans for every agent step, LLM invocation, and tool execution.

### Proposed
Foxhound starts with traces, but the real value is what comes next: investigate regressions, validate fixes against real failures, and govern cost and reliability before rollout.

---

## Capability group renames
### Current
- Full Visibility
- Continuous Testing
- Proactive Control

### Proposed
- Investigate
- Improve
- Govern

or
- Observe
- Validate
- Control

The first option aligns better with the GTM source of truth.

---

## Comparison section intro
### Current
A side-by-side look at the product gaps teams usually hit when they move from tracing experiments to operating real agent systems.

### Proposed
A side-by-side look at the workflow gaps teams hit when they move from tracing experiments to debugging, validating, and governing real agent systems.

---

## Developer tools section header
### Current
Built for your workflow

### Proposed
Built into developer workflows

### Supporting copy direction
IDE-native debugging, trace inspection, evaluation operations, and CI quality gates for teams shipping agent behavior into production.

---

## Security section title
### Current
Your data, your infrastructure.

### Keep
This is good.

### But revise cards like:

#### Replace
**Database-Level Row Security**

with
**Tenant-scoped by design**

#### Replace
**SOC 2 Ready**

with
**Built for security-sensitive deployments**

#### Replace
**Zero chance of cross-org leakage**

with
**API keys are scoped per organization and designed to preserve tenant boundaries**

---

# 6. What not to change

## Do not remove the pain-led hero
It is one of the strongest parts of the site.

## Do not remove the install command near the top
That is a strong developer-first move.

## Do not remove the framework-specific SEO pages
They support category entry and discoverability.

## Do not flatten the differentiated features into generic infra copy
Replay, run diff, budgets, regressions, datasets-from-traces, and GitHub Actions are the right proof surfaces.

## Do not overcorrect into overly abstract “platform vision” copy
The current site is good because it stays concrete. Keep that.

---

# 7. Recommended next actions

## Highest priority copy actions
1. tighten the hero subheadline around the loop
2. reframe the capabilities section around Investigate / Improve / Govern
3. add one explicit “bad rollout → safer release” workflow section or narrative thread
4. rewrite the security section to remove risky claims
5. slightly tighten the developer tools language away from “agent control” and toward debugging/eval workflows

## Medium priority
6. refine the proof strip so the first proof items are loop-native
7. tighten comparison section intro around workflow gaps, not just feature gaps
8. review SEO pages for any stale “production-grade/compliance-ish” wording

---

# 8. Bottom line

The current site is already pretty good.

It does **not** need a scorched-earth rewrite.

The right move is to:
- preserve the strong hero
- preserve the concrete mechanism proof
- preserve the developer-first tone
- tighten the hierarchy so the site consistently tells one story:

> Foxhound helps teams go from a bad production agent run to a validated safer fix.

That is the clearest GTM-aligned evolution of the current copy.
