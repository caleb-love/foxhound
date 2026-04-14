# Foxhound Demo Mode — CORRECTED Architecture

**Date:** 2026-04-13  
**Status:** Architecture corrected based on user clarification  
**Target:** `demo.foxhound.caleb-love.com`  
**Repo:** `foxhound-demo` (NEW, separate from main Foxhound)

---

## ✅ Corrected Understanding

**Separate `foxhound-demo` repo** that:
- Imports packages from main Foxhound repo (stays in sync as product updates)
- Has its own demo data generation and seeding
- Runs its own deployment (separate from main product)
- Pulls updates automatically as Foxhound packages are published

**NOT working in `foxhound-web`** — that was a wrong assumption.

---

## Architecture Overview

```
foxhound-demo/                    (NEW REPO)
├── packages/
│   ├── seeder/                   # Generate demo data
│   ├── background-agent/         # Continuous trace generation
│   └── onboarding/               # Problem picker UI
├── apps/
│   └── demo-web/                 # Next.js app
├── data/
│   └── seed.sql                  # Demo database seed
└── docker-compose.yml            # Full demo stack

Dependencies (from main Foxhound repo):
├── @foxhound-ai/sdk              # Published to npm ✅
├── @foxhound-ai/mcp-server       # Published to npm ✅
└── Foxhound infrastructure       # API + worker + DB (via Docker or pnpm workspace)
```

---

## How Demo Imports from Main Foxhound

### Published Packages (Easy)
```json
{
  "dependencies": {
    "@foxhound-ai/sdk": "^0.2.0",
    "@foxhound-ai/mcp-server": "^0.2.0"
  }
}
```

These auto-update when you publish new versions to npm.

### Unpublished Packages (Need Strategy)

**Option A: Run Foxhound API/Worker via Docker**
```yaml
# docker-compose.yml
services:
  foxhound-api:
    image: foxhound/api:latest      # Build & publish from main repo
    environment:
      DATABASE_URL: ${DEMO_DATABASE_URL}
      
  foxhound-worker:
    image: foxhound/worker:latest   # Build & publish from main repo
```

**Option B: Git Submodule**
```bash
cd foxhound-demo
git submodule add https://github.com/caleb-love/foxhound.git foxhound
```

Then reference via pnpm workspace:
```json
{
  "dependencies": {
    "@foxhound/db": "workspace:../foxhound/packages/db",
    "@foxhound/api": "workspace:../foxhound/apps/api"
  }
}
```

**Option C: Publish Internal Packages**
Publish `@foxhound/db`, `@foxhound/api-client`, etc. to npm (public or private registry).

**Recommendation: Option A (Docker images)** — cleanest separation, easy updates via image tags.

---

## Simplified Stack (Based on Your Needs)

### What the Demo Needs

1. **Database with demo data** (Neon free tier or local Postgres)
2. **Foxhound API** (to serve traces, experiments, etc.)
3. **Foxhound Worker** (to process evaluations, experiments)
4. **Demo web app** (problem picker + proxies to real Foxhound UI)
5. **Background agent** (generates new traces periodically)

### Free Tier Infrastructure

| Component | Provider | Cost |
|-----------|----------|------|
| Database | Neon (500MB) | $0 |
| Redis | Upstash (10K cmds/day) | $0 |
| API + Worker | Railway $5 starter OR Oracle Cloud free tier | $0-5/mo |
| Frontend | Cloudflare Pages | $0 |
| Background Agent | GitHub Actions | $0 |
| LLM Usage | OpenAI gpt-4o-mini | ~$1-2/mo |

**Total: $0-7/month**

---

## Repository Structure

```
foxhound-demo/
├── README.md
├── docker-compose.yml           # Local dev: Postgres + Redis + Foxhound stack
├── .github/
│   └── workflows/
│       ├── background-agent.yml # Runs every 30min
│       └── deploy.yml           # Deploy to Railway/Cloudflare
├── packages/
│   ├── seeder/                  # Generate featured runs + background data
│   │   ├── src/
│   │   │   ├── scenarios/
│   │   │   │   ├── cost-disaster.ts
│   │   │   │   ├── quality-regression.ts
│   │   │   │   ├── sla-breach.ts
│   │   │   │   └── experiment.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── background-agent/        # Continuous trace generator
│   │   ├── src/
│   │   │   ├── agents/
│   │   │   │   ├── support.ts
│   │   │   │   └── code-review.ts
│   │   │   └── index.ts
│   │   └── package.json
│   └── onboarding/              # Problem picker UI
│       ├── src/
│       │   ├── ProblemPicker.tsx
│       │   └── ProblemCard.tsx
│       └── package.json
├── apps/
│   └── demo-web/                # Next.js app
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx              # Problem picker
│       │   │   └── [...catchall]/        # Proxy to Foxhound UI
│       │   └── lib/
│       │       └── api-client.ts         # Uses @foxhound-ai/sdk
│       ├── next.config.js
│       └── package.json
├── data/
│   ├── seed.sql                 # Database seed (featured runs + background)
│   └── metadata.json            # Featured run references
├── infra/
│   ├── railway.json             # Railway deployment config
│   └── Dockerfile.api           # If building custom API image
└── foxhound/                    # Git submodule (if using Option B)
```

