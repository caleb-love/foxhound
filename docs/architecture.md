# Foxhound Architecture

This document captures the durable architecture of Foxhound in two views:

1. **Current state** — what exists in the repository today
2. **Future state** — the target architecture Foxhound should evolve toward as product scale, customer requirements, and telemetry volume increase

It is intentionally opinionated about boundaries, data ownership, and migration triggers so future implementation work can stay aligned.

> For the shortest cold start into the repo, read [`docs/overview/start-here.md`](overview/start-here.md).
>
> For current project status, see [`docs/overview/project-overview.md`](overview/project-overview.md).
>
> For architectural rationale and historical decisions, see [`docs/reference/architecture-decisions.md`](reference/architecture-decisions.md).

---

## 1. Executive Summary

Foxhound is a **compliance-grade observability platform for AI agent fleets**.

Today, the system is built as a **TypeScript/Node.js monorepo** with:
- **Fastify API** for ingestion, auth, product APIs, and orchestration
- **PostgreSQL 16 (Neon)** as the primary system of record
- **Redis (Upstash) + BullMQ** for asynchronous job execution and scheduled processing
- **Worker service** for evaluators, experiments, cost monitoring, SLA checks, and regression detection
- **Typed SDKs, API client, CLI, and MCP server** as the main external integration surfaces
- **Fly.io** as the primary application runtime platform

This is the correct architecture for Foxhound’s current stage because it optimizes for:
- fast product iteration
- strong multi-tenant correctness
- relational integrity
- operational simplicity
- low infrastructure overhead
- clear product/API boundaries

However, Foxhound has **two distinct data workloads**:

1. **Operational / product data (OLTP)**
2. **High-volume telemetry and analytics data (append-heavy / OLAP-like)**

Postgres is a strong fit for the first workload and an acceptable fit for the second workload early on. As telemetry volume grows, Foxhound should preserve Postgres as the business system of record while introducing a dedicated analytical/event store such as **ClickHouse** for large-scale trace, span, and event analytics.

---

## 2. Architecture Goals

The architecture should continue to optimize for the following goals:

### Product goals
- Ingest traces and spans from AI agents with minimal SDK friction
- Support replay, debugging, diffing, scoring, datasets, experiments, cost controls, SLA monitoring, and regressions
- Expose these capabilities through API, SDK, CLI, MCP server, and CI surfaces

### Platform goals
- Maintain strict **multi-tenant isolation**
- Preserve auditability and compliance posture
- Support asynchronous and eventually consistent workflows where appropriate
- Keep current-state operations simple enough for a small team
- Allow clean migration from a Postgres-centric architecture to a mixed operational + analytical architecture

### Engineering goals
- Clear ownership boundaries between API, worker, and storage layers
- Stable contracts between packages
- Additive schema evolution and safe migrations
- Minimal duplication across SDK and client surfaces

---

## 3. Current State Architecture

## 3.1 Monorepo shape

Foxhound is organized as a pnpm workspace + Turborepo monorepo.

### Applications
- `apps/api` — Fastify REST API
- `apps/worker` — BullMQ worker service

### Shared packages
- `packages/db` — Drizzle schema, migrations, queries, DB client
- `packages/api-client` — typed API client
- `packages/sdk` — TypeScript SDK
- `packages/sdk-py` — Python SDK (primary in docs where ordering matters)
- `packages/cli` — CLI
- `packages/mcp-server` — MCP debugging tools
- `packages/billing` — billing and usage logic
- `packages/notifications` — notification delivery integrations
- `packages/types` — shared types

### Documentation
- `docs/` — internal architecture, plans, state, roadmap
- `docs-site/` — public Docusaurus documentation

---

## 3.2 Runtime topology

Current runtime is a small set of cooperating services:

```text
SDKs / CLI / MCP / GitHub Actions / Dashboard
                |
                v
           Fastify API
                |
     +----------+----------+
     |                     |
     v                     v
 PostgreSQL            Redis/BullMQ
   (Neon)                 queues
     |                     |
     +----------+----------+
                |
                v
             Worker
```

### Current responsibilities

