# Foxhound GTM Source of Truth

**Date:** 2026-04-14  
**Status:** active source of truth  
**Purpose:** Consolidated go-to-market strategy for Foxhound based on the current repo state, major shipped product updates, demo narrative work, brand reviews, and the latest product-market assessment.

---

## How to use this document

This is the **primary GTM source of truth** for Foxhound.

Use it when you need to answer:
- what Foxhound should say externally
- who Foxhound is for first
- what the strongest product story is
- how to demo it
- what GTM work matters next
- what not to do yet

If older GTM, launch, brand, website, or demo docs conflict with this file:
- prefer this file for **current GTM decisions**
- use older docs as supporting context, detailed research, or asset libraries

This doc is meant to reduce GTM drift and keep execution focused.

---

## Audit depth

This source of truth was assembled from a **surface-exhaustive** review of current repo GTM-related artifacts, including:
- brand strategy
- GTM/team strategy
- GTM review findings
- website refresh planning
- dashboard strategy and IA positioning
- marketing demo plans and demo narrative docs
- strategic roadmap and project overview docs
- current public-facing repo/docs/package surfaces

It is **not** a file-by-file exhaustive audit of every document in the repo.

---

# 1. Current strategic conclusion

## Short version

Foxhound should not be marketed primarily as a broad AI observability platform with a long feature list.

Foxhound should be marketed as:

> **The production improvement loop for AI agents.**

More specifically:

> **Foxhound helps teams turn production AI agent failures into safer future releases.**

That is the strongest synthesis of the repo's current product, strategy, demo, and GTM work.

---

# 2. What Foxhound is

## Category anchor

**LLM observability built for agents**

This remains the best category-entry phrase because it:
- maps into existing search behavior
- is easy to understand quickly
- distinguishes Foxhound from generic LLM observability tools

## Wedge

**Turn production AI agent failures into safer future releases**

This is the sharpest value proposition because it describes an outcome, not just instrumentation.

## Vision layer

**The operating console for production AI agents**

This is the best higher-order product vision for:
- demos
- investor discussions
- category framing
- product narrative

Do not lead with this everywhere. It is a deeper-layer story, not always the entry point.

---

# 3. Positioning hierarchy

Use these layers consistently.

## Level 1 — category / SEO / first touch
**LLM observability built for agents**

Use for:
- homepage/top fold support copy
- comparison pages
- repo description
- search-facing content
- first-touch explanations

## Level 2 — wedge / product promise
**Foxhound helps teams turn production AI agent failures into safer future releases**

Use for:
- outreach
- demos
- pitch decks
- product pages
- cold explanation of why Foxhound matters

## Level 3 — mechanism proof
Foxhound does this by helping teams:
- capture real production traces
- replay execution context
- diff good vs bad runs
- turn weak traces into datasets/evals
- validate candidate fixes
- govern rollout with budgets, SLAs, and quality gates

## Level 4 — trust layer
Use these as support signals, not the lead story:
- open source
- self-hosted
- MIT license
- Python + TypeScript SDKs
- MCP debugging tools
- GitHub Actions quality gate

---

# 4. Why Anything / Why Foxhound / Why Now

## Founder origin story

Foxhound did not come from abstract market mapping.

It came from a very personal pattern recognition moment.

A key part of the origin story is Todd Olsen at Pendo starting to code again. Watching a CEO get back into the work — not just talk about software from a distance, but re-enter the making of it — helped spark the same instinct here.

That mattered because it reframed coding as proximity to truth.

At the same time, there was a clear contrast forming across three worlds:
- what Todd was doing with Novus, which was code-based and close to the repo
- what was happening inside Pendo around AI and agent analytics
- what the market mostly offered on the front end: chat interfaces and thin conversational layers

That combination exposed a gap.

The gap was between:
- the surface where a user talks to an agent
- and the system underneath where the agent actually made decisions, took actions, branched, called tools, regressed, and failed

That is the moment Foxhound started to become obvious.

The insight was not "teams need another AI chat product."

The insight was:

> **Teams can talk to agents now, but they still cannot really inspect, replay, compare, and improve how those agents actually make decisions in production.**

Foxhound was created to close that gap.

It is an agent-first product, not a chat-first one.

That distinction matters. Many adjacent companies are effectively centered on conversation logs, prompt surfaces, or generalized LLM usage analytics. Foxhound starts one layer deeper: the execution path of the agent itself.

That is why the core product story is not just visibility. It is:
- decision-level traceability
- replay of real runs
- comparison of good vs bad behavior
- turning failures into evals
- and shipping safer future releases

This founder story should be used carefully in external narratives.

Do not overclaim with "we are the only company doing this" language unless supported in context.

