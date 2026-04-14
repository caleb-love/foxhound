# Foxhound Web Doc Duplication Audit

**Date:** 2026-04-14  
**Audit depth:** surface-exhaustive, deep review of priority docs  
**Scope:** Identify which `foxhound-web` documents duplicate product/GTM/copy truth that should live in `Foxhound`, and which should remain local to the web repo.

---

## Executive summary

`foxhound-web` currently contains a mix of:
1. **valid local implementation docs**
2. **historical implementation summaries**
3. **duplicated product/GTM/brand truth that should no longer live there as authoritative guidance**

This is not a case where all local docs should be deleted.

The right move is to classify them into:
- **Keep local**
- **Trim to site-local only**
- **Replace with references**
- **Archive as historical**

The main duplication problem is concentrated in repo-root strategy files such as:
- `BRAND.md`
- `DESIGN-REQUIREMENTS.md`
- `COMPETITOR_ANALYSIS.md`
- `COMPARISON_SUMMARY.md`
- `CHANGES_PREVIEW.md`
- `REFINEMENT_PLAN.md`
- `REFINEMENT_SUMMARY.md`

These files contain valuable work, but too much of it is now duplicated by more current and more authoritative docs in `Foxhound`.

---

# 1. Classification framework used

## Keep local
Document is primarily about:
- site implementation
- local architecture
- local design system
- local workflow or contributor guidance
- local legal or deployment concerns

## Trim to site-local only
Document contains both:
- useful local guidance
- duplicated GTM/brand/product truth

These should be edited so only site-local implementation guidance remains.

## Replace with references
Document is mostly acting as an alternate source of truth for:
- GTM
- positioning
- product claims
- pricing truth
- copy rationale
- brand voice
- competitor positioning

These should be reduced to a pointer/reference note, not maintained as full authorities.

## Archive as historical
Document is mostly:
- a completion summary
- preview artifact
- old refinement snapshot
- intermediate decision support

Useful for history, not for current decision-making.

---

# 2. File-by-file analysis

## A. `BRAND.md`

### What it is now
This is not just a visual brand kit. It contains:
- logo and color guidance
- typography
- visual metaphor system
- tone of voice
- explicit word lists
- preferred/banned moves
- strong positioning/voice constraints

### What’s good
- The visual token and logo guidance is useful and site-adjacent.
- The tone-of-voice section is well thought out.
- It can help local web work remain consistent in execution.

### What duplicates Foxhound truth
- tone-of-voice / copy rules
- messaging style
- “words we use / never use”
- compliance-grade/tamper-evident language still appears as approved language
- it behaves like a primary brand authority instead of a local implementation note

### Why that is now a problem
The main `Foxhound` repo already has stronger and more current docs for:
- GTM truth
- copy truth
- current positioning
- brand review outcomes

Keeping a full alternate brand authority here invites drift.

### Recommendation
**Trim to site-local only**

### What to keep
- color palette / tokens if still relevant to site implementation
- typography rules if used by the site
- logo usage rules if still accurate
- visual metaphor system if it is still actually used in the site design

### What to remove or replace with references
- brand voice as a primary authority
- approved product wording lists
- strategic claims language
- any phrasing that conflicts with current Foxhound GTM docs
- “compliance-grade” as approved language

### Best target state
A local file like:
- **“Foxhound Web Visual Brand Implementation Guide”**

with a short note saying:
- GTM/messaging truth lives in `Foxhound`
- this doc covers only visual implementation rules for the web surface

---

## B. `DESIGN-REQUIREMENTS.md`

### What it is now
This file is a hybrid of:
- local implementation guardrails
- anti-fake-content policy
- tone/brand rules
- visual design constraints
- local page structure
- claims/policy constraints
- references back to Foxhound docs

### What’s good
This file contains a lot of genuinely useful local discipline:
- no fake stats/testimonials
- no emojis
- strong anti-fluff constraints
- local page structure
- practical implementation rules
- pricing honesty constraints

### What duplicates Foxhound truth
- brand voice governance
- what claims are allowed
- pricing truth as a durable product/business rule
- strategic product messaging constraints
- references to old Foxhound planning docs instead of current source-of-truth docs

### Why that is a problem
It mixes:
- local implementation rules
with
- product/GTM truth

That makes it easy for this file to become stale and compete with the canonical docs.

### Recommendation
**Trim to site-local only**

### What to keep
- anti-fake-content rules
- no-emojis rule if still desired
- local visual constraints
- site section structure
- animation rules
- implementation checklists
- “what we removed” as local site history if still helpful

