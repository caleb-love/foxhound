# Foxhound Demo Mode: Comprehensive Implementation Plan

**Date:** 2026-04-13  
**Status:** Design Complete — Ready for Implementation  
**Target:** `demo.foxhound.caleb-love.com`  
**Repo:** `foxhound-demo` (new, separate from open source)

---

## Executive Summary

Build a fully functional, zero-friction Foxhound demo accessible via web browser. No signup, no install — just click and explore. Netflix-style problem-first onboarding routes users to curated "featured runs" that prove specific value props (Session Replay, Run Diff, Cost Budgets, etc.).

**Architecture:** Immutable 7-day dataset (hand-crafted featured runs) + ephemeral live layer (background agent generates realistic noise every 30min). Rolling window: as real time progresses, the "now" pointer rotates through the week. Featured runs never expire.

**Tech stack (all free tiers):**
- Neon (Postgres, 500MB)
- Upstash (Redis, 10K commands/day)
- Cloudflare Workers (API) + Pages (Frontend)
- GitHub Actions (background agent, runs every 30min)

**Total cost:** $0/month (OpenAI API usage: ~$1-2/month for background agent)

---

## Design Decisions (From Office Hours)

### User Journey
1. User clicks "Try Demo" on foxhound.dev
2. Land on problem triage: "Which sounds like you?"
   - "My agent ran up a huge bill" → Cost Disasters
   - "My agent's quality dropped after a change" → Quality Regressions
   - "My agent is too slow" → Performance Issues
   - "I want to test agent versions" → Evaluation & Experiments
   - "Just show me everything" → Dashboard overview
3. Immediately dropped into featured run (e.g., Session Replay of $1,200 runaway loop)
4. Full product UI — can click, explore, navigate freely

### Featured Runs ("The Netflix Catalog")

**Flagship: Cost Disaster — The $1,200 Runaway Loop**
- Agent: Customer support chatbot
- Incident: Friday 11:45 PM, agent enters infinite loop, runs 40,000 times
- Cost: $1,247.83 in OpenAI API calls
- Resolution: Cost budget would have killed it at $50
- Showcase: Session Replay (see exact state when loop started), Cost Budget UI, alert timeline

**Strong Second: Quality Regression — The Silent Degradation**
- Agent: Document Q&A agent
- Incident: Version 2.1 deployed, success rate drops from 94% → 64%
- Cause: One-line prompt change broke context handling
- Showcase: Run Diff (side-by-side v2.0 vs v2.1), score comparison, regression alert

**Performance Issues: SLA Breach — The Slow Support Agent**
- Agent: Support ticket classifier
- Incident: P95 latency spikes from 800ms → 3.2s, violates SLA
- Cause: New LLM provider added 2s network latency
- Showcase: SLA monitoring dashboard, latency charts, breach alerts

**Evaluation & Experiments: Version A/B Testing**
- Agent: Code review assistant
- Dataset: 50 production pull requests
- Experiment: GPT-4 vs Claude 3.5 Sonnet
- Results: Claude 24% more accurate, 18% faster, 40% cheaper
- Showcase: Experiment comparison, score distributions, cost breakdown

**Additional Featured Runs (optional, add over time):**
- Multi-agent coordination failure (shows agent hierarchy visualization)
- Behavior regression (structural change detection)
- Dataset curation from production failures
- Manual scoring workflow via MCP tools

### Data Strategy

**Immutable Base Layer (7-day seed):**
- Hand-crafted featured runs with perfect storytelling
- Background realistic noise (non-featured runs, normal operations)
- Committed to repo as `data/seed-week.sql`
- Regenerate only when schema changes or featured runs need updates

**Ephemeral Live Layer:**
- GitHub Actions workflow runs every 30min
- Uses gpt-3.5-turbo or gpt-4o-mini (cheap, realistic)
- Generates 3-5 new traces per run (support tickets, code reviews, etc.)
- Creates realistic API call patterns, span hierarchies, timing variance
- Costs: ~$0.05/day = $1.50/month

**Rolling Window:**
- "Now" pointer advances in real time
- Database queries use modulo math to wrap around the 7-day cycle
- Example: If today is April 20 and seed starts on April 1, queries map April 20 → April 6 (day 6 of the cycle)
- Featured runs have fixed timestamps within the cycle, always accessible

---

## Repository Structure

```
foxhound-demo/
├── README.md
├── docker-compose.yml           # Local dev stack
├── .github/
│   └── workflows/
│       ├── background-agent.yml # Runs every 30min
│       ├── deploy.yml           # Deploy to Cloudflare
│       └── seed-data.yml        # One-time: generate seed data
├── packages/
│   ├── seeder/                  # Generate 7-day base dataset
│   │   ├── src/
│   │   │   ├── scenarios/
│   │   │   │   ├── cost-disaster.ts      # $1,200 loop
│   │   │   │   ├── quality-regression.ts # Run diff story
│   │   │   │   ├── sla-breach.ts         # Performance issue
│   │   │   │   └── experiment.ts         # A/B test
│   │   │   ├── background-noise.ts       # Realistic filler data
│   │   │   └── index.ts                  # Orchestrator
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── background-agent/        # Continuous trace generator
│   │   ├── src/
│   │   │   ├── agents/
│   │   │   │   ├── support-agent.ts     # Simple customer support
│   │   │   │   └── code-review-agent.ts # Simple code review
│   │   │   └── index.ts                 # Entry point for GH Actions
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── onboarding/              # Problem triage UI components
│       ├── src/
│       │   ├── ProblemPicker.tsx
│       │   ├── FeaturedRunCard.tsx
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── apps/
│   └── demo-web/                # Next.js app
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx              # Problem triage landing
│       │   │   ├── layout.tsx
│       │   │   └── [...catchall]/page.tsx # Proxy to Foxhound UI
│       │   ├── components/               # Import from Foxhound repo
│       │   └── lib/
│       │       └── demo-data-mapper.ts   # Rolling window logic
│       ├── package.json
│       ├── tsconfig.json
│       └── next.config.js
├── data/
│   ├── seed-week.sql            # 7-day dataset (committed)
│   ├── seed-metadata.json       # Featured run references
│   └── .gitignore
├── infra/
│   ├── wrangler.toml            # Cloudflare Workers config
│   ├── neon-setup.sql           # Database schema + seed
│   └── upstash-setup.sh         # Redis initialization
└── docs/
    ├── architecture.md          # How the demo works
    ├── SEEDING.md               # How to regenerate seed data
    └── DEPLOYMENT.md            # Deployment guide
```

