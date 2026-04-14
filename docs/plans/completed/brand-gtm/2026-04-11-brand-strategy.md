# Foxhound Brand Strategy

**Date:** 2026-04-11
**Status:** V3 — revised after 6-agent review + AI-augmented execution reframe
**Scope:** Brand identity, positioning, voice, visual system, content strategy
**Review:** See `2026-04-11-brand-gtm-review-findings.md` for full review output

---

## 1. Brand Audit — Current State

### What's Working

- **Name:** "Foxhound" is strong. Evocative (tracking, hunting, precision), memorable, short, available as a domain. No renaming needed.
- **Logo:** The fox-head-with-bracket-accents SVG is polished, distinctive, and tech-native. The warm orange palette against dark backgrounds is differentiated — every competitor uses blue/purple/green.
- **Core positioning statement:** "Open-source observability for AI agent fleets" is clear, specific, and defensible. Upgraded from "compliance-grade" after 6-agent review found the compliance claim indefensible without certifications (no SOC 2, no ISO 27001, no tamper-evident audit mechanism).
- **Color system:** The Infima CSS palette is intentionally derived from the logo. Warm orange primary (`#e07838`) is ownable.
- **Documentation:** 21 pages of substantive, well-written docs. Not placeholder.
- **README:** Well-structured with a real quickstart, SDK table, and clear differentiators.

### What's Broken or Missing

| Gap | Severity | Notes |
|-----|----------|-------|
| Social OG image (`foxhound-social.png`) | **Critical** | Declared in docusaurus.config but file doesn't exist. Every link share has no preview. |
| Favicon | **Critical** | Current `favicon.ico` is a 1x1 pixel stub. Browser tabs show nothing. |
| No community channels | **High** | Zero Discord, Slack, Twitter/X, LinkedIn, or YouTube presence. |
| No blog | **High** | Docusaurus blog is explicitly disabled. Content marketing can't start. |
| README references cut features | **Medium** | Mentions PagerDuty, GitHub, Linear notifications and SSO/SAML marketing — these were cut per roadmap review. |
| No CONTRIBUTING.md | **Medium** | Blocks community contribution. |
| No changelog | **Medium** | No public record of releases or progress. |
| Missing package READMEs | **Low** | `cli`, `billing`, `db` packages have no README. |
| MCP server README inconsistency | **Low** | H1 says `@foxhound/mcp-server`, npm name is `@foxhound-ai/mcp-server`. |

---

## 2. Positioning Architecture

### Primary Positioning

> **Foxhound: LLM observability built for agents.**

This is the SEO anchor. It rides existing search intent ("LLM observability") while planting the flag on the destination category ("built for agents"). Every piece of public content should reinforce this frame.

### Category Creation Positioning

> **Foxhound: The agent operations platform.**

Use this for conference talks, the marketing site hero, and contexts where you are defining a new category rather than competing in an existing one. "Agent operations" is more defensible and harder for Langfuse to co-opt by adding an "agents" tab.

**Dual positioning strategy:**
- SEO/comparison contexts: "LLM observability built for agents" (meets developers where they search)
- Category creation contexts: "The open-source agent operations platform" (plants a new flag)

### Positioning Hierarchy

```
Level 1 (Category):  LLM observability / Agent operations
Level 2 (Wedge):     Built for agents, not chatbots
Level 3 (Proof):     Mechanism proof — GIFs, screenshots, before/after demos (NOT just a feature list)
Level 4 (Trust):     Open source, self-hosted, MIT license, multi-tenant from day one
```

**On "Proof":** Listing "Session Replay, Run Diff, Cost Budgets" is a feature list, not proof. Proof means *evidence the wedge claim is true*. At pre-launch without customers, the proof layer must be **mechanism proof**: a 30-second GIF of Session Replay reconstructing a failing agent run does more positioning work than the words "Session Replay" as a bullet.

### One-liner Variants (by context)

| Context | Line |
|---------|------|
| GitHub repo description | Open-source observability for AI agent fleets — trace, replay, and audit every decision |
| Twitter/X bio | Observability for AI agents. Open source. Session Replay, Run Diff, cost budgets, SLA alerts. |
| Conference intro | We built the observability platform that treats AI agents like production services, not chatbots. |
| Cold outreach | Foxhound gives your team full decision traceability for autonomous AI agents — every tool call, every LLM invocation, every branch point. |
| Docs site hero | Trace, replay, and audit every agent decision — from tool call to business outcome. |

### Competitive Narrative