But it is fair and useful to say:
- Foxhound was built from seeing a real gap between conversational AI interfaces and the back-end reality of agent decision-making
- Foxhound is designed agent-first rather than chat-first
- Foxhound's ambition is to be the system teams use to understand how agents actually behaved, why they failed, and how to improve them safely

## Founder story short version

Use this when a tighter founder narrative is needed:

> Foxhound started when a return to coding collided with a product insight. Watching Todd Olsen get back into code — and seeing what Novus was doing close to the repo — sharpened the realization that AI tooling was getting very good at the front-end conversation with agents, but still weak at the back-end truth of how agents actually made decisions. Foxhound was built to close that gap: not just to chat with agents, but to inspect, replay, diff, evaluate, and improve them in production.

## Why anything?

Production AI agents are hard to trust, debug, and improve.

Generic logs and APM flatten the exact things teams need to reason about:
- tool calls
- model decisions
- branching behavior
- regressions
- cost drift
- latency and SLA impact

When something breaks, most teams still end up stitching together logs, prompt history, evals, and guesswork.

## Why Foxhound?

Foxhound closes that loop.

It also comes from a more specific belief:

> The next important layer in AI infrastructure is not just talking to agents better. It is understanding how they actually behaved after they ran.

Instead of stopping at observability, it helps teams move through a full improvement workflow:
- see what happened
- understand what changed
- derive evals from real failures
- validate a fix
- ship with more confidence

That is Foxhound's strongest current differentiated story.

## Why now?

The market is moving from prototype LLM features to production agent systems with real operational and financial consequences.

At the same time, tooling remains fragmented across:
- observability
- debugging
- evals
- release gating
- prompt/version control

Foxhound can win by connecting those into one operator loop.

---

# 5. Primary product narrative

## The loop

Foxhound's strongest product story is this loop:

1. **Observe** production behavior
2. **Investigate** failures with trace detail, replay, and diff
3. **Explain** what changed and why behavior drifted
4. **Improve** by turning failures into datasets and experiments
5. **Govern** cost, SLA, and release risk before promotion

This loop should shape:
- homepage story
- live demo flow
- outreach copy
- investor pitch language
- product walkthroughs
- future sales materials

Do not reduce Foxhound to a bag of separate features.

---

# 6. Hero story: source of truth

## Primary hero story

**Support Copilot**

## Canonical sub-story

> **Prompt v18 made support cheaper but worse on refunds.**

This is the best current Foxhound narrative in the repo because it demonstrates:
- cost vs quality tradeoff
- prompt-driven behavior change
- regression detection
- investigation workflow
- replay and diff value
- dataset/eval generation from real failures
- validation of a fix
- governance follow-through

## Why this remains the hero story

It is:
- easy to understand
- operationally rich
- emotionally legible
- broad enough to touch most product surfaces
- strong for both technical and executive audiences

## Rule

Do not split narrative focus across too many demo stories yet.

Use Support Copilot as the dominant narrative across:
- live demos
- screenshots
- website tour
- short videos
- design-partner conversations
- investor walkthroughs

Secondary narratives can exist, but they should not dilute the hero story.

---

# 7. Demo source of truth

## Strongest live demo flow

Use the demo sequence already established in the narrative artifacts:

1. Overview / fleet context
2. Hero failing trace
3. Baseline vs regression diff
4. Replay of failure path
5. Regressions page
6. Datasets derived from production failures
7. Experiments validating candidate fixes
8. Budgets showing cost impact
9. SLAs showing reliability drift
10. Notifications showing ops routing
11. Recovery diff showing the fix story

## Core talk track

The demo should always tell one connected story:
- a rollout made behavior cheaper/faster
- but quality degraded in a meaningful customer-facing path
- Foxhound shows what changed
- Foxhound turns the failure into evaluation material
- Foxhound helps validate the recovery
- Foxhound shows the cost and SLA implications before promotion

## Demo objective

The demo is not meant to show every feature.

The demo is meant to prove:

> Foxhound closes the loop from production failure to safe release.

---

# 8. Primary ICP

## Initial target customer profile

Foxhound should target **engineering-led teams already running production agent or copilot workflows**.

## Best-fit company profile
- startup to mid-market
- product/engineering-led buying motion
- 5–50 technical staff
- not blocked by heavy enterprise procurement
- shipping AI workflows often enough to feel regression pain

## Best-fit use cases
- support agents / support copilots
- internal ops/triage agents
- workflow automation agents
- tool-using copilots where reliability matters

## Best-fit roles
- agent engineer
- AI/platform engineer
- reliability/platform owner for AI systems
- engineering/product lead responsible for AI workflows

## Deprioritize initially
- generic SMBs with light AI usage
- teams still purely prototyping
- broad enterprise-first positioning before proof exists
- heavy compliance-led sales narratives before proof exists

---

