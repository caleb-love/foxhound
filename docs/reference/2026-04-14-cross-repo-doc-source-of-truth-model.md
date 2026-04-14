# Cross-Repo Documentation Source-of-Truth Model

**Date:** 2026-04-14  
**Status:** proposed current model  
**Repos in scope:**
- `Foxhound` — product, SDKs, docs, plans, internal truth
- `foxhound-web` — marketing site and conversion surfaces

---

## Problem

Foxhound now has important docs and copy logic spread across two repos:
- product/docs truth in `Foxhound`
- marketing/conversion surfaces in `foxhound-web`

This creates a drift risk:
- product claims diverge from marketing claims
- GTM language evolves in one repo but not the other
- duplicate strategy docs appear in both repos
- future agents waste time reconciling which repo owns truth

The goal is not to put everything in one repo.
The goal is to define **what lives where**, and when one repo should **reference** rather than **duplicate**.

---

# 1. Recommended source-of-truth rule

## Foxhound repo owns durable product truth
The `Foxhound` repo should remain the source of truth for:
- GTM strategy
- product positioning
- hero narrative
- proof hierarchy
- pricing truth
- product capability truth
- roadmap and implementation truth
- demo narrative truth
- copy guidance for public surfaces

## foxhound-web owns presentation and conversion implementation
The `foxhound-web` repo should own:
- landing page implementation
- visual presentation
- route structure for marketing pages
- SEO page composition
- CTA placement
- component-level marketing UI
- analytics / conversion instrumentation

## Rule in plain English
If a document answers **“what is true?”**, it belongs in `Foxhound`.
If a file answers **“how is that presented on the marketing site?”**, it belongs in `foxhound-web`.

---

# 2. What should not be duplicated across repos

Do **not** duplicate these as full strategy docs in both repos:
- GTM strategy
- brand strategy
- positioning hierarchy
- hero narrative definition
- pricing truth
- product messaging source of truth
- copy review rationale

These should live once in `Foxhound`, then be referenced from `foxhound-web`.

---

# 3. What should live in Foxhound going forward

Recommended durable source-of-truth docs in `Foxhound`:

## GTM / messaging truth
- `docs/reference/foxhound-gtm-source-of-truth.md`

## Marketing site copy guidance
- `docs/reference/2026-04-14-foxhound-web-copy-review-and-gtm-alignment.md`
- `docs/reference/2026-04-14-foxhound-web-surgical-copy-rewrite-plan.md`

## Demo and narrative truth
- Support Copilot narrative docs
- demo flow docs
- scenario catalog
- shared demo-domain source files

## Product / pricing / capability truth
- roadmap docs
- overview docs
- package/docs truth

---

# 4. What should live in foxhound-web going forward

In `foxhound-web`, keep only docs or notes that are truly local to the marketing site, such as:
- component implementation notes
- layout and presentation decisions
- visual hierarchy notes
- SEO technical notes
- analytics instrumentation notes
- copy TODO lists tied to specific components/pages

These should be **site implementation docs**, not primary product-strategy docs.

---

# 5. The best referencing model

## Preferred model
In `foxhound-web`, add a small local reference doc that points back to Foxhound docs.

Example file:
- `foxhound-web/docs/source-of-truth.md`

That file should say:
- GTM truth lives in `Foxhound/docs/reference/foxhound-gtm-source-of-truth.md`
- marketing copy strategy lives in the Foxhound reference docs
- this repo implements those decisions for the website surface

This avoids duplicating the actual strategy while making recovery easy inside the site repo.

---

# 6. Recommended doc ownership matrix

| Topic | Owning repo | Why |
|---|---|---|
| GTM strategy | `Foxhound` | product/company truth |
| Brand voice / positioning | `Foxhound` | durable company truth |
| Hero narrative | `Foxhound` | shared across demo, pitch, web, outreach |
| Demo narrative | `Foxhound` | tied to product truth and shared demo-domain |
| Pricing truth | `Foxhound` | product/commercial truth |
| Capability truth | `Foxhound` | tied to actual shipped product |
| Website layout | `foxhound-web` | presentation-specific |
| Component copy implementation | `foxhound-web` | site-specific execution |
| SEO route composition | `foxhound-web` | marketing-site concern |
| Analytics / conversion tracking | `foxhound-web` | site instrumentation concern |

---

# 7. Operational rules to prevent future drift

## Rule 1
When changing product positioning, pricing, hero narrative, or GTM messaging:
- update `Foxhound` source-of-truth docs first
- then update `foxhound-web` implementation copy second

## Rule 2
Do not create a new strategy doc in `foxhound-web` unless the decision is truly site-local.

## Rule 3
If a `foxhound-web` note needs to explain *why* product copy changed, link to the `Foxhound` source-of-truth doc rather than restating the whole rationale.

## Rule 4
If both repos need to mention the same thing, use this split:
- `Foxhound`: authoritative statement
- `foxhound-web`: concise implementation note + link/reference

## Rule 5
When doing GTM or copy review work, always read:
1. `Foxhound/docs/reference/foxhound-gtm-source-of-truth.md`
2. relevant Foxhound copy-review docs
3. then `foxhound-web` source files

---

# 8. Practical implementation recommendation

## In Foxhound
Keep the current source-of-truth docs as-is and treat them as the canonical GTM/copy truth.

## In foxhound-web
Create a lightweight local doc like:
- `docs/source-of-truth.md`

Suggested contents:
- current GTM source-of-truth path in Foxhound repo
- current website copy review / rewrite plan paths in Foxhound repo
- short rule: this repo implements those decisions; it does not redefine them

This is the simplest and least fragile cross-repo model.

---

# 9. Why this is the best model

It avoids:
- duplicate strategic docs
- silent copy drift
- re-litigating positioning in two repos
- future agent context burn

And it preserves:
- one durable source of truth for company/product messaging
- one flexible repo for marketing-site execution

---

# 10. Recommendation summary

## Best model
- `Foxhound` owns truth
- `foxhound-web` owns presentation
- `foxhound-web` references Foxhound docs instead of duplicating them

## Best next local step
Create a lightweight source-of-truth reference doc inside `foxhound-web` pointing back to the Foxhound GTM and copy guidance docs.

## Approval note
This model is low-risk and should be safe to adopt. The only optional decision is whether to add a dedicated `docs/` folder inside `foxhound-web` or keep a smaller README-style note elsewhere.
