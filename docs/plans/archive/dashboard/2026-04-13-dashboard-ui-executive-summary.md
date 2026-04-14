# Foxhound Dashboard UI: Executive Summary

**Date:** 2026-04-13  
**Status:** Ready to build  
**Timeline:** 8 weeks to production-ready dashboard

---

## The Situation

**Current State:**
- ✅ Robust backend API (16+ route modules)
- ✅ Production infrastructure (Fly.io, Neon, Upstash, Stripe)
- ✅ Strong SDKs (Python + TypeScript)
- ✅ Unique differentiators (Session Replay API, Run Diff, Cost Budgets, SLA monitoring)
- ❌ **NO web dashboard** — users have no way to visualize traces without API calls

**The Problem:**
Without a UI, Foxhound is invisible. Prospects can't try it, users can't onboard, and the unique features (Session Replay, Run Diff) can't showcase their value. LangSmith has a polished dashboard. Foxhound needs one too.

---

## The Plan (3 Documents)

I've created a comprehensive plan split into three actionable documents:

### 1. **Comprehensive Plan** (`2026-04-13-dashboard-ui-comprehensive-plan.md`)
**What it covers:**
- 8-week phased implementation (Foundation → Core Viewer → Session Replay → Experiments → Budgets → Regressions → Settings → Polish)
- Tech stack decision (Next.js 15 + Tailwind + shadcn/ui + Recharts)
- Detailed UI designs for every view (trace list, detail, replay, diff, experiments)
- Component architecture
- Success metrics (time to first trace <2min, trace comprehension <5s)
- Design system (colors, typography, spacing)
- Deployment strategy (Vercel, preview deploys)

**Use this for:** Overall strategy, architecture decisions, what features to build in what order.

### 2. **Quick Start Guide** (`2026-04-13-dashboard-ui-quick-start.md`)
**What it covers:**
- Day 1-2 implementation steps (bootstrap app → auth → trace list → trace detail)
- Copy-paste code examples for every component
- Exact commands to run
- Common issues & solutions
- Success criteria checklist

**Use this for:** Getting the foundation running in 1-2 days so you can start iterating.

### 3. **Competitive Analysis** (`2026-04-13-ui-competitive-analysis.md`)
**What it covers:**
- What makes LangSmith's UI excellent (and where to match)
- Where LangSmith falls short (and where Foxhound wins)
- 27-feature comparison matrix (Foxhound wins 11, ties 16)
- Design philosophy differences (LLM logger vs agent fleet manager)
- Launch screenshot requirements

**Use this for:** Understanding what "great" looks like, what to prioritize, how to position Foxhound's unique value.

---

## What You Get After 8 Weeks

### Week 1-2: Foundation
- ✅ Next.js app with auth (signup, login, API keys)
- ✅ Trace list with filters (status, agent, date range)
- ✅ Trace detail with timeline visualization
- ✅ Dashboard layout (sidebar, top bar, navigation)

### Week 3: Unique Features
- ✅ Session Replay viewer (reconstruct agent state at any point)
- ✅ Run Diff (side-by-side trace comparison)

### Week 4: Evaluations
- ✅ Experiments list + detail + leaderboard
- ✅ Dataset management
- ✅ Evaluation results visualization

### Week 5: Operations
- ✅ Cost Budget dashboard (per-agent budgets, alerts)
- ✅ SLA Monitor (compliance tracking, violations)

### Week 6: Intelligence
- ✅ Behavior Regression detection UI
- ✅ Regression timeline with before/after diffs

### Week 7: Settings & Admin
- ✅ Org settings (team, billing, API keys)
- ✅ User settings (profile, preferences)
- ✅ Integrations (Slack, webhooks)

### Week 8: Launch Polish
- ✅ Command palette (Cmd+K)
- ✅ Keyboard shortcuts
- ✅ Dark mode
- ✅ Loading states, error handling
- ✅ Mobile responsive
- ✅ Launch screenshots (6 hero images)

---

## Competitive Position After Launch

### Features Foxhound Wins
1. **Session Replay** — Reconstruct agent state at any point (LangSmith: ❌)
2. **Run Diff** — Side-by-side trace comparison (LangSmith: ❌)
3. **Cost Budgets** — Per-agent spending limits with alerts (LangSmith: ❌)
4. **SLA Monitoring** — Duration/success rate tracking (LangSmith: ❌)
5. **Behavior Regression** — Auto-detect when agent changes (LangSmith: ❌)
6. **Pricing** — $29/mo unlimited users vs $39/seat (LangSmith: ❌)