### What to replace with references
- brand voice authority
- pricing truth authority
- GTM positioning rules
- strategic product claims policy

### Best target state
Rename mentally to:
- **“Foxhound Web Implementation Boundaries”**

and update references to point to:
- `Foxhound/docs/reference/foxhound-gtm-source-of-truth.md`
- `Foxhound/docs/reference/...copy-review...`
- `Foxhound/docs/reference/...surgical-copy...`

This file is worth keeping, but only after de-duplicating strategy.

---

## C. `COMPETITOR_ANALYSIS.md`

### What it is now
A detailed competitor and feature-verification analysis used to justify homepage comparison choices.

It contains:
- competitor replacement logic (Helicone → Braintrust)
- feature verification matrix
- market-category reasoning
- strategic comparison language
- marketing checklist guidance

### What’s good
- It is thoughtful and detailed.
- It provides useful implementation justification for the comparison section.
- It shows care for claim accuracy.

### What duplicates Foxhound truth
- competitor positioning
- product-category reasoning
- strategic differentiation logic
- broader market narrative
- product truth claims that now belong in Foxhound

### Why that is a problem
This file is functioning as a product strategy artifact inside the marketing-site repo.
That is exactly the kind of duplication the new cross-repo model is meant to eliminate.

### Recommendation
**Replace with references** or **archive as historical support**

### Best target state
If the comparison table still needs local justification, reduce this to a short local note like:
- why the current table uses specific competitors
- what exact site component it informs
- where the real product/comparison truth lives in `Foxhound`

Otherwise archive it.

### Practical recommendation
Because this file is detailed and has research value:
- keep it as **historical implementation research** only if useful
- do **not** keep it as current truth

---

## D. `COMPARISON_SUMMARY.md`

### What it is now
This is a derivative summary of the competitor analysis work.
It repeats:
- competitor lineup reasoning
- Foxhound feature verification
- summary positioning
- deployment recommendation

### What’s good
- concise snapshot of previous comparison work
- useful as a change log or historical checkpoint

### What duplicates Foxhound truth
Almost all of its strategic value now duplicates either:
- `COMPETITOR_ANALYSIS.md`
- current GTM truth in `Foxhound`

### Recommendation
**Archive as historical**

### Why
It is not a good long-term local implementation doc.
It is a summary artifact from a specific iteration.

### Best target state
Move to a local `docs/archive/` or `docs/history/` area if you want to preserve it.

---

## E. `CHANGES_PREVIEW.md`

### What it is now
A before/after preview document for comparison-table changes.

### What’s good
- useful as a temporary review artifact
- helpful at the moment of decision

### What duplicates or no longer needs to persist
- current strategic justification
- repeated feature-matrix explanation
- implementation diff that should now be visible in code history anyway

### Recommendation
**Archive as historical**

### Why
This is exactly the kind of transient artifact that becomes misleading if left as durable repo truth.

---

## F. `REFINEMENT_PLAN.md`

### What it is now
A repo/design refinement plan that includes:
- visual hierarchy improvements
- component system goals
- repo structure issues
- proposed structure

### What’s good
- this is largely repo-local
- it is implementation-focused
- it helped shape local architecture/docs additions

### What duplicates truth
- some of it is now outdated because the repo already has the files it said were missing
- some parts are historical rather than current

### Recommendation
**Archive as historical** or **trim to local implementation backlog**

### Why
This is not primarily cross-repo GTM duplication.
The issue is that it has become stale.

### Best target state
If still useful:
- convert into a short “remaining site tech/design debt” note
Otherwise archive.

---

## G. `REFINEMENT_SUMMARY.md`

### What it is now
A completion summary of a refinement effort.
It documents:
- what was added
- what changed
- before/after state
- “what’s ready”

### What’s good
- useful as history
- useful as an implementation completion artifact

### What duplicates truth
- not much in the GTM sense
- but it duplicates repo-history knowledge that should not be treated as active truth

### Recommendation
**Archive as historical**

### Why
This is a summary artifact, not a living guide.
Leaving it at repo root makes it look more authoritative/current than it should.

---

# 3. Keep-local docs that look healthy

These should mostly stay in `foxhound-web`, assuming they remain site-local and current.

## `CLAUDE.md`
### Recommendation
**Keep local**

### Caveat
It should explicitly point to Foxhound GTM/copy truth for messaging and positioning.
It should not independently define product truth if that conflicts.

---

## `docs/ARCHITECTURE.md`
### Recommendation
**Keep local**

### Caveat
Ensure it is about the web repo architecture, not the broader Foxhound product architecture.

---