#### API (`apps/api`)
Owns:
- authentication and authorization
- API key validation and tenant resolution
- OTLP/HTTP ingestion
- product CRUD surfaces
- rate limiting and request validation
- queueing async work
- retention cleanup scheduling

#### Worker (`apps/worker`)
Owns:
- evaluator execution
- experiment runs
- cost monitoring and reconciliation
- SLA scheduling and checks
- regression detection
- other asynchronous or repeatable workloads

#### Postgres (`packages/db`)
Owns:
- tenant-scoped product state
- trace and span persistence
- metadata, configs, billing state, prompts, datasets, scores, and audit data

#### Redis/BullMQ
Owns:
- async queue transport
- retry coordination
- scheduled repeatable jobs
- buffering between request-time orchestration and background work

---

## 3.3 Ingestion flow today

The primary ingestion surface is OTLP/HTTP JSON via `POST /v1/traces/otlp`.

### Current observed behavior
From `apps/api/src/routes/otlp.ts`:
- request body is validated with Zod against OTLP JSON shape
- spans are mapped into Foxhound trace/span structures
- org-level span limit checks are enforced
- server-side sampling can drop non-error traces probabilistically
- requests return `202 Accepted`
- traces are buffered for micro-batch persistence

### Current ingestion pipeline

```text
Client SDK / OTel exporter
        |
        v
POST /v1/traces/otlp
        |
        v
Validate + map OTel -> Foxhound model
        |
        v
Check org billing/span limits
        |
        v
Apply server-side sampling
        |
        v
Buffer traces for micro-batch persistence
        |
        v
Persist traces + normalized spans in Postgres
```

### Why this is good today
This design keeps ingestion:
- simple
- synchronous only where necessary
- resilient to short bursts via buffering
- easy to reason about in a single primary datastore

### Known long-term pressure point
As telemetry volume grows, the expensive part will not be acceptance or mapping — it will be:
- storing large telemetry volumes in Postgres
- indexing large append-heavy span tables
- running wide aggregate queries over trace/span history

---

## 3.4 Data model today

Foxhound currently uses Postgres for both product state and observability data.

### Core operational entities
Observed in `packages/db/src/schema.ts`:
- `organizations`
- `users`
- `memberships`
- `api_keys`
- billing, notification, evaluator, dataset, prompt, and related product tables

### Core observability entities
Observed in `packages/db/src/schema.ts`:
- `traces`
- `spans`
- `audit_events`
- `admin_audit_log`
- `usage_records`
- additional product-supporting telemetry and scoring tables later in the schema

### Important current modeling choices
- **Every tenant-scoped table uses `org_id`**
- traces store both top-level trace fields and a `spans` JSONB payload
- spans are also normalized into a dedicated `spans` table
- query-oriented fields are indexed with tenant-aware patterns such as:
  - `(org_id, created_at)`
  - `(org_id, kind)`
  - `(org_id, start_time_ms)`
  - correlation and trace lookup indexes

### Architectural interpretation
This is a pragmatic hybrid model:
- **JSONB** preserves flexible raw-ish payload structure
- **normalized tables** preserve queryability and product features

This is the right compromise for current-stage product development.

---

## 3.5 Queue and job architecture today

Current queue names visible in `apps/api/src/queue.ts` and worker startup code include:
- `evaluator-runs`
- `experiment-runs`
- `cost-monitor`
- `sla-scheduler`
- `regression-detector`
- cost reconciler repeatable queue
- SLA check worker queue

### Current queueing pattern
- API attempts to enqueue work if Redis is configured
- worker consumes named queues with explicit concurrency
- repeatable jobs are registered on startup for recurring processing

### Why this is good today
This architecture cleanly separates:
- request-time API latency
- background compute and third-party calls
- scheduled policy enforcement

It also allows Foxhound to remain usable in reduced environments where some async infrastructure may be missing, with degraded behavior instead of a hard platform dependency in every local/self-hosted mode.

---

## 3.6 Security and tenancy model today

Foxhound is explicitly multi-tenant and security-sensitive.

### Current invariants
Across repo guidance and schema patterns:
- every DB query must be scoped by `org_id`
- `UPDATE` and `DELETE` operations must include tenant scope
- background jobs must carry tenant context explicitly
- API key and JWT routes have different trust boundaries
- untrusted content is rendered as plain text unless explicitly sanitized

