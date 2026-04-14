# Foxhound Demo Mode — Planning Documents

**Date:** 2026-04-13  
**Status:** Architecture finalized, ready to implement

---

## 📚 Which Plan Should You Use?

### ✅ **RECOMMENDED: Revised Plan** 
**File:** [`2026-04-13-demo-mode-REVISED.md`](./2026-04-13-demo-mode-REVISED.md)

**Use this when:** You're ready to actually build the demo

**Why:** Based on the discovery that `foxhound-web` already has working `/demo/*` routes. Much simpler:
- Work in existing repo (no `foxhound-demo` needed)
- Static demo data (no database, no infrastructure)
- 4 phases instead of 10
- 12-15 hours instead of 40-50
- $0/month instead of $1-2/month

**Architecture:**
```
foxhound-web/src/app/demo/
├── page.tsx                    ← ADD: Problem picker
├── traces/
│   ├── page.tsx                ✅ EXISTS: Trace list
│   └── [id]/
│       ├── page.tsx            ✅ EXISTS: Trace detail
│       └── SessionReplay.tsx   ✅ EXISTS
└── runs/diff/page.tsx          ✅ EXISTS: Run comparison

foxhound-web/src/lib/
└── demo-data.ts                ← ENHANCE: Add featured runs
```

---

### 📖 **Original Comprehensive Plan** 
**File:** [`2026-04-13-demo-mode-comprehensive-plan.md`](./2026-04-13-demo-mode-comprehensive-plan.md)

**Use this when:** You want to understand the full design thinking process

**Why:** Documents the complete Office Hours session and initial architecture before discovering existing demo routes. Useful for understanding:
- Complete feature set brainstorming
- Infrastructure options considered
- Complex rolling-window architecture
- Background agent design
- Full deployment patterns

**Not recommended for implementation** (too complex), but valuable as reference.

---

### ⚡ **Quick Start Guide**
**File:** [`2026-04-13-demo-mode-QUICKSTART.md`](./2026-04-13-demo-mode-QUICKSTART.md)

**Use this when:** You want a 1-page overview and first commands to run

**Updated:** Reflects simplified architecture from revised plan

---

## 🎯 What Changed?

### Initial Assumption (Office Hours)
- Need separate `foxhound-demo` repo
- Run full Foxhound infrastructure (Neon, Upstash, Cloudflare Workers)
- 7-day rolling window with background agent
- Complex timestamp mapping logic

### Reality (After Investigation)
- `foxhound-web` already has `/demo/*` routes ✅
- SessionReplay, TraceExplorer components exist ✅
- Demo data structure (`DEMO_TRACES`) exists ✅
- Just need to enhance existing demo, not build from scratch

### Result
- **Effort reduced:** 40-50 hours → 12-15 hours
- **Complexity reduced:** 10 phases → 4 phases
- **Cost reduced:** ~$2/month → $0/month
- **Maintenance reduced:** 1 hour/month → 10 min/quarter

---

## 🚀 Recommended Next Steps

1. **Read the revised plan:**
   - [`2026-04-13-demo-mode-REVISED.md`](./2026-04-13-demo-mode-REVISED.md)

2. **Audit current demo state:**
   ```bash
   cd ~/Developer/foxhound-web
   cat src/lib/demo-data.ts | head -50
   pnpm dev
   # Visit http://localhost:3000/demo/traces
   ```

3. **Decide: Static or Live?**
   - **Static (recommended):** Featured runs never change, pure TypeScript data
   - **Live (optional):** Background agent generates new traces every 30min

4. **Start Phase 1:** Generate featured runs
   - Use `@foxhound-ai/sdk` to create realistic trace data
   - Update `src/lib/demo-data.ts` with 4-5 curated stories

---

## 🔑 Key Decisions Made

### From Office Hours Session

✅ **Problem-first onboarding** (Netflix model)  
✅ **Featured runs** as hero stories:
- Cost Disaster: $1,200 runaway loop
- Quality Regression: 94% → 64% success rate
- SLA Breach: P95 latency spike
- Experiment: GPT-4 vs Claude comparison

✅ **Background agent complexity:** Option B (somewhat realistic)  
✅ **Deployment target:** `demo.foxhound.caleb-love.com`

### After Investigation

✅ **Repository:** Use existing `foxhound-web` (not separate repo)  
✅ **Data strategy:** Static TypeScript constants (not database)  
✅ **Infrastructure:** None needed for launch (can add later)  
✅ **npm packages:** Only `@foxhound-ai/sdk` is published (other packages internal)

---

## 📊 Effort Comparison

| Task | Comprehensive Plan | Revised Plan |
|------|-------------------|--------------|
| Repository setup | 2-3 hours | 0 (already exists) |
| Data seeder | 8-12 hours | 4-6 hours (simpler) |
| Background agent | 4-6 hours | 0 (optional, post-launch) |
| Onboarding UI | 6-8 hours | 3-4 hours (less to build) |
| Rolling window | 4-6 hours | 0 (not needed) |
| Infrastructure | 4-6 hours | 0 (static data) |
| Testing | 6-8 hours | 2-3 hours (less to test) |
| Documentation | 3-4 hours | 1 hour (simpler) |
| Launch | 2-3 hours | 2-3 hours (same) |
| **TOTAL** | **39-56 hours** | **12-18 hours** |

---

## 💡 Why Keep Both Plans?

**Comprehensive plan** documents:
- Full Office Hours design thinking
- Infrastructure options (if you later want "live" demo)
- Background agent patterns
- Rolling window architecture (if featured runs need to rotate)

**Revised plan** is:
- What you should actually build for launch
- Simplest path to working demo
- Based on reality of existing codebase

Both are valuable — one for reference, one for execution.

---

## 🔗 Related Files

**Main Foxhound docs:**
- [`docs/overview/project-overview.md`](../overview/project-overview.md) — Current project status
- [`docs/specs/2026-04-10-foxhound-strategic-roadmap-design.md`](../specs/2026-04-10-foxhound-strategic-roadmap-design.md) — 6-phase roadmap

**Other planning docs:**
- [`docs/plans/2026-04-13-website-refresh-v2-light-mode.md`](./2026-04-13-website-refresh-v2-light-mode.md) — Marketing site redesign
- [`docs/plans/2026-04-12-testing-qa-gap-analysis.md`](./2026-04-12-testing-qa-gap-analysis.md) — Test coverage report

---

**Ready to start? Go to:** [`2026-04-13-demo-mode-REVISED.md`](./2026-04-13-demo-mode-REVISED.md)
