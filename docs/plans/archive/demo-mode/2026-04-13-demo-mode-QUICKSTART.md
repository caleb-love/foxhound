# Foxhound Demo Mode — Quick Start Guide

**UPDATED 2026-04-13:** Major architecture simplification based on discovered `foxhound-web` demo routes  
**New plan:** [`2026-04-13-demo-mode-REVISED.md`](./2026-04-13-demo-mode-REVISED.md)  
**Original (complex) plan:** [`2026-04-13-demo-mode-comprehensive-plan.md`](./2026-04-13-demo-mode-comprehensive-plan.md)

---

## 🎉 Major Discovery

The `foxhound-web` repo **already has a working demo** at `/demo/*` routes with:
- ✅ Trace list view (`/demo/traces/`)
- ✅ SessionReplay component (`/demo/traces/[id]/`)
- ✅ Run diff view (`/demo/runs/diff/`)
- ✅ Demo data structure (`DEMO_TRACES` constant)

**This changes everything.** No separate repo needed. No complex infrastructure. Just enhance what exists.

---

## Simplified Architecture

**Work directly in `foxhound-web` repo.** Add:
1. Problem picker landing page at `/demo/`
2. Featured runs (curated data stories)
3. Deploy to `demo.foxhound.caleb-love.com`

**No database, no rolling window, no background agent** (for launch). Just static demo data in TypeScript constants.

**Cost:** $0 (no ongoing infrastructure)  
**Complexity:** 4 phases instead of 10  
**Time:** 12-15 hours instead of 40-50

---

## Key Decisions ✅ LOCKED IN

### 1. Foxhound Package References ✅
**Decision:** Use published npm packages (`@foxhound-ai/*`, `@foxhound/*`)
- Install via `pnpm add @foxhound/db @foxhound-ai/sdk`
- Use `pnpm link` for local development if needed

### 2. UI Component Import Strategy ✅
**Decision:** Import directly from main Foxhound repo
- Assumes Foxhound exports components as importable packages
- If not, add `packages/web-components/` to main repo first
- Demo stays in sync automatically

### 3. Background Agent Complexity ✅
**Decision:** Option B — Somewhat realistic
- Varied queries (not just random picks from list)
- Realistic timing with jitter (not exact 30-min clusters)
- Mix of successful runs, occasional errors, varied latencies
- No multi-turn conversations or complex user simulation needed

---

## Execution Roadmap (REVISED)

### Week 1: Enhance Existing Demo (Phases 1-2)
**Goal:** Featured runs + problem picker working locally

**Tasks:**
1. Audit current `foxhound-web` demo state
2. Generate 4 featured runs using `@foxhound-ai/sdk`
3. Update `src/lib/demo-data.ts` with featured runs
4. Create problem picker at `src/app/demo/page.tsx`
5. Test locally: `pnpm dev` → visit `/demo/`

**Deliverable:** Problem picker routes to featured runs locally

**Skills to use:**
- `/plan-eng-review` — review architecture before coding
- `backend-patterns` — for seeder package structure
- `tdd-workflow` — write tests for each scenario generator

**Agent recommendations:**
- Use for structured milestone tracking
- Run `/gsd-new-milestone` to start M002: Demo Mode
- Break into slices: S01 (foundation), S02 (seeding), S03 (UI), etc.

### Week 1 (continued): Deploy (Phase 3)
**Goal:** Demo live at `demo.foxhound.caleb-love.com`

**Tasks:**
1. Determine current foxhound-web deployment (Vercel? Cloudflare?)
2. Add subdomain CNAME or separate deployment
3. Deploy with demo routes enabled
4. Test all featured runs load correctly
5. Add "Try Demo" link to main marketing site

**Deliverable:** Demo publicly accessible and functional

**Skills to use:**
- `/plan-devex-review` — review onboarding UX before building
- `frontend-patterns` — for Next.js app structure
- `/qa` — test the full user journey

### Optional: Background Agent (Post-Launch)
**Goal:** Add "live" data generation

**Tasks:**
1. Create `foxhound-web/scripts/background-agent.ts`
2. GitHub Actions workflow (every 30min)
3. Appends new traces to demo data
4. Deploy updated data

**Deliverable:** Demo feels "live" instead of static

**Recommendation:** Ship static demo first, add this if users request it

---

