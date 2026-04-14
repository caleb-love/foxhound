# Foxhound Web Surgical Copy Rewrite Plan

**Date:** 2026-04-14  
**Scope:** Exact, component-level copy recommendations for `~/Developer/foxhound-web` aligned to the GTM source of truth.

---

## How to use this doc

This is not a redesign plan.
This is not a scorched-earth rewrite.

It is a **surgical copy plan**:
- keep what is already strong
- tighten the GTM hierarchy
- reduce claim risk
- make the site consistently tell the same story

Primary GTM reference:
- `docs/reference/foxhound-gtm-source-of-truth.md`

Companion review:
- `docs/reference/2026-04-14-foxhound-web-copy-review-and-gtm-alignment.md`

---

# 1. Hero (`src/components/landing/Hero.tsx`)

## Keep
- `Stop guessing why your agents broke.`
- the Friday/Monday/$1,200 pain story structure
- install CTA
- open-source/self-hosted trust cues

## Change
The current subheadline is too investigation-only.

### Current
> Foxhound helps teams understand what happened inside a production agent run — what it called, what it saw, where it changed course, and why it failed.

### Recommended replacement
> Foxhound helps teams understand what happened inside a production agent run, compare what changed, turn failures into evaluation inputs, and ship safer fixes.

### Why
This keeps the clarity of the current line while expanding it into the full loop.

---

## Optional stronger version
If you want slightly more product ambition without becoming fluffy:

> Foxhound helps teams investigate production AI agent failures, validate fixes against real bad runs, and ship safer releases.

This is slightly sharper and more direct, but a bit less descriptive.

---

## Pain-story bullets
Current bullets are strong. Keep the structure.

### Suggested tightened version
- **Cost Budgets** would have stopped it at $50
- **Session Replay** shows exactly where the run broke
- **Run Diff** reveals what changed from the last good version
- **SLA monitoring** would have alerted you before the weekend was over

### Note
If you add a fourth bullet, keep the visual density acceptable.
If not, keep the original three.

---

## Section kicker
### Current
`AI agent observability`

### Recommended
`LLM observability built for agents`

### Why
This aligns the hero more tightly with the category-entry language in the GTM source of truth.

---

# 2. Proof strip (`src/components/landing/ProofStrip.tsx`)

## Problem
Current proof items are decent, but they mix trust/support signals with wedge proof.

Current:
- Self-hosted
- Run diff
- Cost budgets
- Framework-native

These are not all equally strong as the first post-hero proof layer.

## Recommendation
Make this strip more loop-native.

### Recommended replacement set

#### Card 1
**Replay failures**
Reconstruct what the agent saw and did at the point behavior went wrong.

#### Card 2
**Diff regressions**
See where a bad run diverged from a known good execution.

#### Card 3
**Derive evals from traces**
Turn weak production runs into reusable evaluation inputs.

#### Card 4
**Guard cost and SLAs**
Catch reliability drift and runaway spend before promotion.

### Why
This strip should reinforce the wedge, not just list nice supporting traits.

---

## Alternative if you want to preserve “self-hosted”
Use this set instead:
- Replay failures
- Run diff
- Trace-derived evals
- Self-hosted

That’s acceptable if you want one trust signal in the strip.

---

# 3. Capabilities section (`src/components/landing/CapabilitiesGrid.tsx`)

## Keep
- most of the feature cards
- the three-column structure
- differentiated product surfaces

## Change
The section header and group names should align more clearly with the loop.

---

## Section header
### Current headline
`Trace every decision.`

### Recommended headline
`From broken run to safer release.`

### Recommended supporting paragraph
> Foxhound starts with traces, but the real value is what comes next: investigate regressions, validate fixes against real failures, and govern cost and reliability before rollout.

### Why
This pulls the section out of generic observability language and into the GTM wedge.

---

## Group names
### Current
- Full Visibility
- Continuous Testing
- Proactive Control

### Recommended
- **Investigate**
- **Improve**
- **Govern**

### Recommended group descriptions

#### Investigate
Understand what happened, where behavior changed, and why a run failed.

#### Improve
Turn bad runs into evaluation inputs and validate fixes before promotion.

#### Govern
Control cost, latency, and behavior drift before small issues become incidents.

---

## Feature card copy adjustments
You do not need to rewrite every card heavily.
Focus on tightening a few.

### Session Replay
#### Current
Reconstruct agent state at any point. See exactly what data was available when a decision was made.

