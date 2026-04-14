# Foxhound GTM Message Testing

**Date:** 2026-04-14  
**Status:** active  
**Source of truth:** `docs/reference/foxhound-gtm-source-of-truth.md`

---

## Purpose

Test 3 message frames against real prospects and friendly reviewers.

The goal is to find which framing most reliably causes someone to respond with one of:
- “this is a real problem for us”
- “show me”
- “we’ve felt this pain”
- “happy to take a quick look”

Do not argue for a frame in theory. Use it in outreach and demos, then record what happens.

---

## Message Variant A — Category entry

### Positioning line
**LLM observability built for agents.**

### Short explanation
Foxhound gives engineering teams trace visibility into production AI agents — with replay, run diff, eval workflows, and cost/SLA governance designed for multi-step agent systems.

### Best use
- first-touch website language
- search-facing copy
- quick context when someone has never heard of Foxhound
- comparison to existing observability tools

### Strengths
- easiest to understand quickly
- maps into existing category language
- low cognitive load

### Weaknesses
- can sound broad
- can blur into incumbent categories
- doesn’t by itself explain why Foxhound is meaningfully different

### 1-sentence outreach version
I’m building Foxhound — LLM observability built for agents — focused on replay, diff, and evaluation workflows for production agent systems.

---

## Message Variant B — Loop / wedge

### Positioning line
**Foxhound helps teams turn production AI agent failures into safer future releases.**

### Short explanation
Instead of stopping at traces, Foxhound helps teams investigate production failures, replay and diff behavior, derive evals from bad runs, validate fixes, and ship with more confidence.

### Best use
- cold outreach
- founder calls
- demos
- investor conversations
- design-partner asks

### Strengths
- strongest wedge
- outcome-focused
- more memorable than pure observability language

### Weaknesses
- assumes a more mature buyer
- needs a little more explanation up front

### 1-sentence outreach version
I’m building Foxhound to help teams turn production AI agent failures into safer future releases — replaying failures, diffing behavior, and validating fixes against trace-derived evals.

---

## Message Variant C — Release-safety / operator framing

### Positioning line
**The production improvement loop for AI agents.**

### Short explanation
Foxhound acts like an operating console for production agent systems: observe what happened, investigate what changed, validate a fix, and govern rollout risk through cost, SLA, and regression signals.

### Best use
- demo intros
- deck copy
- deeper product pages
- people who already understand the problem space

### Strengths
- strongest product ambition
- ties product surfaces into one system
- strong for category creation

### Weaknesses
- too abstract for some first-touch use
- needs proof fast

### 1-sentence outreach version
I’m building Foxhound as the production improvement loop for AI agents — so teams can move from a broken run to a validated, safer fix instead of juggling logs, eval scripts, and guesswork.

---

## Default recommendation

### Use this as the default external stack
- **headline / category anchor:** LLM observability built for agents
- **subhead / wedge:** Turn production AI agent failures into safer future releases
- **demo or call explanation:** The production improvement loop for AI agents

---

## Homepage headline options

### Option 1
Stop guessing why your agents broke.

### Option 2
Turn production AI agent failures into safer future releases.

### Option 3
LLM observability built for agents.

### Option 4
Replay, diff, evaluate, and govern production AI agents.

### Option 5
The production improvement loop for AI agents.

---

## Demo opener options

### Version 1
Foxhound isn’t just trace logging. It helps teams understand a production agent failure, turn it into evaluation material, validate the fix, and ship more safely.

### Version 2
The value of Foxhound is the loop: observe what happened, investigate what changed, validate the recovery, and govern the rollout.

### Version 3
This is a story about a support rollout that got cheaper and faster — but worse on refunds. Foxhound helps you catch that, understand it, and recover safely.

---

## Short founder pitch

Foxhound is LLM observability built for agents, but the real wedge is the improvement loop. We help teams investigate production agent failures, replay and diff behavior, derive evals from bad traces, validate fixes, and ship safer releases.

---

## Cold outreach blurbs

### Blurb A — simple
I’m building Foxhound — a product for teams running AI agents in production. The main idea is helping teams go from a bad production run to a validated safer fix, instead of just staring at logs. If you’re open to it, I’d love to send a 60-second demo and get your honest reaction.

### Blurb B — support-agent-specific
I’m building Foxhound around a pretty specific pain: a support/copilot rollout gets cheaper or faster, but quietly gets worse on important edge cases. Foxhound helps teams replay the bad run, diff it against a good one, turn failures into evals, and validate the fix before rollout. Would you be open to taking a quick look and giving me a blunt reaction?

### Blurb C — peer feedback ask
I’m working on Foxhound, a developer-first product for debugging and improving production AI agent behavior. The story is basically replay + diff + trace-derived evals + cost/SLA guardrails. If I sent you a very short walkthrough, would you be willing to reply with even 2–3 honest sentences on whether it feels compelling or not?

---

## Objection handling

### “We already use logs / Datadog / Langfuse / LangSmith.”
That makes sense. The thing I’m testing is whether teams want more than observability — specifically whether they want a tighter loop from production failure to eval-backed fix, instead of stitching together traces, diffs, and validation manually.

### “We’re not mature enough for this yet.”
Totally fair. The best-fit teams right now are the ones already feeling regressions, debugging pain, or cost/reliability drift in production agent workflows.

### “This sounds broad.”
That’s fair. The sharpest use case right now is a production agent rollout that degrades behavior — Foxhound helps teams see what changed, test the recovery, and ship more safely.

### “How is this different from observability?”
The biggest difference is that Foxhound is strongest when it closes the loop after the bad run: replay/diff to understand it, trace-derived evals to test it, and budgets/SLAs/regressions to govern the fix.

---

## What to track while testing

For each outreach or call, log:
- which variant you used
- who it was used with
- whether they replied
- what exact phrase they reacted to
- whether they asked to see more
- what confused them
- which framing earned the strongest follow-up