---

## Implementation Plan (Revised)

### Phase 1: Repository Setup (2-3 hours)

**1.1: Create foxhound-demo repo**
```bash
cd ~/Developer
mkdir foxhound-demo
cd foxhound-demo
git init
pnpm init
```

**1.2: Set up pnpm workspace**
```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

**1.3: Add Foxhound dependencies**

Choose import strategy (see "How Demo Imports from Main Foxhound" above).

**Recommended: Git submodule + workspace references**
```bash
git submodule add https://github.com/caleb-love/Foxhound.git foxhound
```

```json
// package.json (root)
{
  "dependencies": {
    "@foxhound-ai/sdk": "^0.2.0",
    "@foxhound-ai/mcp-server": "^0.2.0"
  },
  "devDependencies": {
    "@foxhound/db": "workspace:foxhound/packages/db",
    "@foxhound/api-client": "workspace:foxhound/packages/api-client"
  }
}
```

**1.4: Docker Compose for local dev**
```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: foxhound_demo
      POSTGRES_USER: demo
      POSTGRES_PASSWORD: demo
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./data/seed.sql:/docker-entrypoint-initdb.d/seed.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: ./foxhound/apps/api
    environment:
      DATABASE_URL: postgresql://demo:demo@postgres:5432/foxhound_demo
      REDIS_URL: redis://redis:6379
      ORG_ID: demo-org
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis

  worker:
    build: ./foxhound/apps/worker
    environment:
      DATABASE_URL: postgresql://demo:demo@postgres:5432/foxhound_demo
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

volumes:
  postgres-data:
```

**Tests:**
- [ ] `pnpm install` works
- [ ] `git submodule update --init` pulls Foxhound
- [ ] `docker-compose up` starts all services
- [ ] API health: `curl http://localhost:3001/health`

---

### Phase 2: Data Seeder (6-8 hours)

**2.1: Create seeder package**
```bash
mkdir -p packages/seeder/src/scenarios
cd packages/seeder
pnpm init
pnpm add @foxhound-ai/sdk openai drizzle-orm
```

**2.2: Generate Cost Disaster scenario**
```typescript
// packages/seeder/src/scenarios/cost-disaster.ts
import { Foxhound } from '@foxhound-ai/sdk';
import OpenAI from 'openai';

export async function generateCostDisaster() {
  const fox = new Foxhound({
    apiKey: process.env.FOXHOUND_API_KEY!,
    endpoint: 'http://localhost:3001',
  });
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const sessionId = `cost-disaster-${Date.now()}`;
  
  // Generate 100 iterations of the broken loop
  for (let i = 0; i < 100; i++) {
    const span = fox.trace.startSpan({
      name: 'customer_support_query',
      sessionId,
      agentId: 'support-agent-v1',
    });
    
    // Cheap model for seeding, attribute as GPT-4 for cost story
    await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful customer support agent.' },
        { role: 'user', content: 'Help me reset my password' }
      ],
      max_tokens: 50,
    });
    
    span.setAttributes({
      'llm.model': 'gpt-4',
      'llm.input_tokens': 20,
      'llm.output_tokens': 50,
      'llm.cost_usd': 0.0312, // GPT-4 pricing
    });
    
    span.end();
  }
  
  // Create cost budget alert
  await fox.budgets.create({
    agentId: 'support-agent-v1',
    amountUsd: 50.0,
    period: 'daily',
    breachedAt: new Date(),
  });
  
  return {
    sessionId,
    title: 'The $1,200 Runaway Loop',
    category: 'cost-disaster',
  };
}
```

**2.3: Generate other scenarios**
- `quality-regression.ts` — Two runs with different success rates
- `sla-breach.ts` — High latency traces with P95 violation
- `experiment.ts` — Dataset with GPT-4 vs Claude runs

**2.4: Generate background noise**
```typescript
// packages/seeder/src/background.ts
export async function generateBackgroundNoise(days: number = 7) {
  // 20-30 normal traces per day
  // Mix of support, code review, research agents
  // Realistic timing, costs, success rates
}
```

**2.5: Export to SQL**
```bash
cd packages/seeder
pnpm seed  # Runs all scenarios + background

# Export from local DB
pg_dump -h localhost -U demo foxhound_demo \
  --data-only \
  -t traces -t spans -t evaluators -t experiments \
  > ../../data/seed.sql
```

**Tests:**
- [ ] Run seeder: `pnpm --filter seeder seed`
- [ ] Check DB: `psql -U demo foxhound_demo -c "SELECT COUNT(*) FROM traces;"`
- [ ] Verify featured runs exist
- [ ] Load seed in fresh DB and verify

---

### Phase 3: Background Agent (4-6 hours)