---

## Phase 0.5: Foxhound Web Components Package (If Needed)

**Duration:** 2-4 hours  
**Deliverables:** Exportable UI components from main Foxhound repo

**Check first:** Does the main Foxhound repo already export UI components as importable packages?

```bash
cd ~/Developer/Foxhound
ls packages/web-components 2>/dev/null || echo "Not found - needs to be created"
```

**If not found**, create in main Foxhound repo:

```bash
cd ~/Developer/Foxhound/packages
mkdir web-components
cd web-components
pnpm init
```

**Extract these components from wherever they currently live:**
- `TraceExplorer` - Full trace tree UI with span expansion
- `RunDiff` - Side-by-side run comparison
- `Dashboard` - Agent overview with charts
- `SessionReplay` - Timeline-based state reconstruction
- `SLAMonitor` - SLA dashboard with breach alerts
- `ExperimentComparison` - Experiment results UI

**Package structure:**
```
packages/web-components/
├── src/
│   ├── trace-explorer/
│   │   ├── TraceExplorer.tsx
│   │   ├── SpanTree.tsx
│   │   └── index.ts
│   ├── run-diff/
│   │   ├── RunDiff.tsx
│   │   ├── DiffView.tsx
│   │   └── index.ts
│   ├── dashboard/
│   ├── session-replay/
│   ├── sla-monitor/
│   ├── experiment-comparison/
│   └── index.ts  # Re-export all
├── package.json
└── tsconfig.json
```

**`package.json`:**
```json
{
  "name": "@foxhound/web-components",
  "version": "0.2.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./trace-explorer": "./dist/trace-explorer/index.js",
    "./run-diff": "./dist/run-diff/index.js",
    "./dashboard": "./dist/dashboard/index.js"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

**Publish:**
```bash
cd ~/Developer/Foxhound/packages/web-components
pnpm build
pnpm publish --access public
```

**Then proceed to Phase 1.**

**If web-components already exists**, skip to Phase 1.

---

## Phase 1: Repository Setup & Foundation

**Duration:** 2-3 hours  
**Deliverables:** Working repo, CI/CD scaffolding, local dev environment

### Tasks

#### 1.1: Create Repository
```bash
cd ~/Developer
mkdir foxhound-demo
cd foxhound-demo
git init
pnpm init
```

**Files to create:**
- `package.json` (workspace root)
- `pnpm-workspace.yaml`
- `.gitignore` (node_modules, .env, dist, build artifacts)
- `README.md` (project overview, local dev setup)
- `turbo.json` (build pipeline config)
- `.nvmrc` (Node 20+)

#### 1.2: Add Foxhound as Dependency

**Using published npm packages:**
```json
{
  "dependencies": {
    "@foxhound/db": "^0.2.0",
    "@foxhound-ai/sdk": "^0.2.0",
    "@foxhound/api-client": "^0.2.0",
    "@foxhound/web-components": "^0.2.0"
  }
}
```

**For local development** (if you need to test unreleased Foxhound changes):
```bash
# In main Foxhound repo
cd ~/Developer/Foxhound/packages/db
pnpm link --global

# In demo repo
cd ~/Developer/foxhound-demo
pnpm link --global @foxhound/db
```

**Note:** Pin to specific versions in production to avoid unexpected breakage from Foxhound updates.

#### 1.3: Docker Compose for Local Dev
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
      - ./data/seed-week.sql:/docker-entrypoint-initdb.d/seed.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build:
      context: ../Foxhound
      dockerfile: apps/api/Dockerfile
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
    build:
      context: ../Foxhound
      dockerfile: apps/worker/Dockerfile
    environment:
      DATABASE_URL: postgresql://demo:demo@postgres:5432/foxhound_demo
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

  demo-web:
    build: ./apps/demo-web
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
    depends_on:
      - api

volumes:
  postgres-data:
```

#### 1.4: CI/CD Scaffolding
- `.github/workflows/deploy.yml` (skeleton, fill in Phase 7)
- `.github/workflows/background-agent.yml` (skeleton, fill in Phase 4)
- `.github/workflows/test.yml` (runs tests on PRs)

**Tests:**
- [ ] `pnpm install` works
- [ ] `docker-compose up` starts all services
- [ ] Can access API at `localhost:3001/health`
- [ ] Can access demo web at `localhost:3000`

---

## Phase 2: Data Seeder — Generate the 7-Day Base Dataset

**Duration:** 8-12 hours  
**Deliverables:** `data/seed-week.sql` with featured runs + background noise

### 2.1: Seeder Package Setup

**Create `packages/seeder/`:**
```bash
cd packages
mkdir seeder
cd seeder
pnpm init
pnpm add -D typescript tsx @types/node
pnpm add drizzle-orm postgres openai
```

**Entry point: `src/index.ts`**
```typescript
import { generateCostDisaster } from './scenarios/cost-disaster';
import { generateQualityRegression } from './scenarios/quality-regression';
import { generateSLABreach } from './scenarios/sla-breach';
import { generateExperiment } from './scenarios/experiment';
import { generateBackgroundNoise } from './background-noise';

async function main() {
  const startDate = new Date('2026-04-01T00:00:00Z'); // Week starts here
  
  console.log('Generating featured runs...');
  await generateCostDisaster(startDate);
  await generateQualityRegression(startDate);
  await generateSLABreach(startDate);
  await generateExperiment(startDate);
  
  console.log('Generating background noise...');
  await generateBackgroundNoise(startDate, 7); // 7 days
  
  console.log('Exporting to SQL...');
  await exportToSQL('./data/seed-week.sql');
  
  console.log('Done!');
}

main();
```

### 2.2: Featured Run Scenarios

Each scenario is a TypeScript module that generates realistic trace data for one "show."

