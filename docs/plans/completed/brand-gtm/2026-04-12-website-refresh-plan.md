# Website Refresh Plan

**Date:** 2026-04-12  
**Status:** Draft  
**Repo:** foxhound-web (`~/Developer/foxhound-web`)

---

## Problem

The current foxhound-web marketing site was built during Phase 0-1. Since then, Phases 2-5 shipped major features that aren't reflected on the site. The 6-agent brand/GTM review also flagged compliance claim issues and missing conversion elements. The site currently undersells the product by ~70%.

## Current State vs Actual Product

### On the website today (4 features)

| Feature | Section | Notes |
|---------|---------|-------|
| Trace Explorer | Feature card | Good |
| Session Replay | Feature card | Good |
| Run Diff | Feature card | Good |
| Audit Log | Feature card | **REMOVE** — "tamper-evident" and "compliance-grade" claims flagged CRITICAL |

### Missing from website (11 features)

| Feature | Priority | Why it matters |
|---------|----------|----------------|
| Evaluation Engine | P0 | LLM-as-a-Judge, scores, annotation queues — core differentiator |
| Datasets & Experiments | P0 | Auto-curation from traces is unique in market |
| Cost Budgets | P0 | Per-agent budgets with SDK callbacks — pain story centerpiece |
| SLA Monitoring | P0 | Duration + success rate — "agent fleet management" positioning |
| Regression Detection | P0 | Behavioral drift across versions — unique feature |
| MCP Server (37 tools) | P0 | IDE-native debugging — massive distribution channel |
| GitHub Actions Quality Gate | P1 | CI/CD integration — every PR badge is marketing |
| Pricing | P1 | Free/Pro/Team tiers defined but no page |
| Prompt Management | P1 | Version + label system |
| Notification System | P2 | Slack alerts, rule routing |
| CLI | P2 | `foxhound` CLI tooling |

### Brand violations to fix

| Issue | Severity | Fix |
|-------|----------|-----|
| "Your SOC 2 auditor will thank you" | CRITICAL | Remove compliance claims per review |
| "Tamper-evident" audit log | CRITICAL | Remove or soften to "structured audit trail" |
| "Compliance-grade" anywhere | CRITICAL | Replace with "production-grade" or "open-source" |
| Enterprise section (SSO/SAML/SOC2) prominence | HIGH | Deprioritize — these are backburnered until paid launch |
| Hero doesn't use canonical pain story | HIGH | Rewrite hero with before/after narrative |
| No install CTA | HIGH | `pip install foxhound-ai` should be primary CTA |
| Missing competitive positioning | MEDIUM | Add comparison section or link to comparison pages |
| Single 1,195-line Landing.tsx | MEDIUM | Break into focused components |

---

## Design Direction

Per brand strategy:

- **Dark mode default** — already done, keep
- **Infrastructure tooling aesthetic, not SaaS dashboard** — already good
- **Dense, information-rich layouts** — no 3-word hero sections
- **Trace visualization as signature visual** — make span trees beautiful
- **Orange as only warm accent** — already done
- **Code examples over descriptions** — show `pip install`, SDK snippets
- **Canonical pain story as emotional hook** — the $1,200 weekend story

### What to keep

- Overall dark aesthetic and color system (working well)
- Framework support strip (LangGraph, CrewAI, AutoGen, etc.)
- SDK code block with TS/Python tabs
- Architecture diagram concept
- Glassmorphism nav
- Animated trace tree (expand to show more features)

### What to change

- Hero copy and structure
- Feature section (4 → 10+ features, reorganized)
- Enterprise section → agent operations section
- Waitlist → direct signup/install CTA
- Add pricing section
- Add competitive positioning
- Component architecture (break up monolith)

---

## New Site Structure

### Page: Landing (`/`)

#### Section 1: Hero

**Headline:** "Stop guessing why your agents broke."

**Subheadline:** The canonical pain story (condensed):
> You shipped an agent on Friday. By Monday it had looped 40,000 times. The bill was $1,200. With Foxhound, Cost Budgets would have killed it at $50. Session Replay shows exactly where the decision went wrong.