# 9. Messaging rules

## Lead with
- stop guessing why your agents broke
- turn production agent failures into safer future releases
- debugging, eval, and governance in one loop
- see what changed, why it changed, and whether the fix is safe

## Use as support
- session replay
- run diff
- trace-derived datasets
- budgets / SLAs / regressions
- MCP and CI surfaces

These prove the loop; they are not the lead sentence by themselves.

## Avoid leading with
- compliance-grade
- enterprise-grade
- category-maximal claims like “all-in-one AI platform”
- giant feature grids without narrative
- unsupported architectural superiority claims

## Proof style rule
Use:
- screenshots
- GIFs
- side-by-side before/after flows
- strong specific scenario descriptions
- operator questions and consequences

Do not rely on adjectives where mechanism proof is available.

---

# 10. Brand voice rules to preserve

Foxhound should sound:
- specific
- technical
- concise
- mechanism-backed
- developer-native

Foxhound should not sound:
- fluffy
- enterprise-marketing-heavy
- hypey
- overclaimed
- generic SaaS-polished without substance

## Voice principles
- lead with the problem, then the mechanism
- show the receipt, not the adjective
- use code, screenshots, and examples wherever possible
- prefer direct CTAs over broad marketing calls to action

---

# 11. What Foxhound is not

Use this to stay disciplined.

Foxhound is not primarily:
- a generic APM
- an LLM gateway or model proxy
- a prompt playground
- an enterprise compliance product
- a broad “everything AI” platform

Foxhound is specifically strongest as:
- agent-native observability
- investigation tooling for production AI behavior
- a trace-to-eval-to-release loop

---

# 12. Current GTM operating model

## Main shift
Move from launch-theater thinking to a **continuous GTM loop**.

## Weekly GTM loop
Every week should run this cycle:
1. test message
2. reach out to targets
3. run discovery or demo conversations
4. log objections and repeated language
5. refine positioning and offer
6. package proof artifacts

## Output of every serious conversation
Every strong conversation should produce at least one of:
- buyer-language insight
- pain validation
- objection insight
- demo improvement insight
- onboarding friction insight
- pilot candidate
- proof artifact

---

# 13. Decision rules for what to work on next

## Build only if it directly improves one of these
- message clarity
- onboarding speed
- design-partner conversion
- demo clarity
- proof capture
- the core loop demonstration

## Do not prioritize if it mainly does one of these
- expands dashboard breadth without GTM leverage
- improves speculative enterprise polish
- adds another feature category to the external story
- increases complexity without helping adoption

---

# 14. Immediate GTM priorities

These are the highest-leverage next artifacts and workflows.

## Must-have operating assets
1. message testing doc
2. discovery interview guide
3. outreach target tracker
4. design-partner / pilot one-pager
5. GTM operating tracker

## Must-have execution motions
1. run customer discovery with target teams
2. use the Support Copilot story in demos
3. capture objections and repeated phrases
4. look for design-partner conversion, not just praise
5. prioritize onboarding fixes only when they unblock real trial interest

---

# 15. Success criteria for the next GTM cycle

This GTM source of truth is working if Foxhound achieves:

1. one message that repeatedly resonates
2. one primary ICP with clear pain language
3. multiple conversations with repeated problem evidence
4. active design-partner or pilot opportunities
5. better fundraising proof based on pull, not architecture alone

---

# 16. Relationship to older docs

Use these as supporting references, not primary decision-makers:

## Core supporting docs
- `docs/plans/active/2026-04-14-gtm-synthesis-and-activation-plan.md`
- `docs/plans/active/2026-04-14-gtm-execution-plan.md`
- `docs/reference/2026-04-14-vc-product-market-swot-and-gtm-foundation.html`

## Valuable historical/supporting docs
- `docs/plans/completed/brand-gtm/2026-04-11-brand-strategy.md`
- `docs/plans/completed/brand-gtm/2026-04-11-gtm-team-strategy.md`
- `docs/plans/completed/brand-gtm/2026-04-11-brand-gtm-review-findings.md`
- `docs/plans/completed/brand-gtm/2026-04-12-website-refresh-plan.md`
- `docs/plans/active/2026-04-13-marketing-demo-seed-data-plan.md`
- `docs/plans/active/2026-04-13-marketing-demo-scenario-catalog.md`
- `docs/plans/testing/2026-04-14-demo-narrative-cheat-sheet.md`
- `docs/plans/active/2026-04-13-dashboard-strategy-world-class-ia.md`

If any of those conflict with this doc on current GTM direction, this document wins.

---

# 17. Final rule

Foxhound should be presented as a product that helps teams answer:
- what broke?
- what changed?
- what is it costing?
- how do we make future behavior safer?

That is the clearest expression of the current product and the best path to real GTM traction.
