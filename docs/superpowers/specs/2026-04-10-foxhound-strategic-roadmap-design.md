# Foxhound Strategic Roadmap: From Agent Observability to Category Leader

**Date:** 2026-04-10
**Status:** Final — reviewed by 4 independent agents (architecture, simplicity, competitive, performance)

---

## Executive Summary

Foxhound is an open-source, self-hosted observability platform for AI agent fleets with differentiated capabilities (Session Replay, Run Diff, alerting, MCP server) that no competitor matches. This roadmap turns Foxhound into the definitive agent fleet management platform through 6 focused phases over ~14 weeks.

**The thesis:** The market is moving from "LLM call logging" to "agent fleet management." Foxhound is already built for the destination. This roadmap fills the critical gaps (cloud, evaluation, scaling) while deepening the agent-native moat.

**Positioning:** "LLM observability built for agents" — ride the existing search intent, graduate to category ownership with traction.

---

## Review Summary

This roadmap was independently reviewed from 4 perspectives:

| Reviewer                    | Key Findings                                                                                                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture Strategist** | Normalize spans out of JSONB (critical debt). Prompt version labels need join table not array. SDK needs namespacing (`fox.scores.create()`). Evaluator workers must be separate process.          |
| **Simplicity Reviewer**     | Cloud must be Phase 2 not Phase 5. Cut Grafana plugin, migration tools, multi-provider notifications. SSO/SAML is premature. The "eval from traces" concept is genuinely good if kept simple.      |
| **Competitive Strategist**  | $49/mo pricing is no-man's land — go $29 or $99. MCP is a real but insufficient distribution channel. Pick developers over enterprise. Skip migration tools (signals "follower").                  |
| **Performance Oracle**      | JSONB spans is O(n\*m) at scale — normalize immediately. Never dual-write synchronously to ClickHouse — use CDC/async relay. Micro-batch trace ingestion. Separate worker service for experiments. |

All feedback has been incorporated below.

---

## Phase 0: Schema Foundation (Week 1)

**Goal:** Fix the single biggest technical debt before building anything new.

### 0.1 Normalize Spans Into Their Own Table

**Why (unanimous reviewer feedback):** The `traces.spans` JSONB column stores all spans as a blob. Every new feature — scoring, experiments, behavior regression, Run Diff — needs to query individual spans. JSONB makes span-level queries O(n \* m) with no indexing. The `span_id` FK on the proposed `scores` table would reference data buried inside JSONB with no integrity guarantee.

**Implementation:**

```sql
spans table:
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  parent_span_id TEXT REFERENCES spans(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,  -- tool_call | llm_call | agent_step | workflow | custom
  status TEXT NOT NULL DEFAULT 'ok',
  start_time_ms BIGINT NOT NULL,
  end_time_ms BIGINT,
  attributes JSONB DEFAULT '{}',
  events JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
```

**Indexes:** `(org_id, kind)`, `(org_id, start_time_ms)`, `(trace_id)`, `(parent_span_id)`

**Migration strategy:**

- Add new `spans` table (additive, zero risk)
- Dual-read: new queries use `spans` table, legacy fallback to JSONB
- Background backfill job: extract existing JSONB spans into the new table
- Once backfill complete, drop the JSONB column in a later migration
- **Files:** `packages/db/src/schema.ts`, new migration, `apps/api/src/routes/traces.ts`

### 0.2 Data Retention & Sampling

**Implementation:**

- Add `retention_days` (default 90) and `sampling_rate` (default 1.0) to `organizations`
- Cleanup cron: `DELETE FROM spans WHERE created_at < org.retention_cutoff` (partitioned by month)
- Server-side sampling: if `Math.random() > org.samplingRate`, return 202 but don't persist
- **Always bypass sampling for error traces** (status = error) — losing errors defeats observability
- Client-side sampling in SDKs with `X-Foxhound-Sampled` header for analytics weighting
- **Files:** `packages/db/src/schema.ts`, trace ingestion route, SDK clients

### 0.3 Micro-Batch Trace Ingestion

**Why (performance review):** At 50 traces/sec burst, individual INSERTs exhaust the connection pool.

**Implementation:**

- Buffer incoming traces in memory, flush every 100ms or 50 traces (whichever first)
- Single `INSERT ... VALUES` with multiple rows per flush (50x fewer round trips)
- Configure Drizzle pool to 20-30 connections explicitly
- **Files:** `apps/api/src/routes/traces.ts`

### Success Criteria

