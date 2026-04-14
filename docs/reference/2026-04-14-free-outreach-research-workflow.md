# Foxhound Free Outreach Research Workflow

**Date:** 2026-04-14  
**Status:** saved for later  
**Purpose:** Free, practical workflow to build a real external outreach list for Foxhound without paid search tools.

---

## Goal

Build a real list of external people to message for:
- quick product reactions
- short demo feedback
- design-partner discovery
- GTM signal

The goal is not fame.
The goal is finding people who might realistically reply with a few useful sentences.

---

## Recommended free method

Because live paid search tools are out of scope, the best workflow is:

1. manually collect candidate names from free public surfaces
2. paste the rough list into the chat
3. have the agent filter, rank, cluster, and prepare outreach

This is more reliable than trying to wire up free-but-weak search APIs.

---

## Best sources

### 1. X
Search for:
- `"LangGraph" production`
- `"AI agent debugging"`
- `"prompt regression"`
- `"LLM evals" production`
- `"agent observability"`
- `"support copilot"`
- `"OpenTelemetry" GenAI`
- `"MCP tools"`

### 2. LinkedIn
Search titles like:
- AI Engineer
- Staff Engineer AI
- Platform Engineer AI
- Developer Advocate AI
- Head of AI Platform
- AI Reliability
- ML Platform Engineer
- Agent Engineer

### 3. GitHub
Look for:
- maintainers or contributors in LangGraph, CrewAI, Pydantic AI, Mastra, MCP, and OTel-adjacent repos
- founders and engineers shipping production AI tooling
- people writing about real debugging / eval / observability workflows

---

## Who to prioritize

Prioritize people who are:
- clearly technical
- close to the pain
- active recently
- visibly helpful or responsive
- not so famous that outreach is unrealistic

Prefer:
- practical AI product engineers
- framework ecosystem builders
- AI infra / eval / observability operators
- DevRel / ecosystem advocates who understand production AI pain

Avoid prioritizing first:
- giant influencers
- generic AI thought leaders
- researchers far from production workflows
- investor-only targets

---

## Collection target

Build a rough list of:
- **15–20 X people**
- **10–15 LinkedIn people**
- **10–15 GitHub / repo-adjacent people**

That gives enough volume to filter down to a strong top 50 or top 20.

---

## What to capture per person

Use this lightweight format:

```text
Name — handle/link — company/role — why relevant
```

Example:

```text
Jane Doe — @janedoe — LangGraph engineer — posts about production agent debugging
Sam Lee — linkedin.com/in/samlee — AI platform lead — writes about evals and release confidence
Chris Kim — github.com/chriskim — MCP tooling builder — active in agent tooling repos
```

Rough notes are fine.

---

## Ask ladder

Start with the smallest ask possible:

1. "Would you be open to reacting to a 60-second demo?"
2. "Would you give me 2–3 brutally honest sentences on whether this feels compelling?"
3. "Would you do a 15-minute feedback call?"
4. "Would you be open to a design-partner style working session?"

---

## Default outreach angle

```text
Hey — I’m building Foxhound, a developer-first product for teams running AI agents in production. The sharpest part is the loop: replay a bad run, diff it against a good one, derive evals from failures, and validate the fix before rollout. If I sent you a super short walkthrough, would you be open to replying with even 2–3 honest sentences on whether it feels compelling or not?
```

---

## What to do when ready

When you have a rough list, paste it back into the chat.

Then ask for:
- ranking and prioritization
- best-first 10 names
- best-second 15 names
- cluster-specific outreach variants
- long-shot vs likely-reply grouping

---

## Companion docs

- `docs/reference/foxhound-gtm-source-of-truth.md`
- `docs/reference/2026-04-14-outreach-shortlist-external-and-pendo.md`
- `docs/plans/active/2026-04-14-outreach-target-tracker-template.md`
- `docs/plans/active/2026-04-14-gtm-operating-tracker.md`

This file exists so the outreach research task can be resumed quickly later without reconstructing the workflow from chat history.