## `docs/DESIGN_SYSTEM.md`
### Recommendation
**Keep local**

### Caveat
Keep it focused on implementation tokens/components/layout rules, not broad brand strategy.

---

## `docs/CONTRIBUTING.md`
### Recommendation
**Keep local**

---

## `docs/LEGAL-PLAN.md`
### Recommendation
**Keep local**

---

## `README.md`
### Recommendation
**Keep local, review for stale product claims**

This file currently still contains obvious stale/problematic claims like:
- tamper-evident
- compliance-grade
- SOC 2 architecture-ready

So it should stay, but it needs a dedicated copy cleanup pass.

---

# 4. High-confidence cleanup plan by file

## Priority 1 — strategy duplication and stale authority
These should be addressed first.

| File | Action | Rationale |
|---|---|---|
| `BRAND.md` | Trim to site-local only | currently acts like duplicate brand authority |
| `DESIGN-REQUIREMENTS.md` | Trim to site-local only | useful local rules mixed with duplicate GTM truth |
| `COMPETITOR_ANALYSIS.md` | Replace with reference or archive | strategic product comparison truth belongs in Foxhound |
| `COMPARISON_SUMMARY.md` | Archive | historical summary, not current truth |
| `CHANGES_PREVIEW.md` | Archive | temporary review artifact |

## Priority 2 — stale but mostly local
| File | Action | Rationale |
|---|---|---|
| `REFINEMENT_PLAN.md` | Archive or trim to remaining local backlog | stale, mostly local |
| `REFINEMENT_SUMMARY.md` | Archive | historical completion artifact |

## Priority 3 — active local docs needing copy cleanup, not ownership change
| File | Action | Rationale |
|---|---|---|
| `README.md` | Keep, but edit claims | contains stale/unsafe product claims |
| `CLAUDE.md` | Keep, but point to Foxhound source of truth more explicitly | recovery guidance improvement |

---

# 5. Proposed target structure in `foxhound-web`

## Keep at root only if they are truly active and local
Potentially keep at root:
- `README.md`
- `CLAUDE.md`
- maybe one or two implementation docs if still actively used

## Move historical artifacts under a dedicated history/archive area
Recommended future structure:

```text
foxhound-web/
  docs/
    source-of-truth.md
    ARCHITECTURE.md
    DESIGN_SYSTEM.md
    CONTRIBUTING.md
    LEGAL-PLAN.md
    implementation/
      design-requirements.md
      remaining-refinement-backlog.md
    archive/
      brand.md
      competitor-analysis.md
      comparison-summary.md
      changes-preview.md
      refinement-plan.md
      refinement-summary.md
```

This would make the repo much clearer.

---

# 6. Best next moves

## Recommended next step
Do an active cleanup pass in `foxhound-web` that:
1. trims `BRAND.md` to site-local implementation guidance or archives it
2. trims `DESIGN-REQUIREMENTS.md` to site-local boundaries only
3. archives `COMPETITOR_ANALYSIS.md`, `COMPARISON_SUMMARY.md`, and `CHANGES_PREVIEW.md`
4. archives `REFINEMENT_SUMMARY.md`
5. either archives or trims `REFINEMENT_PLAN.md`
6. updates `README.md` and `CLAUDE.md` to point more clearly at Foxhound source-of-truth docs

---

# 7. Final verdict by file

| File | Verdict |
|---|---|
| `BRAND.md` | **Trim to site-local only** |
| `DESIGN-REQUIREMENTS.md` | **Trim to site-local only** |
| `COMPETITOR_ANALYSIS.md` | **Replace with reference or archive** |
| `COMPARISON_SUMMARY.md` | **Archive** |
| `CHANGES_PREVIEW.md` | **Archive** |
| `REFINEMENT_PLAN.md` | **Archive or trim to local backlog** |
| `REFINEMENT_SUMMARY.md` | **Archive** |
| `CLAUDE.md` | **Keep local** |
| `README.md` | **Keep local, but clean claims** |
| `docs/ARCHITECTURE.md` | **Keep local** |
| `docs/DESIGN_SYSTEM.md` | **Keep local** |
| `docs/CONTRIBUTING.md` | **Keep local** |
| `docs/LEGAL-PLAN.md` | **Keep local** |

---

## Bottom line

The duplication problem in `foxhound-web` is real, but concentrated.

The biggest problem is not too many docs — it is that several repo-root docs still behave like alternate sources of product and GTM truth.

The right fix is:
- keep local implementation docs
- downgrade or archive strategy/history artifacts
- point all messaging truth back to `Foxhound`

That will preserve useful local context without letting the web repo redefine the product story.