- Spans are a first-class table with proper indexes
- Existing JSONB spans fully backfilled
- Retention policies configurable per-org
- Sampling works at client and server level with error bypass
- Trace ingestion handles 50/sec burst without pool exhaustion

---

## Phase 1: Cloud Platform Launch (Weeks 2-4)

**Goal:** Remove the #1 growth ceiling. Every week without cloud is a week without user feedback.

### 1.1 Cloud Infrastructure

**Implementation:**

- Deploy API server on Fly.io (start simple — migrate to Kubernetes only when needed)
- Managed PostgreSQL via Neon (serverless scaling, no ops burden)
- Cloudflare for CDN and DDoS protection
- Redis via Upstash (serverless, pay-per-use) for rate limiting and future job queues
- **No ClickHouse yet** — PostgreSQL with normalized spans handles moderate scale. Add ClickHouse in Phase 4 when data demands it.
- **Files:** New `infrastructure/` directory, Dockerfile, fly.toml

### 1.2 Billing Activation

**Pricing (adjusted per competitive review):**

| Plan           | Price     | Included         | Retention | Users                |
| -------------- | --------- | ---------------- | --------- | -------------------- |
| **Free**       | $0        | 100K spans/month | 30 days   | Unlimited            |
| **Pro**        | $29/month | 1M spans/month   | 1 year    | Unlimited            |
| **Team**       | $99/month | 5M spans/month   | 2 years   | Unlimited            |
| **Enterprise** | Custom    | Custom           | Custom    | Unlimited + SSO/SAML |

**Key decisions:**