### Features at Parity
- Trace visualization
- Search & filters
- Manual scoring
- LLM-as-judge evaluators
- Experiments
- Datasets
- Onboarding speed (<2 min)
- Command palette
- Dark mode

**Result:** Foxhound matches LangSmith's core UX, then pulls ahead with agent-specific features.

---

## Key Design Decisions

### Tech Stack
**Recommendation: Next.js 15 + Tailwind + shadcn/ui + Recharts**

**Why:**
- Next.js App Router for SSR, auth patterns, Vercel deploy
- Tailwind for rapid iteration and consistent design
- shadcn/ui for copy-paste components (full control, no dependency bloat)
- Recharts for cost/latency graphs
- TanStack Query for client-side caching
- Zustand for lightweight global state

### Hosting
**Recommendation: Vercel**
- Zero-config Next.js deployment
- Preview URLs on every PR
- Edge functions for API routes
- Custom domain: `app.foxhound.dev`

### Design Philosophy
**"Agent-First Design"** (vs LangSmith's "LLM Call Logger")
- Execution flow first (timeline, not just table)
- Failure context everywhere (Session Replay on errors)
- Cost transparency (budget widget always visible)
- Session-centric (group traces by sessionId)
- Diff-native (compare runs in 2 clicks)

---

## Success Metrics

### User Experience
- **Time to first trace:** <2 minutes (signup → trace visible)
- **Trace comprehension:** <5 seconds to understand execution flow
- **Session Replay adoption:** >30% of users try it
- **Run Diff usage:** >20% compare runs in first week

### Performance
- **Page load:** <1s for trace list (100 traces)
- **Trace detail:** <500ms initial render
- **Search:** <200ms results
- **No layout shift** (CLS = 0)

### Engagement
- **Daily active:** >50% return next day
- **Feature discovery:** >60% use ≥3 features in first week
- **Retention:** >40% weekly active after 4 weeks

---

## Implementation Approach

### Option A: Full 8-Week Build (Recommended)
**Pros:**
- Launch-ready dashboard with all differentiators
- Polished UX matching LangSmith quality
- Screenshot-ready for marketing

**Cons:**
- 2 months before first users see UI
- No early feedback loop

**Best for:** If you can wait 2 months for a complete, polished launch.

### Option B: 2-Week MVP → Iterate
**Scope:**
- Week 1-2: Auth + trace list + trace detail
- Deploy to Vercel, share with early users
- Week 3+: Add features based on feedback

**Pros:**
- Users see UI in 2 weeks
- Early feedback informs priorities
- Faster validation

**Cons:**
- First impression without differentiators (no Session Replay yet)
- May need UI rework based on feedback

**Best for:** If you want to validate with real users ASAP.

### Recommendation: **Option B (2-week MVP)**
**Why:**
- Backend is solid → low risk of major API changes
- Early feedback prevents building wrong UI
- Can showcase "coming soon" for Session Replay/Run Diff
- Faster path to first paying customers

---

## Next Actions (Day 1)

### 1. Review the three docs
- [ ] Read Comprehensive Plan (understand 8-week roadmap)
- [ ] Read Quick Start Guide (understand Day 1-2 tasks)
- [ ] Read Competitive Analysis (understand LangSmith comparison)

### 2. Make tech stack decision
- [ ] Approve Next.js 15 + Tailwind + shadcn/ui (or propose alternative)
- [ ] Approve Vercel hosting (or choose different platform)

### 3. Bootstrap the app (1-2 hours)
- [ ] Create `apps/web` Next.js app
- [ ] Install dependencies (Tailwind, shadcn, TanStack Query)
- [ ] Set up API client wrapper
- [ ] Configure NextAuth

### 4. Build login page (2-3 hours)
- [ ] Create login route
- [ ] Implement auth flow
- [ ] Test with existing API

### 5. Build trace list (3-4 hours)
- [ ] Create dashboard layout (sidebar, top bar)
- [ ] Fetch traces from API
- [ ] Render trace table
- [ ] Add basic filters

**End of Day 1 Goal:** Can log in and see trace list.

### 6. Build trace detail (Day 2, 4-6 hours)
- [ ] Create trace detail route
- [ ] Render timeline visualization
- [ ] Add span detail panel
- [ ] Polish interactions

**End of Day 2 Goal:** Can click a trace and see execution timeline.

---

## Open Questions (Decide Before Building)

### 1. Real-time updates?
**Options:**
- A) Polling every 5s (simple, works with existing API)
- B) WebSocket connection (real-time, requires new backend)
- C) No auto-refresh (user clicks refresh button)

**Recommendation:** Start with (C), add (A) in Week 2.