## Recommended Agents & Skills Per Phase

| Phase | Primary Agent/Skill | Supporting Skills |
|-------|---------------------|-------------------|
| 1. Repo Setup | `/plan-eng-review` | `backend-patterns`, `deployment-patterns` |
| 2. Data Seeder | `tdd-workflow` | `/plan-eng-review`, `/review` |
| 3. Background Agent | `tdd-workflow` | `/plan-devex-review` (for GitHub Actions UX) |
| 4. Onboarding UI | `/plan-design-review` | `frontend-patterns`, `/design-shotgun` (for problem cards) |
| 5. Rolling Window | `/investigate` (for timestamp bugs) | `tdd-workflow` |
| 6. Infrastructure | `deployment-patterns` | `/security-review`, `/careful` |
| 7. Testing | `/qa` | `tdd-workflow`, `/verification-loop` |
| 8. Documentation | `/document-release` | (automated) |
| 9. Launch | `/ship` | `/retro` |
| 10. Maintenance | `/health` (monthly) | `/investigate` (when issues arise) |

---

## Testing Strategy

### Unit Tests (packages/seeder, packages/background-agent)
```bash
pnpm test
```
- Each scenario generator has tests
- Background agent logic has tests
- Rolling window mapper has tests

### Integration Tests (full stack)
```bash
pnpm test:e2e
```
- Problem picker routes to featured run
- Featured run loads data from API
- Rolling window maps timestamps correctly
- Background agent traces appear in "recent" queries

### QA Checklist (manual)
- All 5 problem cards clickable
- Each featured run loads correctly
- UI responsive (mobile, tablet, desktop)
- No console errors
- Performance: page load <2s

---

## Cost Breakdown (REVISED)

| Component | Provider | Plan | Cost |
|-----------|----------|------|------|
| Demo Data | Static TypeScript | In-repo | $0 |
| Frontend | Existing deployment | Same as foxhound-web | $0 |
| Background Agent | Optional (not needed for launch) | N/A | $0 |

**Total: $0/month**

No database, no APIs, no infrastructure. Just static demo data in the Next.js app.

---

## Critical Path (REVISED)

1. **Audit existing demo** (understand current state)
2. **Generate featured runs** (needs @foxhound-ai/sdk)
3. **Build problem picker** (needs featured runs ready)
4. **Deploy** (needs problem picker tested)

**Total: Linear, ~12-15 hours**

No parallelization needed - simple sequential workflow.

---

## First 3 Commands to Run

```bash
# 1. Check current demo state
cd ~/Developer/foxhound-web
cat src/lib/demo-data.ts | head -30

# 2. Test existing demo locally
pnpm dev
# Visit http://localhost:3000/demo/traces

# 3. Create problem picker
mkdir -p src/app/demo
touch src/app/demo/page.tsx
```

Then follow Phase 1 (Generate Featured Runs) from the revised plan.

---

## When to Use This Guide vs Full Plan

**Use this guide when:**
- You want a quick overview
- You're deciding which phase to work on next
- You need to know which skills/agents to use

**Use the full plan when:**
- You're actually implementing a phase
- You need detailed code examples
- You want to understand the architecture deeply
- You're troubleshooting or debugging

---

## Remaining Open Questions (Optional)

**Deferred to post-launch:**
1. Demo feedback mechanism (thumbs up/down button?)
2. Lead capture strategy (email collection?)

**Core architecture decisions are locked in.** Ready to start Phase 1.

---

## Success Metrics

**Week 1:** 100+ visitors, <5% error rate  
**Month 1:** 500+ visitors, 10+ GitHub stars from demo traffic  
**Month 3:** 2,000+ visitors, featured on newsletter/blog

---

## Getting Help

**During implementation:**
- Use `/investigate` for bugs
- Use `/plan-eng-review` before major changes
- Use `/qa` before each deploy
- Use `/retro` weekly to track progress

**Need to pause?**
- Use `/checkpoint` to save state
- Update milestone progress
- Document blockers in full plan

**Stuck on design decisions?**
- Re-run `/office-hours` for specific questions
- Use `/council` for ambiguous tradeoffs
- Use `/plan-ceo-review` to challenge scope

---

Ready to start? Run:

```bash
cd ~/Developer
mkdir foxhound-demo
cd foxhound-demo
# Then follow Phase 1 in the full plan
```