### Architectural consequence
Tenant isolation is not an optional application-layer concern. It is a **first-class architecture rule** that must shape:
- schema design
- query design
- queue payloads
- analytics pipelines
- future storage migrations

Any future-state architecture that introduces a second datastore must preserve this same tenancy rule with equal rigor.

---

## 4. Current State: Why the Database Choices Are Correct

Foxhound’s current stack is:
- **PostgreSQL (Neon)**
- **Drizzle ORM**
- **Redis (Upstash)**
- **BullMQ**

For current product stage, this is the right choice.

### Why Postgres is correct today
Postgres is excellent for:
- organizations, users, memberships, and API keys
- billing and entitlements
- prompts, datasets, evaluators, experiment metadata
- audit logs and compliance-related metadata
- product dashboards requiring relational joins and consistency
- strong multi-tenant guarantees

### Why Drizzle is correct today
Drizzle gives:
- typed schema ownership in the monorepo
- explicit migration discipline
- low magic relative to heavier ORMs
- direct visibility into SQL and indexes

### Why Redis + BullMQ are correct today
They fit Foxhound’s current async workload well:
- evaluator execution
- experiment orchestration
- cost and SLA jobs
- regression processing
- retries and repeat scheduling

### Where the current database choice becomes strained
The likely pain is **not** on product tables first. It is on high-volume telemetry and analytics:
- very large span/event retention windows
- heavy aggregate queries across many organizations or long time ranges
- dashboard queries that scan huge append-only datasets
- replay/diff analytics over large historical windows
- rising storage and indexing costs for telemetry tables

That is a scaling boundary, not evidence that the current architecture was a mistake.

---

## 5. Current State Risks and Boundaries

## 5.1 Strengths of current state
- Small-team operable
- Strong transactional integrity
- Simple mental model
- High iteration speed
- Good fit for current roadmap phases
- Durable tenant-scoping discipline

## 5.2 Risks if Foxhound scales on Postgres-only telemetry
If Foxhound keeps all high-volume telemetry in Postgres indefinitely, likely issues include:
- large partition/index management burden
- slower aggregate queries over spans/events
- rising cost for storage and write amplification
- contention between ingest-heavy writes and analytics/product reads
- harder retention and downsampling strategies
- reduced flexibility for advanced analytics features

## 5.3 What will probably break first
The likely first pain points are:
1. dashboard and analytics query latency
2. storage/index cost for spans and events
3. retention-management complexity
4. operational coupling between ingestion load and product responsiveness

---

## 6. Future State Architecture

Foxhound should evolve toward a **split architecture** that keeps operational truth in Postgres while moving high-volume telemetry analytics into a dedicated analytical system.

## 6.1 Future-state high-level topology

```text
SDKs / CLI / MCP / GitHub Actions / Dashboard
                |
                v
           API Gateway / Fastify API
                |
      +---------+----------+----------------+
      |                    |                |
      v                    v                v
  PostgreSQL         Redis / BullMQ    Object Storage
 (system of record)      queues        (raw artifacts,
                                         replay blobs,
                                       exports, payloads)
      |
      +-------------------+
                          |
                          v
                    Analytics Store
                     (ClickHouse)
```

---

## 6.2 Data ownership in the future state

### PostgreSQL should continue to own
- organizations, users, memberships, auth
- API keys and permissions
- billing state and entitlements
- prompts, evaluators, datasets, experiments metadata
- alert and notification configuration
- policy state
- audit logs requiring transactional semantics
- trace/run summary metadata used by core product workflows
- references to artifacts and analytical aggregates

### Redis/BullMQ should continue to own
- background job transport
- retries and backoff
- scheduler coordination
- transient orchestration state

### ClickHouse should own
- append-heavy telemetry events
- spans at larger scale
- high-cardinality analytical attributes
- cost/time/status aggregations over large windows
- trend, anomaly, and slice-and-dice queries over observability data
- long-window telemetry powering dashboards and reporting

### Object storage should own
- raw payload archives
- large replay artifacts
- exported reports
- large attachments or blobs that do not belong in Postgres rows
- optional raw event lake retention if later needed