### 2. Public demo instance?
**Options:**
- A) Yes — deploy to `demo.foxhound.dev` with sample data
- B) No — users must sign up to try

**Recommendation:** (A) — critical for conversion, reduces signup friction.

### 3. Collaborative features?
**Options:**
- A) Multiplayer cursors (see other users' selections, like Figma)
- B) Just basic team access (no live collaboration)

**Recommendation:** (B) — defer to post-launch.

### 4. Mobile app or just responsive web?
**Options:**
- A) Native iOS/Android apps
- B) Just responsive web UI

**Recommendation:** (B) — web-first, mobile apps later if needed.

---

## Risk Assessment

### Low Risk
- ✅ Backend API is stable and production-ready
- ✅ Auth patterns are standard (NextAuth + JWT)
- ✅ UI component libraries are mature (shadcn, Recharts)
- ✅ Hosting platform is proven (Vercel)

### Medium Risk
- ⚠️ **Session Replay UX** — API exists but no prior art for UI
  - **Mitigation:** Prototype early, test with users
- ⚠️ **Run Diff UX** — Diffing algorithm needs tuning
  - **Mitigation:** Use existing diff libraries, iterate based on feedback
- ⚠️ **Performance at scale** — 1000+ traces in list view
  - **Mitigation:** Virtual scrolling, pagination, server-side filtering

### High Risk
- 🔴 **Scope creep** — Adding features beyond 8-week plan
  - **Mitigation:** Ruthlessly cut anything not in launch checklist
- 🔴 **Design iteration hell** — Redesigning same components repeatedly
  - **Mitigation:** Use shadcn defaults, ship fast, iterate post-launch

---

## Budget Estimate (If Outsourcing)

### Option A: Full-time contractor (8 weeks)
- Senior frontend engineer: $150/hr × 40hr/wk × 8wk = **$48,000**
- UI/UX designer (part-time): $100/hr × 20hr/wk × 4wk = **$8,000**
- **Total: $56,000**

### Option B: Build in-house
- **Cost: $0** (just your time)
- **Trade-off: Slower (if you're solo), but more control**

### Option C: Hybrid (2-week sprint, then in-house)
- Contractor for Week 1-2 (foundation): $150/hr × 80hr = **$12,000**
- You take over Week 3+ (features, polish)
- **Total: $12,000**

**Recommendation:** If budget allows, **Option C** — contractor builds foundation fast, you own the feature work.

---

## Launch Readiness Checklist

Before announcing publicly, Foxhound must have:

### Must-Have (MVP)
- [ ] Auth (signup, login, logout, API keys)
- [ ] Trace list with filters
- [ ] Trace detail with timeline
- [ ] Session Replay viewer
- [ ] Run Diff viewer
- [ ] Onboarding flow (<2 min to first trace)
- [ ] Dark mode
- [ ] 6 hero screenshots for marketing

### Should-Have (Launch+1 Week)
- [ ] Experiments UI
- [ ] Datasets UI
- [ ] Cost Budget dashboard
- [ ] SLA Monitor

### Nice-to-Have (Post-Launch)
- [ ] Regression detection UI
- [ ] Command palette (Cmd+K)
- [ ] Mobile responsive
- [ ] Collaborative features

---

## Final Recommendation

**Ship a 2-week MVP** (auth + trace viewer), get it in front of users, then iterate fast based on feedback. The backend is rock-solid — the UI just needs to surface it. Match LangSmith's core UX, then differentiate hard on Session Replay and Run Diff.

**The market is ready.** Developers are frustrated with LangSmith's per-seat pricing and lack of agent-specific features. Foxhound has the tech, the pricing, and the unique capabilities. It just needs a UI to let users see it.

**Timeline to first user:**
- Day 1: Bootstrap app + login
- Day 2: Trace list + detail
- Day 3-4: Polish + deploy
- Day 5: Invite first users
- Week 2: Iterate based on feedback
- Week 3-4: Ship Session Replay + Run Diff
- Week 5-8: Fill out feature set

**Go build. The plan is ready.**

---

## Related Documents

1. **`2026-04-13-dashboard-ui-comprehensive-plan.md`** — Full 8-week roadmap with detailed designs
2. **`2026-04-13-dashboard-ui-quick-start.md`** — Day 1-2 implementation guide with code
3. **`2026-04-13-ui-competitive-analysis.md`** — LangSmith comparison + positioning
4. **`2026-04-10-foxhound-strategic-roadmap-design.md`** — Overall product roadmap (Phases 0-6)
5. **`docs/overview/project-overview.md`** — Current project state and stack