#### Keep or tiny edit
Reconstruct agent state at any point in a run. See what data was available when the agent made a decision.

---

### Run Diff
#### Current
Compare two runs side-by-side. Spot every divergence. Find where behavior changed.

#### Keep
This is strong.

---

### Datasets from Traces
#### Current
Auto-curate test datasets from production failures. Filter by score, time, agent.

#### Recommended
Turn production failures into reusable evaluation datasets. Filter by score, time range, or agent.

### Why
This makes the “trace-derived eval” wedge slightly more explicit.

---

### GitHub Actions
#### Current
Block PRs that degrade quality. Scores in every PR comment.

#### Recommended
Block changes that degrade agent quality. Bring evaluation results into every pull request.

### Why
Slightly clearer for first-time readers.

---

### Regression Detection
#### Current
Automatic baseline per version. Alert when span structure changes.

#### Recommended
Track behavior drift across versions and catch regressions before they spread.

### Why
This is more outcome-oriented and less internally technical.

---

# 4. Comparison section (`src/components/landing/FeatureComparison.tsx`)

## Keep
- `Built for agents, not chatbots`
- the existence of the comparison section
- the general side-by-side concept

## Change
Tighten the intro so it emphasizes workflow gaps rather than a pure feature checklist.

### Current subtext
> A side-by-side look at the product gaps teams usually hit when they move from tracing experiments to operating real agent systems.

### Recommended replacement
> A side-by-side look at the workflow gaps teams hit when they move from tracing experiments to debugging, validating, and governing real agent systems.

---

## Optional note below the table
Add a short note like:

> Most tools can show traces. Foxhound is strongest in the workflow after the bad run: replay, run comparison, trace-derived evals, and release confidence.

This helps interpret the table through the wedge, not just feature rows.

---

# 5. Developer tools section (`src/components/landing/DeveloperTools.tsx`)

## Keep
- the MCP + GitHub Actions structure
- code examples
- workflow-native tooling emphasis

## Change
Reduce language that implies heavy orchestration/control rather than debugging and evaluation workflows.

---

## Section intro
### Current
`Built for your workflow`

### Recommended
`Built into developer workflows`

### Current subtext
`MCP Server for agent control, GitHub Actions for quality gates`

### Recommended replacement
`IDE-native debugging and evaluation workflows, plus CI quality gates for safer releases`

---

## MCP description
### Current
`31 tools for agent control via Model Context Protocol.`

### Recommended replacement
`31 tools for debugging, trace inspection, scoring, and evaluation workflows via Model Context Protocol.`

### Why
This aligns better with the GTM wedge and avoids overclaiming control/orchestration.

---

## MCP heading
### Current
`MCP Server`

### Optional stronger heading
`MCP debugging tools`

That said, keeping `MCP Server` is also fine if you want clarity over marketing language.

---

# 6. SDK section (`src/components/landing/SdkIntegration.tsx`)

## Keep
- Python-first order
- code-driven presentation
- framework coverage message

## Change
The heading is a little too generic-observability-centric.

### Current headline
`One decorator, full observability`

### Recommended replacement
`Instrument agent workflows in minutes`

### Recommended supporting paragraph
> Add Foxhound to the agent workflows you already ship — capture the runs you need to debug, compare, and improve.

### Why
This keeps the developer tone but brings the section closer to the full loop.

---

## Feature grid under SDK section
Current:
- Auto-instrumentation
- Cost budgets
- Multi-framework
- Type-safe

This is good and can stay.

### Optional micro-copy tweaks
- Auto-instrumentation → `Capture runs without manual tracing`
- Cost budgets → `SDK-enforced spend limits`
- Multi-framework → `Framework support where teams actually build`
- Type-safe → keep as-is

These are optional, not required.

---

# 7. Security section (`src/components/landing/SecuritySection.tsx`)

## Biggest risk area
This section needs the most careful rewrite.

## Keep
- `Your data, your infrastructure.`
- self-hosting emphasis
- BYO keys
- auditability themes

## Change heavily
Avoid anything that sounds like unsupported compliance, database-native RLS, or absolute guarantees.

---

## Section subheadline
### Current
`Observability without vendor lock-in or data sharing`

### Recommended
`Developer-first observability for teams that need control over where traces, prompts, and evaluation workflows live`

This is more precise and less slogan-like.

---

## Card rewrites

### Card 1
#### Current title
`Database-Level Row Security`