---

## 6.3 Why ClickHouse is the likely next analytical store

ClickHouse becomes attractive when Foxhound starts seeing any of the following:
- aggregate queries over spans becoming slow or expensive
- need for longer telemetry retention at lower cost
- high-cardinality filtering on trace/span attributes
- need for fast product analytics over append-only telemetry
- a widening mismatch between OLTP and OLAP workloads in the same database

### Why it fits Foxhound’s likely future needs
Foxhound is not only storing traces for debugging. It is building product features on telemetry:
- Session Replay
- Run Diff
- eval-from-traces
- cost analysis
- SLA tracking
- behavior regression detection
- future prompt analytics and experimentation

These are analytics-heavy product capabilities. A columnar analytical store aligns well with that roadmap.

### Architectural principle
**Postgres remains the business system of record. ClickHouse becomes the telemetry analytics engine.**

This is not a replacement of Postgres. It is a workload split.

---

## 6.4 Future ingestion model

Foxhound should evolve from “ingest into Postgres-first” toward “ingest once, persist to the right stores for the right workloads.”

### Transitional target

```text
OTLP ingest
   |
   v
Validation + tenant resolution
   |
   +--> Postgres: trace/run summary + product-critical metadata
   |
   +--> ClickHouse: spans/events/analytics rows
   |
   +--> Object storage: optional raw payload / replay artifact archive
```

### Final desired property
A single trace should produce:
- a transactional product representation
- an analytical telemetry representation
- optional raw/archive representation

without forcing one database to do every job.

---

## 6.5 Future query model

### Product and control-plane queries
Should read from **Postgres**:
- org settings
- entitlements
- prompts
- evaluators
- datasets and experiment definitions
- API keys
- configuration panels and control surfaces

### Telemetry analytics queries
Should read from **ClickHouse**:
- time-window aggregates
- span/event search across large datasets
- high-volume dashboards
- regression trend analytics
- cost and latency rollups over large history

### Hybrid queries
Should be assembled at the application layer:
- load tenant/product config from Postgres
- load telemetry aggregate from ClickHouse
- join in API/service layer, not by cross-database SQL coupling

This preserves portability and keeps storage responsibilities clean.

---

## 7. Migration Strategy

Foxhound should not migrate all at once. The correct path is staged.

## 7.1 Stage 0 — Current state
- Postgres stores both product and telemetry data
- Redis/BullMQ handles async work
- API and worker continue current operating model

## 7.2 Stage 1 — Prepare for split without changing user behavior
Goals:
- separate product-read paths from raw telemetry-read paths in code
- stabilize telemetry event contracts
- ensure queue payloads carry explicit tenant context
- define canonical summary tables in Postgres

Recommended implementation direction:
- keep Postgres as current source of truth
- identify which queries are operational vs analytical
- avoid new product features depending directly on raw Postgres span scans where possible

## 7.3 Stage 2 — Introduce ClickHouse for selected analytical reads
Goals:
- dual-write or async replicate telemetry into ClickHouse
- move the heaviest dashboard queries first
- keep correctness-sensitive product flows on Postgres

Likely first candidates:
- high-volume span search
- cost/latency/time-series dashboards
- trend/regression rollups
- long-range comparisons

## 7.4 Stage 3 — Make ClickHouse primary for telemetry analytics
Goals:
- analytical dashboards use ClickHouse by default
- Postgres keeps summary metadata and product-critical references
- retention policies diverge by storage type

At this stage:
- Postgres stores concise trace/run summaries and control-plane state
- ClickHouse stores large-scale telemetry history
- object storage stores heavy blobs and raw archives

## 7.5 Stage 4 — Optimize storage economics and lifecycle
Goals:
- define hot/warm/cold data policies
- move older artifacts to lower-cost storage
- precompute common aggregates if needed
- align retention plans with pricing tiers and compliance needs

---

## 8. Decision Triggers for Adding ClickHouse

Foxhound should revisit the analytical-store decision when one or more of the following become true:

### Performance triggers
- large telemetry dashboards exceed acceptable response times
- aggregate queries over spans routinely require broad scans
- operator workflows degrade during ingestion spikes