- **$29/mo Pro** matches Langfuse Core, undercuts LangSmith ($39/seat), signals value not cheapness
- **$99/mo Team** fills the gap between Pro and Enterprise
- **Unlimited users on all tiers** — competitive advantage over LangSmith's per-seat model
- **No feature gates on Free** — every product feature available, volume-limited only
- Overage: $5 per 100K additional spans (cheaper than Langfuse's $8)

**Implementation:**

- Uncomment billing routes in `apps/api/src/index.ts`
- Activate Stripe Checkout + Billing Portal
- Activate metering cron in `packages/billing/src/metering.ts`
- Usage dashboard: `GET /v1/billing/usage`
- **Files:** `apps/api/src/index.ts`, `apps/api/src/routes/billing.ts`, `packages/billing/`

### 1.3 Onboarding Flow

**Implementation:**

- Sign up → create org → get API key → copy-paste SDK snippet → see first trace
- Target: **first trace in under 2 minutes**
- `foxhound init` CLI command: auto-detects framework (LangGraph, CrewAI, etc.), generates instrumentation boilerplate
- Public demo instance at `demo.foxhound.dev` — prospects see the UI without deploying
- **Files:** CLI command extension, cloud onboarding routes

### Success Criteria

- Cloud live and accepting signups
- Stripe billing working (upgrade/downgrade/cancel)
- Onboarding achieves first trace in <2 minutes
- Public demo instance accessible

---

## Phase 2: Evaluation Engine (Weeks 4-7)

**Goal:** Close the single biggest feature gap. Keep it trace-first — don't clone Langfuse.

### 2.1 Scores Data Model

**Schema:**

```sql
scores table:
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  trace_id TEXT NOT NULL REFERENCES traces(id),
  span_id TEXT REFERENCES spans(id),
  name TEXT NOT NULL,  -- e.g. "helpfulness", "correctness"
  value DOUBLE PRECISION,  -- 0.0-1.0 numeric
  label TEXT,  -- categorical: "correct" | "incorrect" | "partial"
  source TEXT NOT NULL,  -- "manual" | "llm_judge" | "sdk" | "user_feedback"
  comment TEXT,
  user_id TEXT REFERENCES users(id),  -- NULL for system scores
  created_at TIMESTAMP DEFAULT NOW()
```

**Indexes:** `(org_id, name, created_at)`, `(trace_id, span_id)`, `(org_id, source)`

**API (follows existing REST patterns):**

- `POST /v1/scores` — create
- `GET /v1/scores?trace_id=&name=&min_value=` — query
- `GET /v1/traces/:id/scores` — scores for a trace

### 2.2 SDK Scoring (Namespaced)

**Per architecture review — namespace all new methods:**

```python
# Python
fox.scores.create(trace_id=t.id, name="user_satisfaction", value=1.0, source="user_feedback")

# TypeScript
fox.scores.create({ traceId: t.id, name: "user_satisfaction", value: 1.0, source: "user_feedback" })
```

**Files:** `packages/sdk-py/foxhound/client.py`, `packages/sdk/src/client.ts`

### 2.3 LLM-as-a-Judge

**Schema:**

```sql
evaluators table:
  id, org_id, name, prompt_template, model, scoring_type (numeric|categorical),
  labels TEXT[],  -- with GIN index for categorical filtering
  enabled, created_at

evaluator_runs table:
  id, evaluator_id, trace_id, score_id (FK to resulting score),
  status (pending|completed|failed), error, created_at, completed_at
```

**API (per architecture review — no RPC verbs):**

- `POST /v1/evaluators` — create evaluator template
- `POST /v1/evaluator-runs` — trigger runs with `{evaluator_id, trace_ids[]}`
- `GET /v1/evaluator-runs/:id` — check status

**Worker architecture (per performance review):**

- Create `apps/worker/` — separate Node.js process consuming BullMQ jobs
- Evaluation queue with concurrency 10-20, token-bucket rate limiter per LLM provider
- Batch size capped at 100 traces per job, 5-minute timeout, max 3 retries
- Dead-letter queue for persistent failures
- Partial results stored — a failed batch doesn't discard completed evaluations
- **Files:** New `apps/worker/` service, BullMQ configuration, Redis connection

### 2.4 Annotation Queue

**Schema:**

```sql
annotation_queues: id, org_id, name, score_configs (jsonb), created_at
annotation_queue_items: id, queue_id, trace_id, status (pending|completed|skipped), assigned_to, completed_at
```

**API:** CRUD for queues, add/remove traces, claim next item, submit scores.

### Success Criteria

- Scores attachable to any trace or span
- LLM-as-a-Judge runs against trace batches via async worker
- Annotation queues enable human review workflows
- Worker process runs independently from API server

---

## Phase 3: Datasets & Experiments (Weeks 6-9)

**Goal:** The "eval from traces" differentiator — production failures become test cases automatically.

### 3.1 Datasets

**Schema:**

```sql
datasets: id, org_id, name, description, created_at
dataset_items: id, dataset_id, input (jsonb), expected_output (jsonb),
  metadata (jsonb), source_trace_id (nullable FK), created_at
```

**The killer feature — auto-curation from traces:**

- `POST /v1/datasets/:id/items/from-traces` with filters
- "Add all traces where helpfulness < 0.5 from last 7 days"
- Extracts input/output from span data, preserves trace lineage
- CLI: `foxhound datasets add-traces --dataset my-evals --filter "score:helpfulness<0.5" --since 7d`

### 3.2 Experiments

**Schema:**

```sql
experiments: id, org_id, dataset_id, name, config (jsonb), status, created_at, completed_at
experiment_runs: id, experiment_id, dataset_item_id, output (jsonb), latency_ms, token_count, cost, created_at
```

**Implementation:**

- `POST /v1/experiments` — enqueues async job on worker
- `GET /v1/experiment-comparisons?experiment_ids=exp1,exp2` — side-by-side results (per architecture review — dedicated resource, not RPC)
- Auto-score experiment runs using configured evaluators
- Worker handles execution — never blocks API server

### Success Criteria

- Datasets populated from production traces (the differentiator)
- Experiments run prompt variants with auto-scoring
- Side-by-side comparison via dedicated API resource
- Full lineage: trace → dataset item → experiment run → score

---

## Phase 4: Agent-Native Intelligence (Weeks 8-11)

**Goal:** Deepen the agent-first advantage with capabilities no competitor has.

### 4.1 Agent Cost Budgets

**Implementation:**

- `agent_configs` table: `id, org_id, agent_id, cost_budget_usd, cost_alert_threshold_pct, created_at`
- Built-in model pricing table (GPT-4, Claude, Gemini, etc. — updatable)
- Track cumulative cost per agent run from LLM call spans
- New alert type: `cost_budget_exceeded`
- SDK callback: `on_budget_exceeded` — application decides to kill or continue

### 4.2 Agent SLA Monitoring

**Implementation:**

- `agent_slas` table: `id, org_id, agent_id, max_duration_ms, min_success_rate, evaluation_window, created_at`
- Background job (on worker process) evaluates SLAs periodically
- New alert types: `sla_duration_breach`, `sla_success_rate_breach`

### 4.3 Behavior Regression Detection

**Implementation:**

- Compare span tree structure between agent versions
- Track decision distribution: "agent v2 calls tool X 40% less than v1"
- New alert type: `behavior_regression`
- Builds on Run Diff — extends from manual to automated monitoring

### 4.4 Multi-Agent Coordination

**Implementation:**

- Add `parent_agent_id` and `correlation_id` to traces
- `GET /v1/traces/coordination/:correlation_id` — full multi-agent graph
- MCP tool: `foxhound_get_coordination_graph`

### 4.5 ClickHouse Analytical Backend (If Needed)

**Decision point:** Evaluate whether PostgreSQL with normalized spans handles cloud traffic. If trace queries are degrading:

- Add ClickHouse via **async CDC relay** (per performance review — never synchronous dual-write)
- Write to Postgres on hot path → BullMQ job → ClickHouse insert
- Eventually consistent but safe — ClickHouse failures don't block ingestion
- Migrate trace search and score aggregation queries to ClickHouse first
- CRUD operations stay on Postgres

**Only proceed if Postgres latency exceeds 200ms on p95 trace queries at current volume.**

### Success Criteria

- Agent cost budgets configurable and enforced
- SLA monitoring with automated alerting
- Behavior regression detection across agent versions
- Multi-agent workflows visualized

---

## Phase 5: Developer Experience & Distribution (Weeks 10-12)

**Goal:** Make Foxhound the easiest to adopt and hardest to leave.

### 5.1 MCP Server Enhancement

**New tools:**

- `foxhound_explain_failure` — AI analyzes span tree, explains why agent failed
- `foxhound_suggest_fix` — given a failing trace, suggests prompt/tool changes
- `foxhound_score_trace` — score a trace from the IDE
- `foxhound_run_evaluator` — trigger evaluator from IDE
- `foxhound_add_to_dataset` — add trace to dataset from IDE

**Publish to MCP registries** (Claude Code, VS Code, JetBrains)

### 5.2 GitHub Actions Quality Gate

- `foxhound-ai/quality-gate-action` GitHub Action
- Runs evaluators against dataset, fails if scores drop below threshold
- Posts score comparison as PR comment
- **Files:** New `.github/actions/quality-gate/` directory

### 5.3 Framework Integration Expansion

**Priority (based on market momentum):**

1. Pydantic AI — rapidly growing, strong typing
2. Mastra — TypeScript-native agents
3. Amazon Bedrock AgentCore — enterprise AWS
4. Google ADK — Google's agent framework

Follow existing patterns in `packages/sdk-py/foxhound/integrations/`.

### 5.4 Documentation Site

- Docusaurus at docs.foxhound.dev
- Per-framework getting started guides
- API reference (auto-generated from Zod schemas)
- SDK reference (Python + TypeScript)
- Evaluation cookbook
- SDK swap guides (not data migration — per competitive review)
- **Files:** New `docs-site/` directory

### Success Criteria

- MCP server with AI debugging tools in registries
- GitHub Action quality gate working
- 4 new framework integrations
- Documentation site live

---

## Phase 6: Prompt Management & Growth (Weeks 12-14)

**Goal:** Add lightweight prompt management and build community momentum.

### 6.1 Prompt Registry

**Schema:**

```sql
prompts: id, org_id, name, created_at
prompt_versions: id, prompt_id, version (int), content, model, config (jsonb), created_at, created_by
prompt_labels: id, prompt_version_id, label TEXT, created_at  -- join table per architecture review
```

**Note:** Labels are a join table (not text array) to avoid race conditions when promoting labels between versions.

**SDK:**

```python
prompt = fox.prompts.get(name="support-agent", label="production")  # cached client-side, 5min TTL
```

**Trace linking:** SDK auto-attaches `prompt_name` and `prompt_version` to trace metadata.

### 6.2 Community Launch

- GitHub Discussions enabled (searchable, per competitive review)
- Discord for real-time help
- Public changelog / build log (ship in public)
- "Foxhound + [framework]" tutorial content for SEO
- Respond to every GitHub issue within 24 hours
- **No newsletter or showcase yet** — premature at this stage

### Success Criteria

- Prompt versions stored and retrievable via SDK with caching
- Traces linked to prompt versions
- Community channels active
- GitHub issue response time <24h

---

## What Was Cut (And Why)

| Feature                                                  | Reason                                                                                 | Revisit When                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------- |
| Grafana data source plugin                               | <1% of users, high maintenance burden                                                  | Users explicitly request it      |
| Migration tools (Langfuse/LangSmith importers)           | Signals "follower"; nobody migrates old traces                                         | After 1K+ GitHub stars           |
| Multi-provider notifications (PagerDuty, GitHub, Linear) | Each is separate OAuth + API contract. Webhooks suffice — users connect via Zapier/n8n | Enterprise customers request it  |
| OTel Collector exporter                                  | Niche; OTel ingestion (already built) is the important direction                       | Cloud users request it           |
| SSO/SAML marketing                                       | Already built but premature to sell. Keep code, don't market it                        | Enterprise sales pipeline exists |
| Prompt Playground (cloud)                                | Significant frontend work in foxhound-web; prompts API is enough for v1                | After prompt adoption data       |

---

## Architecture Evolution

### Current

```
PostgreSQL (everything, spans as JSONB) → Fastify API → SDKs/CLI/MCP
```

### After Phase 0

```
PostgreSQL (normalized spans table) → Fastify API → SDKs/CLI/MCP
```

### After Phase 2

```
PostgreSQL (normalized) → Fastify API → SDKs/CLI/MCP
                        → Worker (BullMQ/Redis) → Evaluator/Experiment jobs
```

### After Phase 4 (if needed)

```
PostgreSQL (auth, config) → Fastify API → SDKs/CLI/MCP
          ↓ CDC relay                   → Worker → Eval/Experiment jobs
ClickHouse (traces, spans, scores — analytical queries)
```

---

## Phase Dependency Map

```
Phase 0 (Schema Foundation) ──→ Phase 1 (Cloud Launch)
                                       ↓
                               Phase 2 (Evaluation) ──→ Phase 3 (Datasets/Experiments)
                                       ↓
                               Phase 4 (Agent Intelligence) ──→ Phase 5 (DX/Distribution)
                                                                       ↓
                                                               Phase 6 (Prompts/Growth)
```

**Parallelism:** Phase 4 can overlap with Phase 3 (different schema domains). Phases 5-6 are sequential.

---

## Risk Register

| Risk                                 | Impact   | Mitigation                                                                                               |
| ------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------- |
| JSONB→spans migration corrupts data  | Critical | Dual-read during backfill; never drop JSONB until backfill verified                                      |
| Cloud security incident              | Critical | Security audit before launch; rate limiting; input validation                                            |
| Eval engine scope creep              | High     | Keep it trace-first. MVP is: mark trace, re-run inputs, diff outputs. No custom metrics until users ask. |
| Langfuse ships agent-native features | High     | Move fast on Phase 4. First-mover advantage in agent-native is the moat.                                 |
| PostgreSQL can't handle cloud scale  | Medium   | Normalized spans + micro-batching buys time. ClickHouse is Phase 4.5 escape hatch.                       |
| Community doesn't materialize        | Medium   | DX first, community follows. Great developer experience > community marketing.                           |

---

## 6-Month Success Metrics

| Metric                            | Target      | Why                     |
| --------------------------------- | ----------- | ----------------------- |
| GitHub stars                      | 2,000+      | Community health signal |
| Monthly SDK installs (PyPI + npm) | 50K+        | Adoption velocity       |
| Cloud signups                     | 500+        | Product-market fit      |
| Paying customers                  | 25+         | Revenue viability       |
| Framework integrations            | 10+         | Ecosystem breadth       |
| Time to first trace (new user)    | < 2 minutes | Onboarding quality      |
| Eval scores created               | 100K+/month | Eval adoption           |
| p95 trace query latency           | < 200ms     | Performance SLA         |

---

## Competitive Position After Execution

| Capability                      | Foxhound      | Langfuse  | LangSmith  | Braintrust |
| ------------------------------- | ------------- | --------- | ---------- | ---------- |
| Agent-first architecture        | **Native**    | Bolted on | Bolted on  | No         |
| Session Replay                  | **Yes**       | No        | No         | No         |
| Run Diff                        | **Yes**       | No        | No         | No         |
| Agent cost budgets              | **Yes**       | No        | No         | No         |
| Agent SLA monitoring            | **Yes**       | No        | No         | No         |
| Behavior regression             | **Yes**       | No        | No         | No         |
| Eval from traces (auto-dataset) | **Unique**    | Manual    | Manual     | Manual     |
| LLM-as-a-Judge                  | Yes           | Yes       | Yes        | Yes        |
| Prompt management               | Lightweight   | Full      | Full       | No         |
| CI/CD quality gate              | Yes           | No        | No         | **Best**   |
| Cloud offering                  | Yes           | Yes       | Yes        | Yes        |
| Self-hosted                     | Yes           | Yes       | Enterprise | No         |
| MCP server                      | **Native**    | No        | No         | No         |
| MIT license                     | Yes           | Yes       | No         | Partial    |
| Pro price                       | **$29/mo**    | $29/mo    | $39/seat   | $249/mo    |
| Unlimited users                 | **All tiers** | Paid only | No         | Yes        |