**3.1: Create background agent package**
```typescript
// packages/background-agent/src/index.ts
import { Foxhound } from '@foxhound-ai/sdk';
import OpenAI from 'openai';

async function main() {
  const fox = new Foxhound({
    apiKey: process.env.FOXHOUND_API_KEY!,
    endpoint: process.env.FOXHOUND_ENDPOINT!,
  });
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Generate 3-5 traces
  const count = Math.floor(Math.random() * 3) + 3;
  
  for (let i = 0; i < count; i++) {
    await generateSupportTrace(fox, openai);
  }
  
  console.log(`Generated ${count} traces`);
}

async function generateSupportTrace(fox: Foxhound, openai: OpenAI) {
  const sessionId = `bg-${Date.now()}-${Math.random()}`;
  
  const span = fox.trace.startSpan({
    name: 'support_ticket',
    sessionId,
    agentId: 'support-agent-v2',
  });
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a customer support agent.' },
      { role: 'user', content: pickRandomQuery() }
    ],
    max_tokens: 100,
  });
  
  span.setAttributes({
    'llm.model': 'gpt-4o-mini',
    'llm.input_tokens': response.usage?.prompt_tokens || 20,
    'llm.output_tokens': response.usage?.completion_tokens || 80,
    'llm.cost_usd': calculateCost(response.usage),
  });
  
  span.end();
}

main();
```

**3.2: GitHub Actions workflow**
```yaml
# .github/workflows/background-agent.yml
name: Background Agent

on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes
  workflow_dispatch:

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm --filter background-agent generate
        env:
          FOXHOUND_API_KEY: ${{ secrets.DEMO_API_KEY }}
          FOXHOUND_ENDPOINT: ${{ secrets.DEMO_ENDPOINT }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

**Tests:**
- [ ] Run locally: `pnpm --filter background-agent generate`
- [ ] Verify traces in DB
- [ ] Check OpenAI usage (<$0.10 per run)
- [ ] Trigger GH Action manually and verify

---

### Phase 4: Problem Picker UI (4-6 hours)

**4.1: Create onboarding package**
```typescript
// packages/onboarding/src/ProblemPicker.tsx
export function ProblemPicker() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1>Welcome to Foxhound Demo</h1>
      <p>Which sounds like you?</p>
      
      <div className="grid gap-4 md:grid-cols-2">
        <ProblemCard
          title="My agent ran up a huge bill"
          description="Runaway loops, unexpected costs"
          icon="💸"
          href="/traces/cost-disaster-123"
        />
        <ProblemCard
          title="My agent's quality dropped"
          description="Success rate declined after changes"
          icon="📉"
          href="/runs/diff?v1=v2.0&v2=v2.1"
        />
        {/* More cards */}
      </div>
    </div>
  );
}
```

**4.2: Demo web app**
```typescript
// apps/demo-web/src/app/page.tsx
import { ProblemPicker } from '@foxhound-demo/onboarding';

export default function HomePage() {
  return <ProblemPicker />;
}
```

**4.3: Proxy to Foxhound UI**

**Option A: Import Foxhound UI components** (if they export)
```typescript
// apps/demo-web/src/app/traces/[id]/page.tsx
import { TraceExplorer } from '@foxhound/ui'; // If available

export default function TracePage({ params }) {
  return <TraceExplorer traceId={params.id} />;
}
```

**Option B: Reverse proxy** (simpler)
```typescript
// apps/demo-web/next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/traces/:path*',
        destination: 'http://localhost:3001/traces/:path*',
      },
    ];
  },
};
```

**Tests:**
- [ ] Visit `/` → see problem picker
- [ ] Click card → navigates to featured run
- [ ] Featured run loads from API
- [ ] UI components render correctly

---

### Phase 5: Deployment (4-6 hours)

**5.1: Choose deployment platform**

**Option A: Railway ($5/month)**
```json
// railway.json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "pnpm start",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

**Option B: Oracle Cloud (free)**
- 2 VMs (1GB RAM each)
- Run API + worker on one VM, frontend on another
- Setup guide: https://oracle.com/cloud/free

**5.2: Deploy database**
- **Neon:** Free tier, easy setup
- **Supabase:** Free tier, includes UI
- **Railway Postgres:** $5/month (bundled with app)

**5.3: Deploy frontend**
```bash
cd apps/demo-web
pnpm build
wrangler pages deploy .next --project-name foxhound-demo
```

**5.4: Configure domain**
```
CNAME: demo.foxhound.caleb-love.com → <deployment-url>
```

**Tests:**
- [ ] Visit `demo.foxhound.caleb-love.com`
- [ ] Problem picker loads
- [ ] Featured runs work
- [ ] Background agent running (check last run time)

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 1. Repo Setup | 2-3 hours | None |
| 2. Data Seeder | 6-8 hours | Phase 1 |
| 3. Background Agent | 4-6 hours | Phase 1, Phase 2 |
| 4. Problem Picker | 4-6 hours | Phase 2 |
| 5. Deployment | 4-6 hours | All previous |

**Total: 20-29 hours**

**With AI assistance:** ~15-20 hours

---

## Next Steps

1. **Create foxhound-demo repo:**
   ```bash
   cd ~/Developer
   mkdir foxhound-demo
   cd foxhound-demo
   git init
   ```

2. **Follow Phase 1** (Repository Setup)

3. **Generate first featured run** (Phase 2)

4. **Test locally with docker-compose**

**Want me to help with Phase 1 setup or generating the first featured run?**