The entire existing observability category (Langfuse, LangSmith, Helicone, Braintrust) was built for **LLM applications** — chatbots, RAG pipelines, single-model completions. Those tools bolt on "agent support" as an afterthought.

**Foxhound was built for agents from day one.** The architecture assumes multi-step, multi-model, multi-tool execution with emergent failure modes. Session Replay, Run Diff, behavior regression detection, cost budgets, and SLA monitoring exist because agents need them — not because a feature comparison chart demands them.

This is the wedge. The messaging should never retreat from it.

**Important nuance (from CTO review):** The competitive advantage is in the *feature set*, not in some fundamentally different data architecture. The core trace/span model is standard OTel-style. The differentiation is what you can *do* with the data (replay, diff, budget, monitor, detect regression). Messaging should emphasize capabilities, not imply a radically different architecture.

### The Canonical Pain Story (REQUIRED — from marketing review)

Every launch surface needs a before/after narrative. Feature lists don't convert. Pain stories do.

**The Story:**

> You shipped an agent to production on Friday. By Monday, it had called the same API endpoint in a loop — 40,000 times. The bill was $1,200. You didn't know until the invoice arrived.
>
> You opened CloudWatch. Thousands of lines of JSON. No structure. No decision flow. It took 4 hours to find the root cause: a prompt change you'd made on Thursday caused the agent to misinterpret a tool response.
>
> With Foxhound, you'd have seen it in 3 minutes. Session Replay shows the exact decision tree. Cost Budgets would have killed the loop at $50. SLA Monitor would have alerted you Friday night.

Use variants of this in: README, Show HN opening, first blog post, conference talks, marketing site hero. The numbers and specifics can change. The structure (before pain → after mechanism) stays the same.

### Session Replay — Expectation Management (from CTO review)

Session Replay is the #1 differentiator. It exists as a **server-side API** that reconstructs agent state at a span boundary. It is NOT a visual playback tool (like FullStory or LogRocket). If the foxhound-web dashboard has a visual replay component, great. If not, all launch materials must be clear that Session Replay is state reconstruction via API, not temporal visual playback. The brand voice says "show the receipt" — follow that here.

### What Foxhound Is Not