### Cost triggers
- Postgres storage and indexing cost grow disproportionately to product value
- retention duration becomes too expensive in row-store form

### Product triggers
- customers need longer retention with fast querying
- prompt analytics / growth analytics materially increase telemetry workloads
- Session Replay / Run Diff / regression analysis require more historical depth

### Operational triggers
- write-heavy ingestion competes with product reads
- partition/index maintenance becomes a recurring tax
- query tuning for telemetry dominates database operations work

---

## 9. Non-Negotiable Architecture Rules

These rules apply in both current and future state.

### 9.1 Tenant scope is mandatory everywhere
- every row, event, artifact, and queue payload must remain tenant attributable
- `org_id` must remain explicit in operational and analytical paths
- no cross-org analytics paths by default

### 9.2 Product state and telemetry state are different classes of data
- product state needs stronger transactional guarantees
- telemetry state needs cheaper, faster analytical access at scale
- do not force one store to optimize equally for both forever

### 9.3 Asynchronous work must be idempotent and replay-safe
- queue retries must not corrupt tenant data
- background workers must tolerate restarts and duplicate delivery
- recurring jobs must be safe to rerun

### 9.4 Durable interfaces matter more than current implementation details
- SDK contracts, API payloads, and telemetry envelopes should remain stable
- storage internals can evolve behind those interfaces

### 9.5 Compliance posture must survive architecture evolution
- auditability cannot be an afterthought
- data retention, deletion, and access boundaries must remain explainable
- future storage additions must not weaken governance

---

## 10. Recommended Near-Term Architecture Work

These are recommended, not urgent, based on current repo state.

### High-value near-term work
1. **Maintain a clean split in code between control-plane reads and telemetry analytics reads**
2. **Document canonical data ownership by subsystem**
3. **Keep tenant scope explicit in every queue payload and ingestion path**
4. **Define which trace/run summaries must remain queryable in Postgres even after analytical split**
5. **Avoid making every new dashboard depend on raw Postgres span scans**

### Do not do yet unless pain is real
- premature full storage replatforming
- replacing Postgres as the primary system of record
- introducing cross-database coupling that makes correctness harder
- overbuilding data-lake complexity before retention/query pain justifies it

---

## 11. Practical Reference: Current vs Future State

| Concern | Current state | Future state |
|---|---|---|
| Primary system of record | Postgres | Postgres |
| Async orchestration | Redis + BullMQ | Redis + BullMQ |
| Telemetry storage | Mostly Postgres | ClickHouse + Postgres summaries |
| Large raw artifacts | Mostly DB-adjacent / evolving | Object storage |
| Product config and auth | Postgres | Postgres |
| Heavy analytics | Postgres for now | ClickHouse |
| Multi-tenant boundary | `org_id` in DB and app logic | `org_id` in every store and pipeline |
| Replay/debug/control plane | App + Postgres | App + Postgres summaries + analytics store |

---

## 12. Recommended Default Position

If someone asks, “Did we choose the right database architecture for Foxhound?” the durable answer is:

> **Yes for current stage.** Postgres + Drizzle + Neon + Redis/BullMQ is the right operational architecture for the product Foxhound is building today.
>
> **No as a forever-single-store strategy for telemetry analytics.** As Foxhound scales, keep Postgres as the business system of record and add ClickHouse for high-volume observability analytics once telemetry query, retention, or cost pressure justifies it.

That is the intended architecture direction unless a materially different product shape emerges.

---

## 13. References

- [`docs/overview/start-here.md`](overview/start-here.md)
- [`docs/overview/project-overview.md`](overview/project-overview.md)
- [`docs/reference/engineering-notes.md`](reference/engineering-notes.md)
- [`apps/api/src/index.ts`](../apps/api/src/index.ts)
- [`apps/api/src/routes/otlp.ts`](../apps/api/src/routes/otlp.ts)
- [`apps/api/src/queue.ts`](../apps/api/src/queue.ts)
- [`apps/worker/src/index.ts`](../apps/worker/src/index.ts)
- [`packages/db/src/schema.ts`](../packages/db/src/schema.ts)