**Primary CTA:** `pip install foxhound-ai` (code block, click to copy)  
**Secondary CTA:** "Star on GitHub" (with star count)

**Badges:** Open Source · MIT License · Python SDK · TypeScript SDK · Self-Hosted

#### Section 2: Framework Support Strip

Keep current strip: LangGraph, CrewAI, AutoGen, OpenAI Agents, Claude Agent SDK, Pydantic AI, Mastra, Bedrock AgentCore, Google ADK, OpenTelemetry

Update to reflect all current OTel bridge integrations.

#### Section 3: Core Capabilities (3 groups)

**Group A: "See Everything" (Observability)**

| Feature | One-liner |
|---------|-----------|
| Trace Explorer | Full span tree of every agent run. Every tool call, every LLM invocation, every branch. |
| Session Replay | Reconstruct agent state at any decision point. See what data was available when the agent chose. |
| Run Diff | Compare two runs side-by-side. Spot every divergence. Find where behavior changed. |

**Group B: "Test Everything" (Evaluation)**

| Feature | One-liner |
|---------|-----------|
| LLM-as-a-Judge | Automated evaluation with OpenAI and Anthropic models. Score every trace. |
| Datasets from Traces | Auto-curate test datasets from production failures. Filter by score, time range, agent. |
| Experiments | Run datasets through agent versions. Compare scores. Catch regressions before deploy. |
| GitHub Actions Gate | Block PRs that degrade agent quality. Scores in every PR comment. |

**Group C: "Control Everything" (Agent Operations)**

| Feature | One-liner |
|---------|-----------|
| Cost Budgets | Per-agent spend limits. Daily, weekly, monthly. SDK callback kills runaway loops. |
| SLA Monitoring | P95 latency and success rate thresholds. Auto-alert on breach. |
| Regression Detection | Automatic baseline creation per version. Structural drift alerts when spans change. |
| Slack Alerts | Route alerts by event type and severity. Cost spikes, SLA breaches, regressions. |

Each group gets a visual — trace tree animation for Group A, code snippet for Group B, dashboard mock for Group C.

#### Section 4: MCP Server

**Headline:** "37 debugging tools in your IDE."

**Subheadline:** Install the Foxhound MCP server. Search traces, replay sessions, diff runs, check budgets, trigger evaluations — without leaving your editor.

Show a few key tool names in a terminal-style list. Link to full tool reference.

#### Section 5: SDK Code Block

Keep current TS/Python tab switcher. Update to show:
- Basic tracing (current)
- Add tab: Cost budget setup
- Add tab: SLA configuration
- Add tab: Evaluation scoring

Python tab first (per feedback memory — Python is primary).

#### Section 6: Architecture Diagram

Update to include:
- Evaluation Engine path (traces → evaluator → scores)
- Cost/SLA monitoring path (traces → worker → alerts → Slack)
- Experiment path (datasets → experiments → comparison)

#### Section 7: Pricing

| | Free | Pro ($29/mo) | Team ($99/mo) | Enterprise |
|---|---|---|---|---|
| Spans/month | 100K | 1M | 5M | Custom |
| Retention | 30 days | 1 year | 2 years | Custom |
| Users | Unlimited | Unlimited | Unlimited | Unlimited |
| Evaluations | Yes | Yes | Yes | Yes |
| Cost Budgets | Yes | Yes | Yes | Yes |
| SLA Monitoring | Yes | Yes | Yes | Yes |
| Prompt Management | - | Yes | Yes | Yes |
| Priority Support | - | - | Yes | Yes |

**CTA:** "Start free" / "pip install foxhound-ai"

Note: "Unlimited users on all plans" is a key differentiator vs per-seat competitors.

#### Section 8: Open Source CTA

**Headline:** "Open source. Self-host anywhere."

**Subheadline:** MIT licensed. Docker Compose, Kubernetes, or bare metal. Your data stays in your infrastructure.

