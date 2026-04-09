# Phase 2: Evaluation Engine — Implementation Spec

**Date:** 2026-04-10
**Phase:** 2 of 6 (Strategic Roadmap)
**Goal:** Close the single biggest feature gap. Keep it trace-first — don't clone Langfuse.

---

## Overview

Four components, built in dependency order:

1. **Scores** — attach numeric/categorical scores to traces and spans
2. **SDK Scoring** — namespaced `fox.scores.create()` in Python + TypeScript
3. **LLM-as-a-Judge** — evaluator templates + async worker execution via BullMQ
4. **Annotation Queues** — human review workflows with claim/submit semantics

---

## 1. Scores Data Model

### Schema (`packages/db/src/schema.ts`)

```sql
scores:
  id TEXT PK                          -- "scr_${uuid}"
  org_id TEXT NOT NULL FK organizations(id) ON DELETE CASCADE
  trace_id TEXT NOT NULL FK traces(id) ON DELETE CASCADE
  span_id TEXT                        -- nullable, references spans(trace_id, id) logically
  name TEXT NOT NULL                  -- e.g. "helpfulness", "correctness"
  value DOUBLE PRECISION              -- 0.0-1.0 numeric (nullable for categorical-only)
  label TEXT                          -- categorical: "correct" | "incorrect" | "partial"
  source TEXT NOT NULL                -- "manual" | "llm_judge" | "sdk" | "user_feedback"
  comment TEXT
  user_id TEXT FK users(id)           -- NULL for system/SDK scores
  created_at TIMESTAMP DEFAULT NOW()
```

**Indexes:** `(org_id, name, created_at)`, `(trace_id)`, `(org_id, source)`

### API Routes (`apps/api/src/routes/scores.ts`)

| Method                      | Path                                                           | Description            |
| --------------------------- | -------------------------------------------------------------- | ---------------------- |
| `POST /v1/scores`           | Create a score                                                 | Returns 201            |
| `GET /v1/scores`            | Query scores (filterable by trace_id, name, source, min_value) | Returns paginated list |
| `GET /v1/traces/:id/scores` | Get all scores for a trace                                     | Returns array          |
| `DELETE /v1/scores/:id`     | Delete a score                                                 | Returns 204            |

### Shared Types (`packages/types/src/index.ts`)

```typescript
export type ScoreSource = "manual" | "llm_judge" | "sdk" | "user_feedback";

export interface Score {
  id: string;
  orgId: string;
  traceId: string;
  spanId?: string;
  name: string;
  value?: number;
  label?: string;
  source: ScoreSource;
  comment?: string;
  userId?: string;
  createdAt: string;
}
```

---

## 2. SDK Scoring

### Pattern: Namespaced sub-clients

This is the first namespaced API surface. Introduces a pattern that `datasets`, `prompts`, etc. will follow.

### TypeScript (`packages/sdk/src/client.ts`)

```typescript
// Access via: fox.scores.create({ ... })
class ScoresNamespace {
  constructor(private client: FoxhoundClient) {}

  async create(params: {
    traceId: string;
    spanId?: string;
    name: string;
    value?: number;
    label?: string;
    source?: ScoreSource;
    comment?: string;
  }): Promise<Score> { ... }
}
```

### Python (`packages/sdk-py/foxhound/client.py`)

```python
# Access via: fox.scores.create(trace_id=..., name=..., value=1.0)
class ScoresNamespace:
    def __init__(self, client: FoxhoundClient): ...
    async def create(self, *, trace_id: str, name: str, ...) -> dict: ...
    def create_sync(self, *, trace_id: str, name: str, ...) -> dict: ...
```

---

## 3. LLM-as-a-Judge (Evaluators)

### Schema

```sql
evaluators:
  id TEXT PK                          -- "evl_${uuid}"
  org_id TEXT NOT NULL FK organizations(id) ON DELETE CASCADE
  name TEXT NOT NULL
  prompt_template TEXT NOT NULL       -- Mustache-style: "Rate the {{output}} for helpfulness..."
  model TEXT NOT NULL                 -- "gpt-4o", "claude-sonnet-4-20250514", etc.
  scoring_type TEXT NOT NULL          -- "numeric" | "categorical"
  labels TEXT[]                       -- for categorical: ["correct", "incorrect", "partial"]
  enabled BOOLEAN DEFAULT TRUE
  created_at TIMESTAMP DEFAULT NOW()

evaluator_runs:
  id TEXT PK                          -- "evr_${uuid}"
  evaluator_id TEXT NOT NULL FK evaluators(id) ON DELETE CASCADE
  trace_id TEXT NOT NULL FK traces(id) ON DELETE CASCADE
  score_id TEXT FK scores(id)         -- resulting score, set on completion
  status TEXT NOT NULL                -- "pending" | "running" | "completed" | "failed"
  error TEXT
  created_at TIMESTAMP DEFAULT NOW()
  completed_at TIMESTAMP
```

**Indexes on evaluators:** `(org_id)`, `(org_id, name)`
**Indexes on evaluator_runs:** `(evaluator_id, status)`, `(trace_id)`

### API Routes (`apps/api/src/routes/evaluators.ts`)