**Example: `src/scenarios/cost-disaster.ts`**
```typescript
import { Foxhound } from '@foxhound-ai/sdk';
import OpenAI from 'openai';

export async function generateCostDisaster(startDate: Date) {
  const fox = new Foxhound({
    apiKey: process.env.FOXHOUND_API_KEY!,
    endpoint: process.env.FOXHOUND_ENDPOINT!,
  });
  
  // Incident timestamp: Friday 11:45 PM (day 5 of the week)
  const incidentTime = new Date(startDate);
  incidentTime.setDate(incidentTime.getDate() + 5);
  incidentTime.setHours(23, 45, 0);
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Create the runaway loop
  const sessionId = `cost-disaster-${incidentTime.getTime()}`;
  
  for (let i = 0; i < 40000; i++) {
    // Simulate the broken agent making repetitive calls
    const span = fox.trace.startSpan({
      name: 'customer_support_query',
      sessionId,
      agentId: 'support-agent-v1',
      timestamp: new Date(incidentTime.getTime() + i * 100), // 100ms intervals
    });
    
    // Actual LLM call (but use cheap model for seeding)
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful customer support agent.' },
        { role: 'user', content: 'I need help with my account.' }
      ],
      max_tokens: 50,
    });
    
    span.setAttributes({
      'llm.model': 'gpt-4', // Pretend it was GPT-4 for cost story
      'llm.input_tokens': 20,
      'llm.output_tokens': 50,
      'llm.cost_usd': 0.0312, // GPT-4 pricing
    });
    
    span.end();
    
    // Break after 100 iterations for seeding (don't actually run 40K)
    if (i >= 100) break;
  }
  
  // Create cost budget alert
  await fox.budgets.create({
    agentId: 'support-agent-v1',
    amountUsd: 50.0,
    period: 'daily',
    breachedAt: new Date(incidentTime.getTime() + 50 * 100), // Breached at iteration 50
  });
  
  return {
    featuredRunId: sessionId,
    title: 'The $1,200 Runaway Loop',
    category: 'cost-disaster',
    timestamp: incidentTime,
  };
}
```

**Scenarios to implement:**
- [x] `cost-disaster.ts` — 40K loop, $1,247 cost
- [x] `quality-regression.ts` — v2.0 (94% success) vs v2.1 (64% success)
- [x] `sla-breach.ts` — P95 latency spike from 800ms → 3.2s
- [x] `experiment.ts` — GPT-4 vs Claude comparison on 50 PRs

### 2.3: Background Noise Generator

**`src/background-noise.ts`:**
```typescript
export async function generateBackgroundNoise(startDate: Date, days: number) {
  const fox = new Foxhound({ /* ... */ });
  
  // Generate 20-30 normal runs per day
  for (let day = 0; day < days; day++) {
    for (let run = 0; run < 25; run++) {
      const timestamp = new Date(startDate);
      timestamp.setDate(timestamp.getDate() + day);
      timestamp.setHours(Math.random() * 24);
      
      await generateNormalSupportTicket(fox, timestamp);
      await generateNormalCodeReview(fox, timestamp);
    }
  }
}

async function generateNormalSupportTicket(fox: Foxhound, timestamp: Date) {
  // Successful, unremarkable support interaction
  // Use cheap model, realistic timing
}

async function generateNormalCodeReview(fox: Foxhound, timestamp: Date) {
  // Normal code review run, no issues
}
```

### 2.4: Export to SQL

**`src/export.ts`:**
```typescript
import { db } from '@foxhound/db';
import { sql } from 'drizzle-orm';

export async function exportToSQL(outputPath: string) {
  // Use pg_dump or drizzle introspection to export all inserted data
  const dump = await db.execute(sql`
    SELECT * FROM traces WHERE org_id = 'demo-org';
    SELECT * FROM spans WHERE org_id = 'demo-org';
    SELECT * FROM evaluators WHERE org_id = 'demo-org';
    -- etc.
  `);
  
  await fs.writeFile(outputPath, dump);
}
```

**Alternative (simpler):** Use `pg_dump` after seeding to a local DB:
```bash
pg_dump -h localhost -U demo foxhound_demo --data-only -t traces -t spans -t evaluators > data/seed-week.sql
```

### 2.5: Seed Metadata

**`data/seed-metadata.json`:**
```json
{
  "week_start": "2026-04-01T00:00:00Z",
  "featured_runs": [
    {
      "id": "cost-disaster-1234567890",
      "title": "The $1,200 Runaway Loop",
      "category": "cost-disaster",
      "description": "Customer support agent enters infinite loop, runs 40,000 times",
      "showcase_features": ["session_replay", "cost_budgets", "alerts"],
      "day_of_week": 5,
      "hour": 23
    },
    {
      "id": "quality-regression-0987654321",
      "title": "The Silent Degradation",
      "category": "quality-regression",
      "description": "One-line prompt change drops success rate from 94% to 64%",
      "showcase_features": ["run_diff", "regression_detection", "scores"],
      "day_of_week": 3,
      "hour": 14
    }
  ]
}
```

**Tests:**
- [ ] Run seeder: `pnpm --filter seeder seed`
- [ ] Verify `data/seed-week.sql` created (check file size >1MB)
- [ ] Load seed into local postgres: `psql -U demo -d foxhound_demo < data/seed-week.sql`
- [ ] Query featured runs: `SELECT * FROM traces WHERE session_id LIKE 'cost-disaster%';`
- [ ] Verify 7 days of background noise (check trace count ~175 = 25/day * 7)

---

## Phase 3: Background Agent — Continuous Trace Generation

**Duration:** 4-6 hours  
**Deliverables:** GitHub Actions workflow generating traces every 30min

### 3.1: Background Agent Package

**Create `packages/background-agent/`:**
```typescript
// src/index.ts
import { Foxhound } from '@foxhound-ai/sdk';
import OpenAI from 'openai';

async function main() {
  const fox = new Foxhound({
    apiKey: process.env.FOXHOUND_API_KEY!,
    endpoint: process.env.FOXHOUND_ENDPOINT!,
  });
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  console.log('Generating background traces...');
  
  // Generate 3-5 traces per run
  const numTraces = Math.floor(Math.random() * 3) + 3;
  
  for (let i = 0; i < numTraces; i++) {
    const agentType = Math.random() > 0.5 ? 'support' : 'code_review';
    
    if (agentType === 'support') {
      await generateSupportTrace(fox, openai);
    } else {
      await generateCodeReviewTrace(fox, openai);
    }
  }
  
  console.log(`Generated ${numTraces} traces`);
}

async function generateSupportTrace(fox: Foxhound, openai: OpenAI) {
  const sessionId = `bg-support-${Date.now()}-${Math.random()}`;
  
  const span = fox.trace.startSpan({
    name: 'support_ticket',
    sessionId,
    agentId: 'support-agent-v2',
  });
  
  // Cheap LLM call for realism
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a customer support agent.' },
      { role: 'user', content: generateRandomSupportQuery() }
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

function generateRandomSupportQuery(): string {
  const queries = [
    'How do I reset my password?',
    'My account is locked, can you help?',
    'I need to update my billing information.',
    'What are your support hours?',
    'I accidentally deleted a file, can I recover it?',
  ];
  return queries[Math.floor(Math.random() * queries.length)];
}

main();
```