#### Current description
`Every DB query is scoped by org_id at the database layer. Not application logic, not middleware.`

#### Recommended title
`Tenant-scoped by design`

#### Recommended description
`Foxhound is built around org-scoped data access so teams can keep tenant boundaries explicit throughout the platform.`

---

### Card 2
#### Current title
`API Key Scoping`

#### Current description
`Each API key is locked to a single organization. Zero chance of cross-org leakage.`

#### Recommended title
`Org-scoped API keys`

#### Recommended description
`API keys are scoped per organization to support safer multi-tenant workflows and cleaner operational boundaries.`

---

### Card 3
#### Current title
`Self-Hosted`

#### Keep title
`Self-hosted`

#### Recommended description
`Run Foxhound on infrastructure you control and keep trace, replay, and evaluation workflows inside your own environment.`

---

### Card 4
#### Current title
`Bring Your Own Keys`

#### Recommended title
`Bring your own model keys`

#### Recommended description
`Use your own provider credentials for evaluation workflows instead of routing that data through a managed shared layer.`

---

### Card 5
#### Current title
`Full Audit Trail`

#### Recommended title
`Structured auditability`

#### Recommended description
`Capture who accessed what and when so production debugging and review workflows stay easier to inspect.`

---

### Card 6
#### Current title
`SOC 2 Ready`

#### Current description
`Built with SOC 2 controls from day one. Self-hosted deployments inherit your security posture.`

#### Recommended title
`Built for security-sensitive deployments`

#### Recommended description
`Foxhound is designed for teams that care about tenant boundaries, infrastructure control, and operational visibility without forcing a hosted-only model.`

---

## Bottom CTA section
### Current heading
`Deploy in your VPC`

### Keep
This is good.

### Current body
`Docker Compose, Kubernetes, or Fly.io. Your choice. MIT-licensed, no vendor lock-in.`

### Recommended body
`Self-host Foxhound where it fits your stack — from simple Docker deployments to more controlled infrastructure footprints.`

### Why
This is slightly safer and less over-specific while still strong.

---

# 8. SEO use-cases section (`src/components/landing/SeoUseCases.tsx`)

## Keep
This whole strategy is good.

## Light touch recommendations only
Make sure any individual page copy avoids:
- compliance-grade
- production-grade as empty adjective
- unsupported audit/compliance/security claims

### Specific note
Current use case description for Claude page includes:
`production-grade audit logs`

That should be revised.

#### Safer version
`structured traces, evaluation workflows, and auditability for Claude-powered agent systems`

---

# 9. Metadata / homepage description (`src/app/page.tsx`)

## Current metadata description
> Foxhound helps engineering teams trace AI agent runs, replay failures, compare regressions, and enforce cost and SLA guardrails across LangGraph, CrewAI, OpenAI Agents SDK, Claude Agent SDK, and OpenTelemetry pipelines.

This is actually pretty good.

## Recommended tightened version
> Foxhound helps engineering teams investigate AI agent failures, replay and diff behavior, derive evals from bad runs, and govern cost and SLA risk across modern agent stacks.

### Why
This better reflects the wedge while keeping SEO relevance.

---

# 10. Suggested new or revised bridging line somewhere on the homepage

The homepage would benefit from one explicit wedge sentence outside the hero.

## Recommended bridging copy
> Foxhound is strongest after the bad run: understand what changed, turn failures into evaluation inputs, and validate the recovery before rollout.

This could sit:
- above the capabilities section
- below the proof strip
- above the comparison table

That one sentence would make the site more aligned immediately.

---

# 11. Priority order for implementation

## Highest priority
1. Hero subheadline rewrite
2. Capabilities section headline + intro rewrite
3. Capability group rename to Investigate / Improve / Govern
4. Security section claim cleanup
5. Developer tools section wording cleanup

## Medium priority
6. Proof strip rewrite
7. Comparison intro rewrite
8. Metadata tightening
9. SEO page copy pass for risky phrasing

## Optional / nice-to-have
10. Add a short “bad rollout → safer release” section or wedge bridge sentence

---

# 12. Bottom line

The site already has strong bones.

The highest-leverage copy evolution is not “more features” and not “bigger vision.”
It is:
- preserving the strong pain story
- preserving the concrete mechanisms
- tightening every major section toward one narrative:

> Foxhound helps teams go from a bad production agent run to a validated safer fix.

That is the clearest surgical path to GTM alignment.
