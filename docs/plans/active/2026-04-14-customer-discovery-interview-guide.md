# Foxhound Customer Discovery Interview Guide

**Date:** 2026-04-14  
**Status:** active  
**Source of truth:** `docs/reference/foxhound-gtm-source-of-truth.md`

---

## Goal

Learn whether the Foxhound loop maps to painful buyer reality.

This is not a sales script.
This is not a pitch deck in disguise.

The goal is to understand:
- what breaks in real production AI workflows
- how teams debug today
- where confidence fails before release
- whether turning failures into reusable evals is actually valuable
- which language prospects naturally use

---

## Best interview targets

Prioritize people/teams who are:
- already shipping AI agents or copilots
- doing support, ops, automation, or tool-using workflows
- iterating prompts or agent logic frequently
- dealing with regressions, quality drift, cost drift, or reliability pain

---

## Interview setup note

Good opener:

I’m not trying to sell you anything on this call. I’m trying to understand how teams are actually handling production AI failures and whether the product I’m building lines up with that pain.

---

## Core questions

### 1. Context
- What kinds of AI workflows or agents are you running today?
- Are they customer-facing, internal, or both?
- How often do those systems change?

### 2. Production pain
- What tends to go wrong once these systems are in production?
- What kinds of failures are most painful or expensive?
- Have you had a recent regression or “that got worse after a change” incident?

### 3. Current debugging workflow
- When something goes wrong, what do you look at first?
- What tools do you use today to debug AI behavior?
- What parts of that process are slow, frustrating, or unclear?

### 4. Release confidence
- How do you decide whether a fix is actually safe to ship?
- Do you have a way to compare bad runs to good runs?
- Do production failures ever become reusable test cases or evals?

### 5. Cost and reliability
- How much do cost drift, latency drift, or SLA concerns matter to you?
- Do you have alerts, budgets, or thresholds around those today?
- What do you wish you had more visibility into?

### 6. Alternatives / replacement behavior
- What are you using instead right now?
- Is it “good enough,” or is it mostly stitched together?
- What still feels manual?

### 7. Reaction testing
- If a tool helped you replay a bad production run, compare it to a good one, derive evals from failures, and validate a fix before rollout — how useful would that actually be?
- Which part of that sounds most useful?
- Which part sounds least convincing or least urgent?

### 8. Buying/trying motion
- Who on your team would care most about this?
- What would need to be true for you to try something like this?
- What would make it feel like overkill?

---

## Follow-up probes

Use these if the conversation is going well:
- Can you walk me through the last time this happened?
- How long did it take to understand root cause?
- What did you wish you could see at that moment?
- Was the real pain debugging, release confidence, cost surprise, or stakeholder pressure?
- If you solved only one part of this, which part would matter most?

---

## What to avoid

Do not:
- over-explain Foxhound too early
- teach the prospect their own problem
- list every Foxhound feature
- argue if they say the problem isn’t painful enough
- force them into your terminology

---

## What to capture after each interview

Write down:
- role / company / use case
- maturity level of their AI workflow
- top 3 pains in their own words
- current tools used
- strongest reaction to the Foxhound loop
- objections or confusion
- whether they sound like a possible design partner
- exact phrases worth reusing in messaging

---

## Success condition

This guide is working if, after several interviews, you can answer:
- which pains recur most often
- which words prospects use naturally
- which part of the loop resonates most
- which ICP is most urgent
- which objections are strongest and most common