### 3.2: GitHub Actions Workflow

**`.github/workflows/background-agent.yml`:**
```yaml
name: Background Agent

on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes
  workflow_dispatch:  # Manual trigger for testing

jobs:
  generate-traces:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install --frozen-lockfile
      
      - run: pnpm --filter background-agent run generate
        env:
          FOXHOUND_API_KEY: ${{ secrets.DEMO_FOXHOUND_API_KEY }}
          FOXHOUND_ENDPOINT: ${{ secrets.DEMO_FOXHOUND_ENDPOINT }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      
      - name: Report status
        if: failure()
        run: echo "Background agent failed - check logs"
```

**Secrets to add to GitHub repo:**
- `DEMO_FOXHOUND_API_KEY` — API key for demo org
- `DEMO_FOXHOUND_ENDPOINT` — Cloudflare Worker URL (after Phase 7)
- `OPENAI_API_KEY` — For gpt-4o-mini calls

**Tests:**
- [ ] Manually trigger workflow: `gh workflow run background-agent.yml`
- [ ] Verify traces appear in demo database
- [ ] Check OpenAI usage (should be <$0.10 per run)
- [ ] Verify workflow runs every 30min (check Actions tab after 1 hour)

---

## Phase 4: Onboarding UI — Problem Triage

**Duration:** 6-8 hours  
**Deliverables:** Landing page with problem picker, routes to featured runs

### 4.1: Onboarding Package

**Create `packages/onboarding/src/ProblemPicker.tsx`:**
```typescript
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

const PROBLEMS = [
  {
    id: 'cost-disaster',
    title: 'My agent ran up a huge bill',
    description: 'Runaway loops, unexpected costs, budget overruns',
    icon: '💸',
    featuredRunPath: '/traces/cost-disaster-1234567890',
  },
  {
    id: 'quality-regression',
    title: 'My agent\'s quality dropped after a change',
    description: 'Success rate declined, behavior changed, regressions',
    icon: '📉',
    featuredRunPath: '/runs/diff/quality-regression-0987654321',
  },
  {
    id: 'performance',
    title: 'My agent is too slow',
    description: 'High latency, SLA breaches, timeout issues',
    icon: '🐌',
    featuredRunPath: '/sla/breach/sla-breach-1122334455',
  },
  {
    id: 'evaluation',
    title: 'I want to test agent versions',
    description: 'A/B testing, quality comparison, dataset evaluation',
    icon: '🧪',
    featuredRunPath: '/experiments/experiment-5566778899',
  },
  {
    id: 'overview',
    title: 'Just show me everything',
    description: 'Full dashboard, all features',
    icon: '🎯',
    featuredRunPath: '/dashboard',
  },
];

export function ProblemPicker() {
  const router = useRouter();
  
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-4">
        Welcome to Foxhound Demo
      </h1>
      <p className="text-xl text-gray-600 mb-8">
        Which sounds like you?
      </p>
      
      <div className="grid gap-4 md:grid-cols-2">
        {PROBLEMS.map((problem) => (
          <Card
            key={problem.id}
            className="p-6 cursor-pointer hover:border-blue-500 hover:shadow-lg transition"
            onClick={() => router.push(problem.featuredRunPath)}
          >
            <div className="text-4xl mb-3">{problem.icon}</div>
            <h3 className="text-lg font-semibold mb-2">{problem.title}</h3>
            <p className="text-sm text-gray-600">{problem.description}</p>
          </Card>
        ))}
      </div>
      
      <div className="mt-8 text-center text-sm text-gray-500">
        This is a fully functional demo with real (generated) data.
        No signup required. Explore freely.
      </div>
    </div>
  );
}
```

### 4.2: Demo Web App

**`apps/demo-web/src/app/page.tsx`:**
```typescript
import { ProblemPicker } from '@foxhound-demo/onboarding';

export default function HomePage() {
  return <ProblemPicker />;
}
```

**`apps/demo-web/src/app/[...catchall]/page.tsx`:**
```typescript
// Proxy to Foxhound UI components
// Import trace explorer, run diff, dashboard, etc. from Foxhound repo
import { TraceExplorer } from '@foxhound/web/components/trace-explorer';
import { RunDiff } from '@foxhound/web/components/run-diff';
// etc.

export default function CatchAllPage({ params }: { params: { catchall: string[] } }) {
  const path = params.catchall.join('/');
  
  // Route to appropriate component based on path
  if (path.startsWith('traces/')) {
    const traceId = path.split('/')[1];
    return <TraceExplorer traceId={traceId} />;
  }
  
  if (path.startsWith('runs/diff/')) {
    const runId = path.split('/')[2];
    return <RunDiff runId={runId} />;
  }
  
  // ... etc.
}
```

**Tests:**
- [ ] Visit `localhost:3000` → see problem picker
- [ ] Click "My agent ran up a huge bill" → navigates to `/traces/cost-disaster-...`
- [ ] Verify featured run loads (Session Replay UI visible)
- [ ] Click around UI (expand spans, filter, etc.) — everything functional

---

## Phase 5: Rolling Window Implementation

**Duration:** 4-6 hours  
**Deliverables:** Time-mapping logic, database queries work at any real timestamp

### 5.1: Rolling Window Mapper

**`apps/demo-web/src/lib/demo-data-mapper.ts`:**
```typescript
const WEEK_START = new Date('2026-04-01T00:00:00Z');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Maps a real-world timestamp to a position in the 7-day demo cycle.
 * 
 * Example:
 *   - Seed week: April 1-7
 *   - Real date: April 20 (19 days after start)
 *   - Mapped to: April 6 (day 5 of cycle, 19 % 7 = 5)
 */
export function mapToSeedTimestamp(realTimestamp: Date): Date {
  const msSinceStart = realTimestamp.getTime() - WEEK_START.getTime();
  const cyclePosition = msSinceStart % WEEK_MS;
  
  return new Date(WEEK_START.getTime() + cyclePosition);
}

/**
 * Adjusts a database query to use seed timestamps.
 */
export function adjustQueryForDemo(query: any): any {
  // If query has a time range filter, map both bounds to seed cycle
  if (query.startTime && query.endTime) {
    query.startTime = mapToSeedTimestamp(new Date(query.startTime));
    query.endTime = mapToSeedTimestamp(new Date(query.endTime));
  }
  
  return query;
}
```