- Not a general-purpose APM (we don't monitor HTTP latency)
- Not an LLM gateway or proxy (we don't route API calls)
- Not a prompt playground (we observe production, not sandboxes)
- Not enterprise-first (we're developer-first, enterprise-ready)

---

## 3. Brand Voice Profile

```
VOICE PROFILE
=============
Author: Foxhound (brand)
Goal: Developer-native technical authority — credible, specific, zero fluff
Confidence: High

Source Set
- Current README.md
- Docs site getting-started/index.md
- SDK reference pages
- Strategic roadmap executive summary
- Evaluation cookbook

Rhythm
- Short to medium sentences. Technical content uses longer sentences
  when precision demands it, but defaults to brevity.
- Paragraphs are 1-3 sentences, never walls of text.
- Lists and tables preferred over prose when presenting structured info.

Compression
- High compression. Say it once, say it specifically, move on.
- Prefer "Session Replay reconstructs agent state at any point" over
  "With our Session Replay feature, you can go back and see what your
  agent was doing at any moment during execution."

Capitalization
- Conventional sentence case. Product feature names are capitalized
  (Session Replay, Run Diff, Cost Budgets). No all-caps emphasis.
- No forced lowercase branding.

Parentheticals
- Used for technical clarification: "(SHA-256 hashed, never stored
  plaintext)" or "(default 90 days)". Not for asides or jokes.

Question Use
- Rare. Used only when framing a genuine developer pain point:
  "When something goes wrong, you need more than logs."
- Never used as clickbait or engagement hooks.

Claim Style
- Claims are specific and mechanism-backed.
- Good: "Every DB query is scoped by org_id at the database layer."
- Bad: "Enterprise-grade security you can trust."
- Show the receipt, not the adjective.

Preferred Moves
- Lead with the problem, then the mechanism
- Code examples over descriptions
- Tables for structured comparisons
- Concrete span/trace examples
- "You need X" framing (empathy without pandering)
- Framework-specific quickstarts (show, don't tell)

Banned Moves
- "Excited to announce" / "We're thrilled"
- "Powerful" / "robust" / "seamless" / "cutting-edge"
- Fake curiosity hooks ("Ever wonder why your agents fail?")
- LinkedIn thought-leader cadence
- Bait questions
- "No fluff" (ironic fluff)
- Buzzword stacking without mechanism
- "AI-powered" as a selling point (we serve AI builders; they know)
- Startup journey narratives

CTA Rules
- CTAs are direct and low-friction: "pip install foxhound-ai"
- Never more than one CTA per surface
- Install command > "Sign up" > "Learn more"
- Star the repo is an acceptable CTA on social, never on docs

Channel Notes
- X: Short, technical, opinionated. Share mechanisms and numbers.
     Thread format for launches. Tag framework teams on integrations.
- LinkedIn: Longer-form problem statements. Target engineering leads
     and CTOs. Repurpose blog posts, don't create LinkedIn-native content.
- GitHub: README, Discussions, and Issues are primary brand surfaces.
     Every interaction is brand. Response time < 24h on issues.
- Blog: Technical depth. "How we detect behavior regression across
     agent versions" not "Why observability matters for AI."
- Docs: Zero personality, maximum clarity. Docs are reference, not marketing.
```

---

## 4. Visual Identity System

### Current Assets

| Asset | Status | Action |
|-------|--------|--------|
| Logo SVG (fox head + brackets) | Done | Keep. Strong and distinctive. |
| Logo PNG (1024x1024) | Done | Keep. |
| Logo wordmark PNG | Done | Keep. Used in README. |
| Color palette (warm orange) | Done | Keep. Codified in CSS custom properties. |
| Favicon | **Broken** | Replace 1x1 stub with real multi-size .ico from logo. |
| Social OG image | **Missing** | Create 1200x630 card with logo + tagline on dark bg. |
| GitHub social preview | **Missing** | Upload 1280x640 via repo Settings > Social preview. |
| **Launch screenshots** | **CRITICAL — Missing** | 5-6 hero screenshots with real data (Session Replay, Run Diff, Trace Explorer, Cost Budgets, SLA alerts, CLI). No launch without these. |
| **Demo GIF/video** | **CRITICAL — Missing** | 30-second GIF of Session Replay in action. This is the single highest-converting visual asset. |
| Signature gradient | **Recommended** | Allow a subtle `#e07838` → `#d06628` gradient for marketing hero surfaces and social cards. Docs stay gradient-free. |

### Color Palette (formalized)

| Role | Light Mode | Dark Mode | Usage |
|------|-----------|-----------|-------|
| Primary | `#e07838` | `#f0a87e` | CTAs, links, active states |
| Primary Dark | `#d06628` | `#eb9460` | Hover states |
| Background | `#ffffff` | `#0D1117` | Page background |
| Surface | `#f6f8fa` | `#161b22` | Cards, code blocks |
| Text | `#1f2328` | `#e6edf3` | Body copy |
| Accent (tech) | `#3D8EF0` | `#3D8EF0` | Code highlights, secondary elements |

### Typography Direction

No custom font is currently loaded. The docs site uses system fonts. Recommendation:

- **Headings:** Inter or the system font stack (already clean)
- **Code:** JetBrains Mono or the system monospace stack
- **Body:** System font stack is fine — fast, native, no FOUT

Do not add custom fonts until there's a marketing site that justifies the weight. Docs site should stay on system fonts for performance.

### Design Language

Foxhound's visual identity should feel like **infrastructure tooling, not a SaaS dashboard**:

- Dark mode default for marketing surfaces (matches the `#0D1117` logo background)
- Light mode default for docs (readability)
- Terminal/code aesthetic — monospace in headers when appropriate
- Orange as the only warm accent against cool neutrals
- Subtle gradients allowed on marketing hero surfaces and social cards (`#e07838` → `#d06628` at a low angle). No blobs or decorative illustration. Docs stay gradient-free.
- Dense, information-rich layouts. No hero sections with 3 words and nothing else.
- **Trace visualization is the signature visual.** If Foxhound's span tree and replay visualizations look distinctive and beautiful, every screenshot shared on Twitter is brand marketing. Invest in making trace visualization look uniquely excellent, not just functional.

---

## 5. Naming System

### Package Naming (already established)

| Surface | Pattern | Example |
|---------|---------|---------|
| npm scope | `@foxhound-ai/` | `@foxhound-ai/sdk` |
| PyPI | `foxhound-ai` | `pip install foxhound-ai` |
| Python import | `foxhound` | `from foxhound import FoxhoundClient` |
| CLI | `foxhound` | `foxhound traces list` |
| GitHub Actions | `foxhound-ai/` | `foxhound-ai/quality-gate-action` |
| MCP Registry | `io.github.caleb-love/foxhound` | — |

### Feature Naming Convention

Features use plain English noun phrases, capitalized. No trademarked suffixes, no clever acronyms.

- Session Replay (not FoxReplay, not Replay)
- Run Diff (not FoxDiff)
- Cost Budgets (not Budget Guard)
- SLA Monitor (not SLABot)

This keeps the brand clean and the features discoverable in search.

---

## 6. Content Strategy

### Owned Channels (priority order)

| Channel | Purpose | Status | Priority |
|---------|---------|--------|----------|
| GitHub (repo + Discussions) | Primary brand surface, community support | README done, Discussions not enabled | **P0** |
| docs.foxhound.dev | Technical reference | 21 pages, live on GH Pages (DNS pending) | **P0** |
| Blog (on docs site) | Technical content marketing, SEO | Disabled in Docusaurus config | **P1** |
| Twitter/X (@foxhound_ai) | Developer community, launches, opinions | Does not exist | **P1** |
| Discord | Real-time community, support | Does not exist | **P1** |
| foxhound.dev | Marketing site, conversion | Referenced in footer, no content | **P2** |
| LinkedIn (company page) | Engineering leadership audience | Does not exist | **P2** |
| YouTube | Demos, tutorials, conf talks | Does not exist | **P3** |

### Content Pillars

1. **Agent Debugging War Stories** — "How we found a $400/day tool-call loop in 3 minutes." Concrete, numbers-driven, Foxhound shown naturally as the instrument.

2. **Framework Integration Guides** — One per supported framework. "Instrument your LangGraph agents with Foxhound in 90 seconds." These are SEO anchors and framework-community distribution.

3. **Agent Operations Expertise** — "What SLA monitoring means for autonomous agents." "Detecting behavior regression when your agent has no test suite." Position Foxhound team as the authority on agent fleet management.

4. **State of Agent Observability** — Annual/quarterly landscape analysis. Original data if possible. Gets press pickup and backlinks. **Deprioritize until Q2** — requires data that doesn't exist yet.

5. **Comparison Guides** — Individual comparison pages per competitor, not just one omnibus post. "Foxhound vs Langfuse," "Foxhound vs LangSmith," etc. Each targets different search intent. **Publish 6 pages on launch day** — these will be the highest-traffic pages within 3 months.

6. **Migration Guides** — "Migrating from Langfuse to Foxhound," "Migrating from LangSmith to Foxhound." Step-by-step technical guides for switching. These intercept the highest-intent users — people who are already dissatisfied with their current tool. Claude can draft these from SDK documentation analysis.

7. **Debugging Cookbook** — "How to debug a looping agent," "How to find cost anomalies in agent fleets," "How to trace a multi-model agent chain." Problem-first content where Foxhound is the instrument, not the subject. Evergreen SEO value.

### Keyword Strategy (from marketing review — HIGH gap)

Every blog post must target a specific keyword cluster. Do keyword research (Ahrefs, Ubersuggest, or GSC) before publishing.

**High-intent (bottom-funnel) — own these:**
- "LLM observability tool" / "LLM observability open source"
- "AI agent monitoring" / "AI agent tracing"
- "Langfuse alternative" / "LangSmith alternative"
- "AI agent debugging"
- "OpenTelemetry AI agents"

**Mid-intent (educational):**
- "how to trace AI agent runs"
- "AI agent cost monitoring"
- "session replay AI agents"
- "AI agent testing in production"

**Long-tail (framework-specific):**
- "LangGraph observability"
- "CrewAI monitoring"
- "OpenAI agents tracing"
- "Claude agent SDK debugging"

### Content Cadence (launch phase — AI-augmented execution model)

With unlimited Claude tokens, content production is no longer bottlenecked by writing time. The bottleneck is human review, screenshot creation, and strategic direction. Claude drafts, self-reviews, and polishes. The founder reviews, adds real experience, and publishes.

| Week | Output |
|------|--------|
| Pre-launch (5-7 days) | Enable blog, write 6-8 posts: 6 individual comparison pages, canonical pain story, integration tutorial. Claude drafts all in a single session, founder reviews/edits. |
| Launch week | Show HN + Twitter thread ARE the content. Publish 2 comparison pages on Day 1 (Langfuse, LangSmith — highest search volume). |
| Post-launch (weeks 1-8) | 1 post/week from day one. Claude drafts, founder reviews. No content gate on DevRel hire. |
| After DevRel hire | Scale to 2 posts/week. DevRel writes original content, Claude handles migration guides and framework tutorials. |

### Content Production Pipeline

```
Claude drafts post (voice profile + SEO keyword targeting)
  → Claude self-reviews against brand voice, claim accuracy, keyword density
  → Founder reviews for truth, adds real experience/numbers, approves
  → Publish
```

This pipeline produces content at 3-5x the rate of a solo human writer while maintaining quality through the human review gate. The founder's time per post drops from 4-6 hours (writing + editing) to 30-60 minutes (review + personal touches).

---

## 7. Immediate Action Items

### Critical (before any public launch)

**Assets:**
- [ ] Generate real favicon from logo SVG (16, 32, 180, 192, 512 px)
- [ ] Create `foxhound-social.png` (1200x630, logo + tagline on `#0D1117` with subtle gradient)
- [ ] Upload GitHub social preview image (1280x640)
- [ ] **Create 5-6 hero screenshots** with realistic data (Session Replay, Run Diff, Trace Explorer, Cost Budgets, SLA alerts, CLI output). No launch without these.
- [ ] **Create 30-second demo GIF** showing Session Replay in action. This is the single most important visual asset.

**Channels:**
- [ ] Enable GitHub Discussions on the repo
- [ ] Enable Docusaurus blog plugin
- [ ] Create Twitter/X account (@foxhound_ai or similar)
- [ ] Create Discord server with 4 channels MAX: #announcements, #general, #help, #show-and-tell. Add more only when volume demands it.

**Code/content fixes (Claude generates, founder reviews):**
- [x] Fix README: remove cut features, remove "tamper-evident", remove "compliance-grade", fix "database layer" claim
- [x] Fix docs-site: `foxhound-sdk` → `foxhound-ai`, remove SOC 2/ISO 27001 claim, update tagline
- [ ] Write CONTRIBUTING.md (Claude drafts in same session as launch prep)
- [ ] Write SECURITY.md with responsible disclosure process, security contact email, PGP key, safe harbor (Claude drafts)
- [ ] Write CHANGELOG.md with retroactive entries for phases 0-5 (Claude generates from git history)
- [ ] Configure DNS CNAME for docs.foxhound.dev
- [ ] Publish `@foxhound-ai/mcp-server@0.2.0` to npm
- [ ] Submit MCP Registry entry

**Content (Claude drafts all, founder reviews — 1-2 sessions):**
- [ ] Write 6 individual comparison pages (Langfuse, LangSmith, Helicone, Braintrust, Arize Phoenix, Datadog LLM Monitoring)
- [ ] Write canonical pain story blog post (the $1,200 weekend)
- [ ] Write integration tutorial ("Instrument Your LangGraph Agent in 90 Seconds")
- [ ] Pre-draft 2 migration guides (from Langfuse, from LangSmith)

**Starter repos (Claude scaffolds all 5, founder validates):**
- [ ] `foxhound-langchain-starter`
- [ ] `foxhound-crewai-starter`
- [ ] `foxhound-mastra-starter`
- [ ] `foxhound-pydantic-ai-starter`
- [ ] `foxhound-fastapi-agent-starter`

**Marketing site (Claude builds, founder reviews):**
- [ ] Create foxhound.dev landing page — dark mode, hero with demo GIF, feature grid, competitive comparison table, pricing, install CTA. Claude can build the entire site in a single session.

**Strategy:**
- [ ] Find 3-5 design partners (teams running agents in production) BEFORE public launch
- [ ] Define free-tier overage experience (what happens at 100K spans?)
- [ ] Define 2-3 cloud-only advantages (managed upgrades, zero-ops, team features)

### High (launch week)

- [ ] Prepare Show HN post — **lead with the pain story, not a feature list** (see canonical pain story above)
- [ ] Stagger launches: Day 1 Show HN + Twitter thread → Day 4-5 Product Hunt
- [ ] Reach out to Product Hunt hunters 3-4 weeks before launch
- [ ] Add Discord + Twitter/X links to docs-site footer and README
- [ ] Fix MCP server README header (`@foxhound/mcp-server` → `@foxhound-ai/mcp-server`)
- [ ] Pre-draft awesome-list submissions (Claude prepares all PRs)
- [ ] Pre-draft framework directory submissions (LangChain, CrewAI, Pydantic AI partner pages)

### Medium (first month)

- [ ] LinkedIn company page
- [ ] First YouTube demo video script (Claude drafts, founder records)
- [ ] Run automated DAST scan (OWASP ZAP) against the API
- [ ] Apply to YC S26 (strong application: real product, clear market, proven execution)
- [ ] Publish migration guides
- [ ] Begin debugging cookbook series (1 post/week)
