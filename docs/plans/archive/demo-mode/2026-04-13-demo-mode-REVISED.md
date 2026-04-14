# Foxhound Demo Mode — REVISED Architecture

**Date:** 2026-04-13  
**Status:** Architecture Updated Based on Reality  
**Target:** `demo.foxhound.caleb-love.com`

---

## 🎯 Major Discovery

The `foxhound-web` repo **already has a working demo** at `/demo/*` routes:
- ✅ `/demo/traces/` — trace list with demo data
- ✅ `/demo/traces/[id]/` — SessionReplay component
- ✅ `/demo/runs/diff/` — run comparison
- ✅ Demo data structure (`DEMO_TRACES` in `@/lib/demo-data.ts`)

**Published npm packages:**
- ✅ `@foxhound-ai/sdk` (TypeScript SDK)
- ✅ `@foxhound-ai/mcp-server` (MCP tools)

**What's NOT published (internal Foxhound packages):**
- `@foxhound/db`, `@foxhound/api`, `@foxhound/worker`, etc.

---

## Simplified Architecture

**No separate `foxhound-demo` repo needed!** Work directly in `foxhound-web`.

### What Exists
```
foxhound-web/
├── src/app/
│   ├── demo/
│   │   ├── traces/
│   │   │   ├── page.tsx        ✅ List view
│   │   │   └── [id]/
│   │   │       ├── page.tsx    ✅ Detail view
│   │   │       └── SessionReplay.tsx ✅
│   │   └── runs/diff/page.tsx  ✅
│   └── traces/                 (real app routes)
└── src/lib/demo-data.ts        ✅ Sample data
```

### What's Missing
1. ❌ **Problem Picker** — landing page at `/demo/page.tsx`
2. ❌ **Featured Runs** — curated data stories ($1,200 loop, regression, etc.)
3. ❌ **Background Agent** — continuous trace generation
4. ❌ **Deployment** — demo.foxhound.caleb-love.com subdomain

---

## Revised Implementation Plan

### Phase 1: Enhance Existing Demo Data (4-6 hours)

**Goal:** Replace generic `DEMO_TRACES` with featured runs

**Tasks:**
1. **Audit current demo data:**
   ```bash
   cd ~/Developer/foxhound-web
   cat src/lib/demo-data.ts
   ```

2. **Create featured runs** in `src/lib/demo-data.ts`:
   - Cost Disaster (the $1,200 runaway loop)
   - Quality Regression (94% → 64% success rate)
   - SLA Breach (P95 latency spike)
   - Experiment Comparison (GPT-4 vs Claude)

3. **Generate realistic trace data** using `@foxhound-ai/sdk`:
   ```typescript
   // scripts/generate-demo-data.ts
   import { Foxhound } from '@foxhound-ai/sdk';
   
   async function generateFeaturedRuns() {
     // Generate cost disaster
     // Generate quality regression
     // Generate SLA breach
     // etc.
     
     // Export to TypeScript const
     fs.writeFileSync('src/lib/demo-data.ts', `
       export const DEMO_TRACES = ${JSON.stringify(traces, null, 2)};
     `);
   }
   ```

4. **Test featured runs load** in existing UI

**Deliverable:** Rich demo data with 4-5 compelling stories

---

### Phase 2: Problem Picker Landing Page (3-4 hours)

**Goal:** Add onboarding UI at `/demo/`

**Create `src/app/demo/page.tsx`:**
```typescript
export default function DemoLandingPage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1>Welcome to Foxhound Demo</h1>
      <p>Which sounds like you?</p>
      
      <div className="grid gap-4 md:grid-cols-2">
        <ProblemCard
          title="My agent ran up a huge bill"
          href="/demo/traces/cost-disaster-123"
          icon="💸"
        />
        <ProblemCard
          title="My agent's quality dropped after a change"
          href="/demo/runs/diff?runA=v2.0&runB=v2.1"
          icon="📉"
        />
        <ProblemCard
          title="My agent is too slow"
          href="/demo/traces/sla-breach-456"
          icon="🐌"
        />
        <ProblemCard
          title="I want to test agent versions"
          href="/demo/experiments/gpt4-vs-claude"
          icon="🧪"
        />
      </div>
    </div>
  );
}
```