### 5.2: API Middleware

**Intercept API requests and adjust timestamps:**
```typescript
// In Cloudflare Worker (Phase 7) or Next.js middleware
import { mapToSeedTimestamp } from './demo-data-mapper';

export async function onRequest(context) {
  const { request } = context;
  
  // Parse request body
  const body = await request.json();
  
  // Adjust time filters for demo cycle
  if (body.filters?.timeRange) {
    body.filters.timeRange.start = mapToSeedTimestamp(
      new Date(body.filters.timeRange.start)
    ).toISOString();
    body.filters.timeRange.end = mapToSeedTimestamp(
      new Date(body.filters.timeRange.end)
    ).toISOString();
  }
  
  // Forward to real API
  const modifiedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(body),
  });
  
  return fetch('https://actual-api-endpoint', modifiedRequest);
}
```

**Tests:**
- [ ] Query traces from "yesterday" (real time) → returns data from day 6 of seed
- [ ] Query traces from "2 weeks ago" → returns data from day 0 of seed (2 weeks % 7 = 0)
- [ ] Featured runs always accessible regardless of current date
- [ ] Background agent traces appear in "recent" queries

---

## Phase 6: Infrastructure Setup (Free Tier Stack)

**Duration:** 4-6 hours  
**Deliverables:** Neon DB, Upstash Redis, Cloudflare Workers/Pages configured

### 6.1: Neon (Postgres)

**Steps:**
1. Sign up at neon.tech (free tier: 500MB, 0.5GB RAM)
2. Create project: `foxhound-demo`
3. Create database: `foxhound_demo_prod`
4. Run migrations:
   ```bash
   export DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/foxhound_demo_prod?sslmode=require"
   pnpm --filter @foxhound/db migrate
   ```
5. Load seed data:
   ```bash
   psql $DATABASE_URL < data/seed-week.sql
   ```
6. Save connection string to GitHub Secrets: `NEON_DATABASE_URL`

**Tests:**
- [ ] Connect via `psql $DATABASE_URL`
- [ ] Query: `SELECT COUNT(*) FROM traces;` → expect ~175 rows (7 days * 25)
- [ ] Query featured run: `SELECT * FROM traces WHERE session_id = 'cost-disaster-...';`

### 6.2: Upstash (Redis)

**Steps:**
1. Sign up at upstash.com (free tier: 10K commands/day)
2. Create database: `foxhound-demo`
3. Copy connection URL (format: `rediss://default:xxx@region.upstash.io:6379`)
4. Save to GitHub Secrets: `UPSTASH_REDIS_URL`

**Tests:**
- [ ] Connect via `redis-cli --tls -u $UPSTASH_REDIS_URL`
- [ ] `PING` → `PONG`
- [ ] `SET test_key test_value` → `OK`
- [ ] `GET test_key` → `test_value`

### 6.3: Cloudflare Workers (API)

**Create `infra/wrangler.toml`:**
```toml
name = "foxhound-demo-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.kv_namespaces]]
binding = "DEMO_KV"
id = "xxx"

[env.production.secrets]
DATABASE_URL = "..."  # Set via `wrangler secret put DATABASE_URL`
REDIS_URL = "..."
```

**Worker code: `infra/src/index.ts`:**
```typescript
import { Hono } from 'hono';
import { mapToSeedTimestamp } from './demo-data-mapper';

const app = new Hono();

// Proxy to Foxhound API with timestamp adjustment
app.all('/api/*', async (c) => {
  const body = await c.req.json();
  
  // Adjust timestamps for rolling window
  if (body.filters?.timeRange) {
    body.filters.timeRange.start = mapToSeedTimestamp(
      new Date(body.filters.timeRange.start)
    ).toISOString();
    body.filters.timeRange.end = mapToSeedTimestamp(
      new Date(body.filters.timeRange.end)
    ).toISOString();
  }
  
  // Forward to Neon + Upstash backed API
  // (or run Fastify API directly in Worker if possible)
  
  return c.json({ /* response */ });
});

export default app;
```

**Deploy:**
```bash
cd infra
wrangler deploy --env production
```

**Tests:**
- [ ] `curl https://foxhound-demo-api.workers.dev/api/health` → 200 OK
- [ ] Query traces endpoint → returns data
- [ ] Verify timestamp mapping works (query "yesterday" returns seed data)

### 6.4: Cloudflare Pages (Frontend)

**Deploy Next.js app:**
```bash
cd apps/demo-web
pnpm build
wrangler pages deploy .next --project-name foxhound-demo
```

**Custom domain:**
1. Add CNAME record: `demo.foxhound.caleb-love.com` → `foxhound-demo.pages.dev`
2. Wait for SSL cert provisioning (~5min)

**Tests:**
- [ ] Visit `https://demo.foxhound.caleb-love.com` → see problem picker
- [ ] Click featured run → loads data from Cloudflare Worker API
- [ ] Check network tab: API calls going to Worker, not local

---

## Phase 7: Testing & Quality Assurance

**Duration:** 6-8 hours  
**Deliverables:** Test suite, QA checklist, bug fixes

### 7.1: Unit Tests

**Packages to test:**
- `packages/seeder/` — verify scenario generators produce valid data
- `packages/background-agent/` — verify trace generation logic
- `packages/onboarding/` — component tests for ProblemPicker
- `apps/demo-web/` — rolling window mapper tests

**Example test: `packages/seeder/__tests__/cost-disaster.test.ts`:**
```typescript
import { generateCostDisaster } from '../src/scenarios/cost-disaster';

describe('Cost Disaster Scenario', () => {
  it('generates 40K loop traces', async () => {
    const startDate = new Date('2026-04-01');
    const result = await generateCostDisaster(startDate);
    
    expect(result.featuredRunId).toContain('cost-disaster');
    expect(result.title).toBe('The $1,200 Runaway Loop');
    
    // Verify traces in DB
    const traces = await db.query.traces.findMany({
      where: eq(traces.sessionId, result.featuredRunId),
    });
    
    expect(traces.length).toBeGreaterThan(100); // At least 100 iterations
  });
  
  it('creates cost budget alert', async () => {
    const startDate = new Date('2026-04-01');
    const result = await generateCostDisaster(startDate);
    
    const budgets = await db.query.budgets.findMany({
      where: eq(budgets.agentId, 'support-agent-v1'),
    });
    
    expect(budgets[0].amountUsd).toBe(50.0);
    expect(budgets[0].breachedAt).toBeTruthy();
  });
});
```

