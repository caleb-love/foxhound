# Foxhound Outreach and Feedback Execution Pack

**Date:** 2026-04-14  
**Purpose:** All-in-one execution pack for sending the updated Foxhound site/screenshots to internal and external reviewers, running short walkthroughs, and collecting usable GTM signal.

---

## Source of truth

Use these first:
- `docs/reference/foxhound-gtm-source-of-truth.md`
- `docs/plans/active/2026-04-14-gtm-message-testing.md`
- `docs/plans/active/2026-04-14-customer-discovery-interview-guide.md`
- `~/Developer/foxhound-web/docs/demo-capture-plan.md`

---

# 1. What to send first

## Default send package
Use this set for most people:
1. site link
2. one homepage hero screenshot
3. one capabilities/comparison screenshot
4. very small ask

## Rule
Do not send:
- a long memo
- five links
- the GitHub repo first
- a full deck

The goal is a quick reaction, not homework.

---

# 2. Internal Pendo outreach pack

## A. PM / product leader version

Hey — I’m working on a side project called Foxhound and would really value a blunt product reaction. It’s for teams running AI agents in production, and the core idea is helping them go from a bad production run to a validated safer fix instead of just staring at logs. If you have 2 minutes to look at the site/screenshots, I’d love to know whether the problem and product feel compelling or too broad.

## B. Engineering / platform version

Hey — I’m building a side project around debugging and improving production AI agent behavior. The sharpest workflow is: replay the bad run, diff it against a good one, derive evals from failures, and validate the fix before rollout. If I send you a short walkthrough, would you be open to giving me a blunt technical reaction?

## C. AI-adjacent builder version

Hey — I’m pressure-testing a side project for teams running AI agents/copilots in production. The idea is to help them understand failures, compare what changed, turn bad runs into eval inputs, and ship safer fixes. If I send you the site plus 1–2 screenshots, would you be open to giving me a few honest sentences on whether it maps to real needs?

## D. Customer-facing technical person version

Hey — I’m working on a side project and wanted a market reality check from someone who hears customer pain directly. If I send you a short walkthrough, would you be open to telling me whether this sounds like a problem real teams would care about, or whether it still feels too niche/too early?

---

# 3. External outreach pack

## A. General quick-reaction DM

Hey — I’m building Foxhound, a developer-first product for teams running AI agents in production. The sharpest part is the loop: replay a bad run, diff it against a good one, derive evals from failures, and validate the fix before rollout. If I sent you a super short walkthrough, would you be open to replying with even 2–3 honest sentences on whether it feels compelling or not?

## B. Support-agent specific version

Hey — I’m building Foxhound around a specific pain: a support/copilot rollout gets cheaper or faster, but quietly gets worse on important edge cases. Foxhound helps teams replay the bad run, diff it against a baseline, turn failures into evals, and validate the fix before rollout. Would you be open to taking a quick look and giving me a blunt reaction?

## C. Framework-adjacent version

Hey — I’m building Foxhound for teams running production agent workflows. The strongest use case is understanding regressions faster: replay, run diff, trace-derived evals, and safer release confidence. Since you’re close to this space, I’d really value even a few honest lines on whether that feels like a real wedge.

## D. “Look at the site” version

Hey — I’m pressure-testing the positioning for Foxhound, a product for debugging and improving production AI agent behavior. If you have 2 minutes, I’d love your blunt reaction on whether the site makes the problem/product feel compelling or still too broad.

---

# 4. What to send with the website

## Best one-liner with link
I’m working on a side project for teams running AI agents in production, and I’d really value your blunt reaction — if you have 2 minutes to look at the site, I’d love to know whether the problem and product feel compelling or too broad.

## Technical version with link
I’m building a side project around replaying bad AI-agent runs, diffing behavior, and turning failures into evals before rollout — if you’re open to it, I’d love a quick gut-check on whether the website makes that feel useful or not.

## Ask-for-2-sentences version
Would you be open to taking a quick look at this and replying with even 2–3 honest sentences on whether it feels like a real problem/product?

---

# 5. Screenshot send order

## Use this sequence
### Option A — simplest
1. hero screenshot
2. capabilities screenshot
3. site link

### Option B — stronger technical proof
1. hero screenshot
2. comparison screenshot
3. site link