**Deliverable:** Problem-first onboarding routing to featured runs

---

### Phase 3: Background Agent (Optional, 4-6 hours)

**Goal:** Continuous trace generation (if you want "live" data)

**Two options:**

**Option A: Static demo (recommended for launch)**
- Keep curated featured runs only
- No continuous generation
- Simplest, most stable
- Data never changes (predictable demos)

**Option B: Live background agent**
- Create `foxhound-web/scripts/background-agent.ts`
- GitHub Actions workflow (runs every 30min)
- Generates 3-5 new traces
- Appends to `DEMO_TRACES` or separate database

**Recommendation:** Start with Option A, add Option B post-launch if needed.

---

### Phase 4: Deployment (2-3 hours)

**Goal:** Live at `demo.foxhound.caleb-love.com`

**Current deployment:** Check where foxhound-web is deployed now:
```bash
cd ~/Developer/foxhound-web
cat wrangler.toml  # Cloudflare?
cat vercel.json    # Vercel?
```

**Options:**

**Option A: Subdomain on existing deployment**
- If foxhound-web is already deployed, just add subdomain
- CNAME: `demo.foxhound.caleb-love.com` → existing deployment
- Routes already work (`/demo/*`)

**Option B: Separate deployment**
- Deploy foxhound-web specifically to demo subdomain
- Separate Cloudflare Pages project or Vercel project
- Environment variables for demo mode

**Deliverable:** Demo live and accessible

---

## Updated Architecture Diagram

```
User visits demo.foxhound.caleb-love.com/demo/
  ↓
Problem Picker (src/app/demo/page.tsx)
  ↓
Click "My agent ran up a huge bill"
  ↓
Navigate to /demo/traces/cost-disaster-123
  ↓
Existing SessionReplay component loads
  ↓
Displays featured run from DEMO_TRACES const
```

**No separate API, no separate database, no rolling window complexity.** Just static demo data in the existing Next.js app.

---

## Comparison: Old vs New Plan

| Aspect | Old Plan (Comprehensive) | New Plan (Revised) |
|--------|-------------------------|-------------------|
| **Repo** | New `foxhound-demo` repo | Work in existing `foxhound-web` |
| **Infrastructure** | Neon + Upstash + Cloudflare Workers | None needed (static data) |
| **Data storage** | PostgreSQL with seed SQL | TypeScript const in codebase |
| **Background agent** | GitHub Actions + OpenAI | Optional (static for launch) |
| **Rolling window** | Complex modulo timestamp mapping | Not needed (static data) |
| **UI components** | Import from main repo | Already in foxhound-web |
| **Deployment** | Two separate deployments | Single deployment (foxhound-web) |
| **Complexity** | 10 phases, 40-50 hours | 4 phases, 12-18 hours |
| **Maintenance** | ~1 hour/month | ~10 min/quarter |
| **Cost** | ~$1-2/month (OpenAI) | $0 |

---

## Recommended Execution

### Week 1: Foundation
**Day 1-2:** Generate featured runs data (Phase 1)  
**Day 3:** Build problem picker (Phase 2)  
**Day 4:** Test and polish  
**Day 5:** Deploy (Phase 4)

**Total: ~12-15 hours**

### Post-Launch (Optional)
- Add background agent for "live" feel
- Add more featured runs
- Add feedback mechanism

---

## Next Steps

1. **Verify current demo state:**
   ```bash
   cd ~/Developer/foxhound-web
   git status
   cat src/lib/demo-data.ts | head -50
   ```

2. **Decide: Static or Live?**
   - Static: Featured runs never change (easier)
   - Live: Background agent generates new traces (more impressive)

3. **Start Phase 1:**
   - Generate the 4 featured runs
   - Update `src/lib/demo-data.ts`

**Want me to help audit the current demo state or start generating featured runs?**