**Run tests:**
```bash
pnpm test
```

### 7.2: Integration Tests

**Test the full flow:**
```typescript
describe('Demo E2E', () => {
  it('problem picker routes to featured run', async () => {
    // Visit homepage
    const page = await browser.newPage();
    await page.goto('https://demo.foxhound.caleb-love.com');
    
    // Click "My agent ran up a huge bill"
    await page.click('text=My agent ran up a huge bill');
    
    // Verify navigation to trace explorer
    await page.waitForSelector('[data-testid="trace-explorer"]');
    
    // Verify Session Replay UI loaded
    const traceTitle = await page.textContent('h1');
    expect(traceTitle).toContain('customer_support_query');
  });
  
  it('rolling window maps timestamps correctly', async () => {
    const response = await fetch(
      'https://foxhound-demo-api.workers.dev/api/traces?start=2026-04-20&end=2026-04-21'
    );
    const data = await response.json();
    
    // Verify returned traces have timestamps within seed week (April 1-7)
    data.traces.forEach(trace => {
      const timestamp = new Date(trace.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(
        new Date('2026-04-01').getTime()
      );
      expect(timestamp.getTime()).toBeLessThan(
        new Date('2026-04-08').getTime()
      );
    });
  });
});
```

### 7.3: QA Checklist

**Manual testing:**
- [ ] **Homepage (Problem Picker)**
  - [ ] All 5 problem cards visible and clickable
  - [ ] Responsive (mobile, tablet, desktop)
  - [ ] Icons and descriptions clear
- [ ] **Featured Run: Cost Disaster**
  - [ ] Session Replay UI loads
  - [ ] Can expand/collapse spans
  - [ ] Trace tree shows 40K iterations (or 100 in seed)
  - [ ] Cost budget alert visible
  - [ ] Total cost displayed: $1,247.83
- [ ] **Featured Run: Quality Regression**
  - [ ] Run Diff UI loads
  - [ ] Side-by-side comparison visible
  - [ ] Success rates shown: 94% vs 64%
  - [ ] Diff highlights prompt change
- [ ] **Featured Run: SLA Breach**
  - [ ] SLA dashboard loads
  - [ ] P95 latency chart shows spike
  - [ ] Alert timeline visible
  - [ ] Breach notification displayed
- [ ] **Featured Run: Experiment**
  - [ ] Experiment comparison loads
  - [ ] Score distributions visible
  - [ ] Cost breakdown: GPT-4 vs Claude
  - [ ] Winner clearly indicated
- [ ] **Dashboard Overview**
  - [ ] Multiple agents visible
  - [ ] Recent runs displayed
  - [ ] Alerts panel populated
  - [ ] Charts render correctly
- [ ] **Background Activity**
  - [ ] "Recent" filter shows traces from last 30min
  - [ ] Background agent traces appear in trace list
  - [ ] Timestamps are realistic (not all clustered)
- [ ] **Rolling Window**
  - [ ] Query "yesterday" returns data
  - [ ] Query "last week" returns data
  - [ ] Query "2 weeks ago" returns data (wrapped around)
  - [ ] Featured runs always accessible
- [ ] **Performance**
  - [ ] Page load <2s
  - [ ] API responses <500ms
  - [ ] No console errors
  - [ ] No 404s or failed requests

### 7.4: Bug Triage & Fixes

**Common issues to check:**
- [ ] Timestamp timezone mismatches (UTC vs local)
- [ ] Featured run IDs not matching between seed and metadata
- [ ] Rolling window off-by-one errors
- [ ] Cloudflare Worker cold start latency
- [ ] Missing environment variables
- [ ] CORS issues between Pages and Worker

**Fix workflow:**
1. Create issue for each bug
2. Fix in feature branch
3. Add regression test
4. PR → merge → redeploy

---

## Phase 8: Documentation & Handoff

**Duration:** 3-4 hours  
**Deliverables:** README, architecture docs, maintenance guide

### 8.1: Repository README

**`README.md`:**
```markdown
# Foxhound Demo

Fully functional Foxhound demo accessible at [demo.foxhound.caleb-love.com](https://demo.foxhound.caleb-love.com).

## What is this?

A zero-friction demo of Foxhound — no signup, no install, just click and explore. Showcases Session Replay, Run Diff, Cost Budgets, SLA Monitoring, and Experiments through curated "featured runs."

## Architecture

- **Data:** Immutable 7-day seed (hand-crafted featured runs) + ephemeral live layer (background agent)
- **Rolling window:** Real time maps to 7-day cycle, featured runs always accessible
- **Stack:** Neon (Postgres) + Upstash (Redis) + Cloudflare Workers (API) + Pages (Frontend)
- **Cost:** $0/month (free tiers) + ~$1-2/month OpenAI usage

## Local Development

```bash
git clone https://github.com/caleb-love/foxhound-demo.git
cd foxhound-demo
pnpm install
docker-compose up
```

Visit `localhost:3000` to see the demo.

## Regenerating Seed Data

```bash
pnpm --filter seeder seed
pg_dump -h localhost -U demo foxhound_demo --data-only > data/seed-week.sql
git add data/seed-week.sql
git commit -m "chore: regenerate seed data"
```

## Deployment

Automatic via GitHub Actions. Push to `main` triggers deploy to Cloudflare.

Manual deploy:
```bash
cd infra && wrangler deploy --env production
cd apps/demo-web && wrangler pages deploy .next
```

## Updating Featured Runs

1. Edit scenario in `packages/seeder/src/scenarios/`
2. Run `pnpm --filter seeder seed`
3. Export updated SQL
4. Redeploy
```

### 8.2: Architecture Documentation