**CTAs:** "Get started" → GitHub, "Read the docs" → docs.foxhound.dev

#### Section 9: Footer

Links to: GitHub, Docs, Discord, Twitter/X, Blog, Pricing, Changelog

---

### Page: Pricing (`/pricing`)

Dedicated pricing page with the same table as Section 7, plus:
- Feature comparison matrix (expanded)
- FAQ section
- "Start free" CTA

### Future Pages (post-refresh)

- `/blog` — technical content (link to Docusaurus blog when enabled)
- `/vs/langfuse`, `/vs/langsmith`, etc. — comparison pages
- `/changelog` — public changelog

---

## Component Architecture

Break `Landing.tsx` (1,195 lines) into focused components:

```
src/components/landing/
├── Hero.tsx                    (~80 lines)
├── FrameworkStrip.tsx          (~60 lines)
├── FeatureGroup.tsx            (~100 lines — reusable for all 3 groups)
├── FeatureCard.tsx             (~50 lines)
├── McpSection.tsx              (~80 lines)
├── SdkCodeBlock.tsx            (~120 lines — tab switcher + code)
├── ArchitectureDiagram.tsx     (~100 lines)
├── PricingTable.tsx            (~120 lines)
├── OpenSourceCta.tsx           (~60 lines)
├── Footer.tsx                  (~80 lines)
└── index.ts                    (barrel export)
```

Each component owns its own styles (CSS modules or scoped styles within globals.css sections).

---

## Implementation Phases

### Phase 1: Content & Copy (1 session)

1. Write all new copy following brand voice guidelines
2. Update hero with canonical pain story
3. Remove all compliance claims (CRITICAL)
4. Write feature descriptions for all 11 missing features
5. Write pricing copy
6. Write MCP section copy

### Phase 2: Component Refactor (1 session)

1. Break Landing.tsx into component directory
2. Create reusable FeatureGroup/FeatureCard pattern
3. Create PricingTable component
4. Create McpSection component
5. Update imports and verify everything renders

### Phase 3: Feature Sections (1-2 sessions)

1. Implement 3 feature groups with visuals
2. Implement MCP section
3. Update SDK code block with new tabs
4. Update architecture diagram
5. Implement pricing section

### Phase 4: Pricing Page (1 session)

1. Create `/pricing` page
2. Feature comparison matrix
3. FAQ section
4. Link from nav and landing

### Phase 5: Polish & QA (1 session)

1. Responsive testing (320, 768, 1024, 1440)
2. Performance audit (bundle size, LCP, CLS)
3. SEO meta tags update
4. OG image update
5. Accessibility pass
6. Cross-browser testing

---

## Copy Guidelines (from brand strategy)

**Do:**
- Lead with problem, then mechanism
- Use specific numbers ("37 tools", "100K spans/month")
- Code examples over descriptions
- "pip install foxhound-ai" as primary CTA
- Sentence case for all copy
- Feature names capitalized: Session Replay, Run Diff, Cost Budgets

**Don't:**
- "Powerful" / "robust" / "seamless" / "cutting-edge"
- "Compliance-grade" / "tamper-evident" / "SOC 2 ready"
- "Excited to announce" / "We're thrilled"
- Buzzword stacking without mechanism
- More than one CTA per surface
- Enterprise features prominently (backburnered)

---

## Success Metrics

- All 11 missing features represented on landing page
- Zero compliance claims remaining
- Canonical pain story in hero
- `pip install foxhound-ai` as primary CTA
- Landing.tsx broken into <200 line components
- Pricing page live
- Lighthouse performance score >90
- All responsive breakpoints tested

---

## Dependencies

- Brand strategy: `docs/plans/2026-04-11-brand-strategy.md`
- GTM strategy: `docs/plans/2026-04-11-gtm-team-strategy.md`
- Review findings: `docs/plans/2026-04-11-brand-gtm-review-findings.md`
- Strategic roadmap: `docs/specs/2026-04-10-foxhound-strategic-roadmap-design.md`
- Current site: `~/Developer/foxhound-web`
