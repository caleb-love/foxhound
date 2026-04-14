# Foxhound Demo Mode — START HERE

**Date:** 2026-04-13  
**Status:** Architecture finalized (corrected)

---

## ⚠️ Important: Which Plan to Use?

### ✅ USE THIS ONE
**File:** [`2026-04-13-demo-mode-CORRECTED.md`](./2026-04-13-demo-mode-CORRECTED.md)

**Architecture:** Separate `foxhound-demo` repo that imports from main Foxhound  
**Status:** CORRECT — matches your requirements  
**Effort:** 20-29 hours (15-20 with AI)  
**Cost:** $1-7/month

---

### ❌ IGNORE THESE (Wrong Assumptions)

**File:** `2026-04-13-demo-mode-REVISED.md`  
**Why ignore:** Assumed demo would live in `foxhound-web` repo. **Wrong!** Demo needs separate repo.

**File:** `2026-04-13-demo-mode-comprehensive-plan.md`  
**Why ignore:** Original complex plan before discovering simpler options. Too much for what's needed.

---

## What You Want (Corrected Understanding)

**Separate `foxhound-demo` repository** that:

1. ✅ **Imports packages from main Foxhound**
   - Published: `@foxhound-ai/sdk`, `@foxhound-ai/mcp-server` (from npm)
   - Unpublished: Via git submodule + pnpm workspace

2. ✅ **Stays in sync automatically**
   - When Foxhound packages update, demo pulls latest
   - Demo always uses current Foxhound infrastructure

3. ✅ **Has its own data & deployment**
   - Own database with demo seed data
   - Own deployment separate from main product
   - Own background agent generating traces

4. ✅ **Uses real Foxhound infrastructure**
   - Real API (via Docker or submodule build)
   - Real worker (processes evals, experiments)
   - Real database schema (Postgres + Drizzle)

---

## Repository Structure

```
foxhound-demo/ (NEW REPO - you'll create this)
├── packages/
│   ├── seeder/              # Generate demo data
│   ├── background-agent/    # Continuous trace generation
│   └── onboarding/          # Problem picker UI
├── apps/
│   └── demo-web/            # Next.js app
├── data/
│   └── seed.sql             # Database seed
├── foxhound/                # Git submodule (main Foxhound repo)
└── docker-compose.yml       # Local dev stack

Imports from main Foxhound:
├── @foxhound-ai/sdk ✅ (published to npm)
├── @foxhound-ai/mcp-server ✅ (published to npm)
└── @foxhound/* packages (via submodule + workspace)
```

---

## 5 Phases

1. **Repository Setup** (2-3 hours) — Create repo, add submodule, docker-compose
2. **Data Seeder** (6-8 hours) — Generate featured runs + background data
3. **Background Agent** (4-6 hours) — GitHub Actions trace generator
4. **Problem Picker UI** (4-6 hours) — Next.js app with onboarding
5. **Deployment** (4-6 hours) — Deploy to demo.foxhound.caleb-love.com

**Total: 20-29 hours** (15-20 with AI assistance)

---

## Next Commands

```bash
# 1. Read the corrected plan
cat ~/Developer/Foxhound/docs/plans/2026-04-13-demo-mode-CORRECTED.md

# 2. Create foxhound-demo repo
cd ~/Developer
mkdir foxhound-demo
cd foxhound-demo
git init

# 3. Follow Phase 1 from CORRECTED.md
```

---

## Quick Decision Reference

| Decision | Answer |
|----------|--------|
| Separate repo? | ✅ Yes (`foxhound-demo`) |
| Import from Foxhound? | ✅ Via git submodule + npm packages |
| Own database? | ✅ Yes (Neon free tier) |
| Own deployment? | ✅ Yes (Railway or Oracle Cloud) |
| Background agent? | ✅ Yes (GitHub Actions, every 30min) |
| Problem picker? | ✅ Yes (Netflix model) |
| Featured runs? | ✅ 4 curated stories |
| Cost? | $1-7/month |

---

## Files to Read (In Order)

1. **This file** — You're reading it ✅
2. **CORRECTED.md** — Full implementation plan (15KB, read this next)
3. **Checkpoint** — Session state saved in `~/.gstack/projects/.../checkpoints/2026-04-13-demo-mode-corrected.md`

---

**Ready to start?** → Open [`2026-04-13-demo-mode-CORRECTED.md`](./2026-04-13-demo-mode-CORRECTED.md)