**`docs/architecture.md`:**
```markdown
# Foxhound Demo Architecture

## Overview

The demo is a **time-shifted mirror** of a real Foxhound instance. A 7-day dataset is pre-generated and committed to the repo. As real time progresses, the "now" pointer rotates through this week. Background agent adds ephemeral noise.

## Components

### 1. Data Seeder
- Generates 7 days of realistic trace data
- Includes 4-5 "featured runs" (hand-crafted stories)
- Outputs `data/seed-week.sql` (committed to repo)

### 2. Background Agent
- Runs every 30min via GitHub Actions
- Generates 3-5 new traces per run
- Uses gpt-4o-mini (~$0.05/day)
- Adds realistic "live" feel without overwriting featured runs

### 3. Rolling Window Mapper
- Maps real timestamps to positions in 7-day cycle
- Example: April 20 → April 6 (day 5 of cycle)
- Implemented as middleware in Cloudflare Worker

### 4. Frontend
- Next.js app deployed to Cloudflare Pages
- Imports UI components from main Foxhound repo
- Problem picker routes to featured runs

### 5. API
- Cloudflare Worker proxies requests
- Adjusts timestamps for rolling window
- Backed by Neon (Postgres) + Upstash (Redis)

## Data Flow

```
User visits demo.foxhound.caleb-love.com
  ↓
Problem picker (Cloudflare Pages)
  ↓
Click "My agent ran up a huge bill"
  ↓
Navigate to /traces/cost-disaster-123
  ↓
Trace Explorer UI (React component from Foxhound repo)
  ↓
Fetch trace data from API
  ↓
Cloudflare Worker receives request
  ↓
Adjust timestamp filters (real date → seed cycle position)
  ↓
Query Neon database
  ↓
Return featured run data
  ↓
Render Session Replay UI
```

## Cost Breakdown

| Component | Provider | Plan | Cost |
|-----------|----------|------|------|
| Database | Neon | Free | $0 |
| Cache | Upstash | Free | $0 |
| API | Cloudflare Workers | Free | $0 |
| Frontend | Cloudflare Pages | Free | $0 |
| Background Agent | GitHub Actions | Free | $0 |
| LLM Usage | OpenAI | Pay-as-you-go | ~$1-2/mo |

**Total: ~$1-2/month**
```

### 8.3: Maintenance Guide