### Option C — if talking to someone more technical
1. hero screenshot
2. developer tools or session replay/use-case page screenshot
3. site link

---

# 6. 60-second walkthrough script

Use for Loom, live walkthrough, or voice note.

## Script
Foxhound is for teams running AI agents in production. The key idea is that when something goes wrong, teams usually have traces in one place, evals somewhere else, and a lot of guesswork in between. Foxhound is meant to close that loop. You can see the bad run, replay what happened, diff it against a good run, turn the failures into evaluation inputs, and then validate the fix before rollout. The strongest use case right now is a support workflow that got cheaper and faster after a change, but worse on refund behavior. The question I’m testing is whether that loop feels genuinely valuable or still too broad.

---

# 7. 3-minute walkthrough script

## Script
Foxhound starts with a problem a lot of teams run into once AI workflows are in production: something gets cheaper or faster after a change, but quietly gets worse on the cases that actually matter. The current story on the site is built around that exact problem. The homepage leads with the failure mode, then shows the mechanisms that matter — replay, run diff, trace-derived evaluation workflows, and cost/SLA guardrails.

The reason Foxhound is interesting, if it is interesting at all, is not just that it traces runs. A lot of tools can do tracing. The stronger wedge is the workflow after the bad run. First you investigate the failure. Then you compare what changed. Then you turn bad runs into evaluation inputs. Then you validate the recovery before rollout. That’s the core product story I’m trying to sharpen.

So the feedback I care about is not “does this look nice?” It’s: does this actually feel like a real problem for teams running AI agents in production, and does the site make the product feel sharp enough to matter?

---

# 8. What to ask after they look

## Fastest version
- What felt most compelling?
- What felt vague or too broad?
- If you remembered only one thing about the product, what would it be?

## Better version
- What problem do you think this solves?
- Which part of the story feels strongest?
- Which part feels least convincing?
- Does it feel like observability, or something more specific?
- Would you want to see more, or not yet?

## If they’re technical
- Does the replay/diff/eval loop feel real or hand-wavy?
- Which part of the workflow sounds most useful?
- What would make this feel indispensable instead of just interesting?

---

# 9. How to classify responses

## Strong positive signal
Examples:
- “this is a real pain”
- “we’ve seen this exact problem”
- “show me more”
- “this is stronger than just observability”
- “I’d use this on X workflow”

## Medium signal
Examples:
- “interesting”
- “looks good”
- “nice site”
- “cool idea”

These are not bad, but they are weak unless there is a follow-up ask or concrete pain phrase.

## Strong negative/useful signal
Examples:
- “still too broad”
- “feels like tracing with extra steps”
- “I don’t get why I need this beyond Langfuse/Datadog/logs”
- “the eval part feels bolted on”

These are valuable because they sharpen the message.

---

# 10. Response-handling playbook

## If they say “interesting”
Reply:
Totally fair — if you had to guess, what part feels most real and what part still feels fuzzy?

## If they say “this is too broad”
Reply:
That’s helpful. The sharpest use case I’m testing is a production rollout that degrades behavior and needs replay + diff + trace-derived evals to validate the fix. Does that version feel more concrete?

## If they say “we already use X”
Reply:
That makes sense. The thing I’m testing is whether teams want more than observability alone — specifically a tighter loop from bad run to validated safer fix. Does that feel meaningfully different, or not enough?

## If they want more
Reply:
Happy to send a 60-second walkthrough or do a 15-minute quick feedback call — whichever is easier.

---

# 11. What to log after each interaction

Capture:
- person / company / role
- internal or external
- what you sent (site only, screenshots, walkthrough)
- exact message variant used
- strongest phrase they reacted to
- what confused them
- whether they wanted more
- whether they sound like a design partner candidate
- exact quote worth reusing

---

# 12. Suggested sequence this week

## Day 1
- capture hero + capabilities + comparison screenshots
- send to 5 Pendo people

## Day 2
- send to 5 more internal or semi-warm people
- tweak message only if feedback clearly suggests confusion

## Day 3
- send to first 5 external people

## Day 4+
- log pain phrases and objections
- tighten site or message only where repeated signal appears

---

# 13. Final rule

Do not optimize for praise.
Optimize for:
- clarity
- repeated pain recognition
- willingness to engage again
- whether someone says “show me” or “this is real”

That is the signal that matters.