| Method                       | Path                      | Description            |
| ---------------------------- | ------------------------- | ---------------------- |
| `POST /v1/evaluators`        | Create evaluator template | Returns 201            |
| `GET /v1/evaluators`         | List evaluators for org   | Returns paginated list |
| `GET /v1/evaluators/:id`     | Get evaluator by ID       | Returns evaluator      |
| `PATCH /v1/evaluators/:id`   | Update evaluator          | Returns updated        |
| `DELETE /v1/evaluators/:id`  | Delete evaluator          | Returns 204            |
| `POST /v1/evaluator-runs`    | Trigger batch evaluation  | Returns 202 + run IDs  |
| `GET /v1/evaluator-runs/:id` | Check run status          | Returns run with score |

### Worker Architecture (`apps/worker/`)

- **Separate Node.js process** consuming BullMQ jobs from Redis
- Queue: `evaluator-runs` with concurrency 10
- Each job processes one evaluator run (one trace)
- Token-bucket rate limiter per LLM provider
- 5-minute timeout per job, max 3 retries
- Dead-letter queue for persistent failures
- On completion: creates score in DB, updates evaluator_run status
- On failure: updates evaluator_run status + error, does NOT discard partial results

### Dependencies

- `bullmq` — job queue (Redis-backed)
- `ioredis` — Redis client (BullMQ peer dep)
- Redis connection via `REDIS_URL` env var

---

## 4. Annotation Queues

### Schema

```sql
annotation_queues:
  id TEXT PK                          -- "anq_${uuid}"
  org_id TEXT NOT NULL FK organizations(id) ON DELETE CASCADE
  name TEXT NOT NULL
  description TEXT
  score_configs JSONB DEFAULT '[]'    -- [{name: "helpfulness", type: "numeric"}, ...]
  created_at TIMESTAMP DEFAULT NOW()

annotation_queue_items:
  id TEXT PK                          -- "aqi_${uuid}"
  queue_id TEXT NOT NULL FK annotation_queues(id) ON DELETE CASCADE
  trace_id TEXT NOT NULL FK traces(id) ON DELETE CASCADE
  status TEXT NOT NULL DEFAULT 'pending' -- "pending" | "completed" | "skipped"
  assigned_to TEXT FK users(id)
  completed_at TIMESTAMP
  created_at TIMESTAMP DEFAULT NOW()
```

**Indexes on annotation_queues:** `(org_id)`
**Indexes on annotation_queue_items:** `(queue_id, status)`, `(trace_id)`

### API Routes (`apps/api/src/routes/annotations.ts`)

| Method                                       | Path                    | Description            |
| -------------------------------------------- | ----------------------- | ---------------------- |
| `POST /v1/annotation-queues`                 | Create queue            | Returns 201            |
| `GET /v1/annotation-queues`                  | List queues for org     | Returns list           |
| `GET /v1/annotation-queues/:id`              | Get queue with stats    | Returns queue + counts |
| `DELETE /v1/annotation-queues/:id`           | Delete queue            | Returns 204            |
| `POST /v1/annotation-queues/:id/items`       | Add traces to queue     | Returns 201            |
| `POST /v1/annotation-queues/:id/claim`       | Claim next pending item | Returns item or 204    |
| `POST /v1/annotation-queue-items/:id/submit` | Submit scores for item  | Returns 200            |
| `POST /v1/annotation-queue-items/:id/skip`   | Skip item               | Returns 200            |

---

## Entitlements

- **Scores:** Available on all plans (no gate — critical for adoption)
- **LLM-as-a-Judge (evaluators):** Gated to Pro+ via `canEvaluate` entitlement (consumes LLM tokens)
- **Annotation Queues:** Available on all plans (human review, no LLM cost)

Add to `packages/billing/src/entitlements.ts`:

```typescript
canEvaluate: boolean; // false for free, true for pro/team/enterprise
```

---

## File Changes Summary

### New files

- `apps/api/src/routes/scores.ts`
- `apps/api/src/routes/evaluators.ts`
- `apps/api/src/routes/annotations.ts`
- `apps/worker/` (new package: `package.json`, `tsconfig.json`, `src/index.ts`, `src/queues/evaluator.ts`)

### Modified files

- `packages/db/src/schema.ts` — add 5 tables
- `packages/db/src/queries.ts` — add score/evaluator/annotation queries
- `packages/db/src/index.ts` — re-export new queries
- `packages/types/src/index.ts` — add Score, Evaluator, AnnotationQueue types
- `packages/sdk/src/client.ts` — add ScoresNamespace
- `packages/sdk-py/foxhound/client.py` — add ScoresNamespace
- `packages/api-client/src/index.ts` — add score/evaluator/annotation methods
- `packages/api-client/src/types.ts` — add response types
- `packages/billing/src/entitlements.ts` — add canEvaluate
- `apps/api/src/index.ts` — register new routes
- `apps/api/package.json` — add bullmq, ioredis deps (for queue connection shared with worker)

---

## Success Criteria

1. Scores attachable to any trace or span via API and SDK
2. LLM-as-a-Judge runs against trace batches via async worker
3. Annotation queues enable human review workflows with claim/submit
4. Worker process runs independently from API server
5. `pnpm build` passes, `pnpm lint` passes, `pnpm test` passes