**`docs/DEPLOYMENT.md`:**
```markdown
# Deployment & Maintenance

## Monitoring

**Check background agent:**
```bash
gh run list --workflow=background-agent.yml --limit 10
```

**Check OpenAI usage:**
```bash
curl https://api.openai.com/v1/usage \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Check Cloudflare metrics:**
Visit [Cloudflare dashboard](https://dash.cloudflare.com) → Workers → foxhound-demo-api

## Troubleshooting

**Background agent failing:**
1. Check GitHub Actions logs
2. Verify secrets are set: `gh secret list`
3. Test locally: `pnpm --filter background-agent run generate`

**Demo not loading:**
1. Check Cloudflare Pages deployment: `wrangler pages deployment list`
2. Check API health: `curl https://foxhound-demo-api.workers.dev/health`
3. Check Neon status: `psql $NEON_DATABASE_URL -c "SELECT 1"`

**Featured runs not appearing:**
1. Verify seed data loaded: `psql $NEON_DATABASE_URL -c "SELECT COUNT(*) FROM traces"`
2. Check seed metadata: `cat data/seed-metadata.json`
3. Re-seed if needed: `psql $NEON_DATABASE_URL < data/seed-week.sql`

## Updating the Demo

**Add a new featured run:**
1. Create scenario in `packages/seeder/src/scenarios/new-scenario.ts`
2. Update `packages/seeder/src/index.ts` to call new scenario
3. Run `pnpm --filter seeder seed`
4. Export: `pg_dump ... > data/seed-week.sql`
5. Update `data/seed-metadata.json` with new run metadata
6. Update `packages/onboarding/src/ProblemPicker.tsx` to add new card
7. Commit and push

**Update Foxhound UI components:**
Demo imports from main Foxhound repo. To pull latest UI:
1. Update Foxhound dependency: `pnpm update @foxhound/web`
2. Test locally
3. Deploy

**Rotate OpenAI API key:**
```bash
gh secret set OPENAI_API_KEY
# Paste new key when prompted
```
```

---

## Phase 9: Launch & Promotion

**Duration:** 2-3 hours  
**Deliverables:** Demo live, linked from main site, announced

### 9.1: Add Demo Link to Main Site

**Update `foxhound-web` (marketing site):**
```typescript
// Hero CTA
<Button href="https://demo.foxhound.caleb-love.com">
  Try Demo →
</Button>

// Navigation
<nav>
  <a href="/">Home</a>
  <a href="/docs">Docs</a>
  <a href="https://demo.foxhound.caleb-love.com">Demo</a>
  <a href="https://github.com/caleb-love/foxhound">GitHub</a>
</nav>
```

### 9.2: README Badge

**Add to main Foxhound repo README:**
```markdown
[![Try Demo](https://img.shields.io/badge/Try-Demo-blue)](https://demo.foxhound.caleb-love.com)
```

### 9.3: Social Announcement

**Twitter/X post:**
```
Tired of guessing why your agent broke?

Try the new Foxhound interactive demo:
→ See a $1,200 runaway loop caught by Session Replay
→ Diff two agent versions side-by-side
→ Watch SLA breaches in real-time

No signup. Just click and explore.

https://demo.foxhound.caleb-love.com
```

**LinkedIn post:**
```
Launching Foxhound's interactive demo 🦊

If you're building AI agents, you've probably experienced:
• Runaway loops that cost thousands
• Quality drops after "minor" prompt changes
• Agents that suddenly get slow

We built Foxhound to solve these. Now you can try it without installing anything.

Click through 4 real scenarios (with generated data):
1. Session Replay of a $1,200 cost disaster
2. Run Diff showing a quality regression
3. SLA monitoring catching a latency spike
4. Experiment comparing GPT-4 vs Claude

Zero friction. Zero signup. Just see it work.

Try it: https://demo.foxhound.caleb-love.com
```

### 9.4: Launch Checklist

**Pre-launch:**
- [ ] All featured runs load correctly
- [ ] Background agent running (check last 3 runs successful)
- [ ] Mobile responsive
- [ ] Performance: Lighthouse score >90
- [ ] SEO: meta tags, OG image, sitemap
- [ ] Analytics: Plausible or PostHog installed

**Launch day:**
- [ ] Deploy to production
- [ ] Smoke test all featured runs
- [ ] Post to Twitter/X
- [ ] Post to LinkedIn
- [ ] Share in relevant Slack/Discord communities
- [ ] Update main site with demo link
- [ ] Add badge to GitHub README

**Post-launch monitoring (first week):**
- [ ] Check analytics daily (visitors, popular paths)
- [ ] Monitor error rates in Cloudflare dashboard
- [ ] Watch OpenAI usage (should stay <$2/month)
- [ ] Collect feedback (add feedback button in demo?)

---

## Phase 10: Ongoing Maintenance

**Duration:** ~1 hour/month  
**Deliverables:** Demo stays fresh and functional

### 10.1: Monthly Tasks

**First Monday of each month:**
1. Check background agent health (verify last 50 runs successful)
2. Review OpenAI usage (should be <$2/month)
3. Check Cloudflare metrics (request count, error rate)
4. Test all featured runs (smoke test)
5. Update dependencies: `pnpm update --latest`

### 10.2: Quarterly Tasks

**Every 3 months:**
1. Regenerate seed data (refresh with latest schema)
2. Add a new featured run (keep it fresh)
3. Review and prune outdated background agent traces
4. Check for Foxhound UI component updates
5. Refresh OG image and screenshots

### 10.3: Emergency Procedures

**If demo goes down:**
1. Check Cloudflare status page
2. Check Neon status page
3. Check Upstash status page
4. Review GitHub Actions logs
5. Check for schema drift (did Foxhound repo schema change?)

**Rollback procedure:**
```bash
# Revert to last known good deploy
wrangler pages deployment list
wrangler pages deployment rollback <deployment-id>
```

---

## Success Metrics

**Week 1:**
- [ ] 100+ unique visitors
- [ ] <5% error rate
- [ ] All featured runs clicked at least once

**Month 1:**
- [ ] 500+ unique visitors
- [ ] 3+ inbound links/mentions
- [ ] 10+ GitHub stars from demo traffic

**Month 3:**
- [ ] 2,000+ unique visitors
- [ ] Featured on a newsletter or blog
- [ ] 50+ GitHub stars from demo traffic

---

## Open Questions & Decisions Needed

### 1. Foxhound Package References ✅ DECIDED
**Decision:** Use published npm packages (`@foxhound-ai/*`, `@foxhound/*`)
- Foxhound packages are already published to npm
- Use standard npm dependencies in `package.json`
- For local development: use `pnpm link` if needed

**Example `package.json`:**
```json
{
  "dependencies": {
    "@foxhound/db": "^0.2.0",
    "@foxhound-ai/sdk": "^0.2.0",
    "@foxhound/api-client": "^0.2.0"
  }
}
```

### 2. UI Component Strategy ✅ DECIDED
**Decision:** Import UI components directly from main Foxhound repo
- Assumes Foxhound repo exports UI components as npm packages or has an internal package for shared components
- Demo stays in sync with main product automatically
- No code duplication

**Implementation:**
```typescript
// apps/demo-web/src/app/[...catchall]/page.tsx
import { TraceExplorer } from '@foxhound/web-components/trace-explorer';
import { RunDiff } from '@foxhound/web-components/run-diff';
import { Dashboard } from '@foxhound/web-components/dashboard';
// etc.
```

**Note:** If Foxhound UI components aren't currently exported as importable packages, add a `packages/web-components/` package to the main Foxhound repo first. This benefits both the main app and the demo.

### 3. Background Agent Complexity ✅ DECIDED
**Decision:** Option B — Somewhat realistic
- Generate varied support queries and code review scenarios
- Realistic timing (not all clustered at exact 30-min intervals — add jitter)
- Realistic token counts and costs
- Mix of successful runs, occasional errors, varied latencies

**Not needed for launch:**
- Multi-turn conversations
- Complex user behavior simulation
- Contextual awareness between runs

**Implementation approach:**
```typescript
// Varied queries, not just random picks
const scenarios = [
  { type: 'password_reset', avgTokens: 80, avgLatency: 1200 },
  { type: 'account_locked', avgTokens: 120, avgLatency: 1800 },
  { type: 'billing_update', avgTokens: 150, avgLatency: 2200 },
];

// Add realistic variance
const actualTokens = scenario.avgTokens + (Math.random() * 40 - 20);
const actualLatency = scenario.avgLatency + (Math.random() * 600 - 300);
```

### 4. Demo Feedback Loop
**Decision needed:** Should users be able to provide feedback in the demo?
- **Option A:** No feedback mechanism (just explore)
- **Option B:** Simple feedback button (thumbs up/down + optional comment)
- **Option C:** Full survey at end of session

**Recommendation:** Option B (low friction, captures sentiment without interrupting flow).

### 5. Lead Capture
**Decision needed:** Should we collect emails for "interested in self-hosting" follow-up?
- **Option A:** No email capture (pure demo, zero friction)
- **Option B:** Optional email at end ("Want updates on Foxhound?")
- **Option C:** Required email to access demo

**Recommendation:** Option A for launch (maximize reach), Option B after validating demo quality.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Free tier limits exceeded | Low | Medium | Monitor usage, add spend alerts, upgrade if needed |
| Background agent costs spike | Low | Low | Cap OpenAI usage, use gpt-4o-mini only |
| Seed data becomes stale | Medium | Low | Monthly refresh task, automated schema migration detection |
| Featured runs broken by schema change | Medium | High | Integration tests, CI checks before Foxhound deploys |
| Demo used for malicious purposes | Low | Medium | Rate limiting, no user-generated content, read-only data |
| Cloudflare free tier changes | Low | High | Have backup plan (Railway, Vercel), export data regularly |

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 1. Repository Setup | 2-3 hours | None |
| 2. Data Seeder | 8-12 hours | Phase 1 |
| 3. Background Agent | 4-6 hours | Phase 1 |
| 4. Onboarding UI | 6-8 hours | Phase 1, Phase 2 |
| 5. Rolling Window | 4-6 hours | Phase 2 |
| 6. Infrastructure | 4-6 hours | Phase 2, Phase 5 |
| 7. Testing & QA | 6-8 hours | All previous phases |
| 8. Documentation | 3-4 hours | Phase 7 |
| 9. Launch | 2-3 hours | Phase 8 |
| 10. Maintenance | 1 hour/month | Ongoing |

**Total upfront: 39-56 hours**  
**Ongoing: ~1 hour/month**

**With AI assistance (Claude/gstack):**
- Code generation: ~40% faster
- Documentation: ~60% faster
- Testing: ~30% faster

**Realistic timeline with AI:** 25-35 hours upfront

---

## Next Steps

1. **Review this plan** — confirm architecture decisions
2. **Create `foxhound-demo` repository**
3. **Start with Phase 1** — repository setup and docker-compose
4. **Validate each phase** — don't move forward until tests pass
5. **Ship incrementally** — deploy to staging after Phase 6, production after Phase 9

**Ready to start building?**
