# Phase 4: Agent-Native Intelligence — Design Spec

**Date:** 2026-04-10
**Status:** Approved (revised after CTO + Principal Engineer review)
**Depends on:** Phases 0-3 (all merged to main)

---

## Summary

Phase 4 deepens Foxhound's agent-first moat with three capabilities no competitor offers: agent cost budgets, SLA monitoring, and behavior regression detection. These features turn Foxhound from an observability tool into an agent fleet management platform.

**Deferred to Phase 5:**
- Multi-agent coordination (no dashboard UI in foxhound-web yet, <10% of early users have multi-agent setups; the schema columns `parent_agent_id`/`correlation_id` are additive and can ship independently)
- ClickHouse (no production traffic data to measure)

---

## Review Incorporation Summary

This spec was reviewed by two independent agents (CTO, Principal Engineer). Key changes from their feedback:

| Change | Source | Rationale |
|--------|--------|-----------|
| Defer multi-agent coordination to Phase 5 | CTO | No UI to render DAG; premature for early users |
| Cut `onBudgetExceeded` SDK callback | CTO | Polling model is a footgun; use webhook notifications instead |
| Cut auto HTTP header propagation | Both | Monkey-patching HTTP clients is fragile; manual helper covers 95% of cases |
| Cut write MCP tools for configs | CTO | Read-only MCP is safe; config writes should go through API/dashboard |
| Simplify regression to structural drift only | Both | Frequency/duration drift with fixed thresholds produces false positives |
| Use `numeric(12,6)` for money, not `DOUBLE PRECISION` | Principal | Float accumulation errors in budget sums |
| Add `cost_usd` column to spans table | Principal | Can't SUM efficiently inside JSONB attributes |
| Merge `agent_configs` + `agent_slas` into one table | Principal | Same key, saves a hot-path DB lookup |
| Model pricing as JSON file + DB overrides | CTO | DB-only table is a maintenance nightmare for price updates |
| Redis running cost accumulator | Both | Per-trace SUM over growing dataset doesn't scale |
| SLA worker fan-out to individual jobs | Both | Single job processing all SLAs is a timebomb |
| Redis counters for SLA metrics | CTO | Avoid per-minute aggregate queries on traces table |
| Increase regression sample to 100 traces | Principal | 50 traces gives ~14% confidence interval — too noisy |
| Migrate `traces.startTimeMs` from TEXT to BIGINT | Both | Numeric operations for SLA/cost require proper types |
| All `/status` endpoints cache from worker runs | Principal | Avoid expensive on-demand aggregate queries |

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM cost source | Hybrid (SDK-reported preferred, JSON pricing file fallback, DB overrides) | SDK cost is most accurate; JSON file ships with releases; DB overrides for custom models |
| Entitlement gating | All features on all tiers | Matches "no feature gates, volume-limited only" philosophy |
| Regression trigger | Automatic on new version detection (structural drift only) | Most agent-native UX; structural drift has best signal-to-noise ratio |
| Worker architecture | Dedicated BullMQ queue per feature | Matches existing pattern; independent scaling/tuning |
| Money representation | `numeric(12,6)` in Postgres, integer microdollars in Redis | Eliminates float accumulation errors |
| Hot-path protection | In-memory cache (60s TTL) for configs + pricing; Redis for running totals | Zero additional DB reads on trace ingestion |
| Multi-agent coordination | Deferred to Phase 5 | No dashboard UI; schema columns are additive |

---

## Pre-Phase 4: Tech Debt Migration

Before Phase 4 implementation, migrate `traces.startTimeMs` and `traces.endTimeMs` from `TEXT` to `BIGINT`. This is load-bearing for SLA duration calculations and cost period queries — TEXT columns require CAST on every query, defeating index usage.

**Migration strategy:** Neon handles `ALTER TABLE ALTER COLUMN TYPE BIGINT USING start_time_ms::bigint` as an online operation for tables under 10M rows. Add a new migration file and update the Drizzle schema.

---

## Database Schema

### New Table

#### `agent_configs` — Unified per-agent configuration (budgets + SLAs)

```sql
agent_configs:
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  agent_id TEXT NOT NULL,

  -- Cost budget fields (all nullable — NULL means no budget configured)
  cost_budget_usd NUMERIC(12,6),
  cost_alert_threshold_pct INTEGER DEFAULT 80,
  budget_period TEXT DEFAULT 'monthly',          -- 'daily' | 'weekly' | 'monthly'

  -- SLA fields (all nullable — NULL means no SLA configured)
  max_duration_ms BIGINT,                        -- NULL = no duration SLA
  min_success_rate NUMERIC(5,4),                 -- NULL = no success rate SLA (0.0000-1.0000)
  evaluation_window_ms BIGINT DEFAULT 86400000,  -- 24h default
  min_sample_size INTEGER DEFAULT 10,            -- minimum traces before SLA evaluation

  -- Cached status from last worker run (avoids expensive on-demand queries)
  last_cost_status JSONB,                        -- { "status", "spend", "budget", "unknownCostPct", "checkedAt" }
  last_sla_status JSONB,                         -- { "compliant", "durationP95Ms", "successRate", "sampleSize", "checkedAt" }

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
  UNIQUE(org_id, agent_id)
```

**Indexes:** `(org_id, agent_id)` via unique constraint, `(org_id)` for list queries

#### `behavior_baselines` — Span structure snapshots per agent version

```sql
behavior_baselines:
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  agent_id TEXT NOT NULL,
  agent_version TEXT NOT NULL,
  sample_size INTEGER NOT NULL,
  span_structure JSONB NOT NULL,      -- { "tool_call:search": 0.4, "llm_call:summarize": 0.35, ... }
  created_at TIMESTAMP DEFAULT NOW()
  UNIQUE(org_id, agent_id, agent_version)
```

**Indexes:** `(org_id, agent_id, created_at)` for version ordering queries (semver is not sortable lexicographically — use `created_at DESC` to determine "previous version")

**Note on JSONB:** Unlike the Phase 0 spans-in-JSONB problem, baselines are small (typically <50 keys), read-heavy, write-once, and schema-flexible. Normalization is not warranted here.

#### `model_pricing_overrides` — Org-specific pricing overrides (DB table)

```sql
model_pricing_overrides:
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  provider TEXT NOT NULL,
  model_pattern TEXT NOT NULL,
  input_cost_per_token NUMERIC(18,12) NOT NULL,
  output_cost_per_token NUMERIC(18,12) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
  UNIQUE(org_id, provider, model_pattern)
```

Default pricing ships as a JSON file (`packages/db/src/data/model-pricing.json`) bundled with the API. Updated each release. DB overrides take precedence for the org that created them.

### Schema Modifications

**`traces` table:**
- Migrate `start_time_ms` from `TEXT` to `BIGINT`
- Migrate `end_time_ms` from `TEXT` to `BIGINT`
- Add `parent_agent_id TEXT` (nullable, for Phase 5 multi-agent coordination — additive, no cost to add now)
- Add `correlation_id TEXT` (nullable, same rationale)

**New indexes:**
- `(org_id, correlation_id) WHERE correlation_id IS NOT NULL` — partial index, only indexes traces with coordination
- `(org_id, agent_id, start_time_ms)` — SLA duration and budget period queries

**`spans` table:**
- Add `cost_usd NUMERIC(12,6)` column (nullable — NULL means cost unknown, distinct from 0)
- **Index:** `(org_id, cost_usd) WHERE kind = 'llm_call'` — partial index for budget sum queries

### Alert Event Types

Extend the existing alert event type enum with three new values:
- `cost_budget_exceeded` (replaces overlap with existing `cost_spike` — `cost_spike` remains for anomaly-based detection, `cost_budget_exceeded` is for explicit budget thresholds)
- `sla_duration_breach`
- `sla_success_rate_breach`
- `behavior_regression`

**Files requiring event type updates:** `packages/db/src/schema.ts`, `packages/notifications/src/types.ts`, `packages/notifications/src/providers/slack.ts`, `packages/notifications/src/providers/github.ts`, `packages/notifications/src/providers/linear.ts`, `packages/api-client/src/types.ts`, `packages/mcp-server/src/index.ts` (alert rule creation tool)

---

## Model Pricing Architecture

### Default Pricing (JSON file)

Ship `packages/db/src/data/model-pricing.json` with the repo:

```json
[
  { "provider": "openai", "modelPattern": "gpt-4o", "inputCostPerToken": 0.0000025, "outputCostPerToken": 0.00001 },
  { "provider": "openai", "modelPattern": "gpt-4o-mini", "inputCostPerToken": 0.00000015, "outputCostPerToken": 0.0000006 },
  { "provider": "anthropic", "modelPattern": "claude-sonnet-4", "inputCostPerToken": 0.000003, "outputCostPerToken": 0.000015 },
  ...
]
```

### Matching Algorithm

**Longest-prefix match.** When looking up pricing for model `gpt-4o-2024-08-06`:
1. Check org-specific DB overrides first (exact match on `model_pattern`)
2. Fall back to JSON file, sorted by `modelPattern` length descending
3. `gpt-4o-2024-08-06` matches `gpt-4o` via prefix
4. If no match found, `cost_usd` stays NULL (unknown cost, not zero)

### Caching

Load the full JSON file + org overrides into an in-memory Map on API/worker startup. Refresh every 60 seconds. The pricing dataset is small (~100 entries globally + handful of overrides per org).

---

## Feature 1: Agent Cost Budgets

### Cost Extraction (Hybrid, Async)

Cost extraction runs inside `setImmediate()` alongside `persistTraceWithRetry` — never on the hot path before the 202 response:

1. For each `llm_call` span:
   - If span attributes contain `cost_usd` (SDK-reported), write it to the `spans.cost_usd` column
   - Otherwise, extract `model` + `token_count_input`/`token_count_output` from attributes, look up in-memory pricing cache (longest-prefix match), compute cost, write to `spans.cost_usd`
   - If neither SDK cost nor token counts are available, `spans.cost_usd` stays NULL
2. After span persistence, increment Redis running total: `INCRBYFLOAT cost:{orgId}:{agentId}:{periodKey} {traceCostSum}` with TTL matching the period length

### Budget Check Flow

1. User configures budget via `PUT /v1/budgets/:agentId`
2. On trace ingestion, after cost extraction, compare Redis running total against threshold (in-memory cached config, no DB lookup)
3. If spend >= `cost_alert_threshold_pct` → enqueue `cost-monitor` job to fire alert (severity: high)
4. If spend >= 100% → enqueue `cost-monitor` job to fire alert (severity: critical)
5. Worker job fires alert via existing dispatcher, updates `last_cost_status` JSONB on `agent_configs`

### Budget Period Boundaries

- `daily`: `[00:00 UTC today, 00:00 UTC tomorrow)`
- `weekly`: `[Monday 00:00 UTC, next Monday 00:00 UTC)`
- `monthly`: `[1st 00:00 UTC, 1st of next month 00:00 UTC)`

Redis key format: `cost:{orgId}:{agentId}:2026-04-10` (daily), `cost:{orgId}:{agentId}:2026-W15` (weekly), `cost:{orgId}:{agentId}:2026-04` (monthly). The period key is derived from the **trace's timestamp**, not `NOW()`, to avoid boundary race conditions.

A reconciliation job runs every 5 minutes: recalculates the true sum from `spans.cost_usd` in Postgres and corrects the Redis counter if drift is detected.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/v1/budgets/:agentId` | Create/update budget config (returns 201 on create, 200 on update) |
| GET | `/v1/budgets` | List all budget configs for org (paginated: `page`, `limit`) |
| GET | `/v1/budgets/:agentId` | Get config + cached spend status |
| DELETE | `/v1/budgets/:agentId` | Remove budget config |

The `/status` data is embedded in the GET response via `last_cost_status` — no separate endpoint needed. Status includes `{ status: "under"|"warning"|"exceeded", spend, budget, unknownCostPct, checkedAt }`.

### SDK Surface

```python
# Python
fox.budgets.set(agent_id="support-bot", cost_budget_usd=50.0, alert_threshold_pct=80, period="monthly")
fox.budgets.get(agent_id="support-bot")
# → { "config": { ... }, "status": { "status": "warning", "spend": 42.50, "budget": 50.0, "unknownCostPct": 3.2 } }

fox.budgets.list()
fox.budgets.delete(agent_id="support-bot")
```

```typescript
// TypeScript
fox.budgets.set({ agentId: "support-bot", costBudgetUsd: 50, alertThresholdPct: 80, period: "monthly" })
fox.budgets.get("support-bot")
fox.budgets.list()
fox.budgets.delete("support-bot")
```

Budget-exceeded notifications go through the existing notification system (Slack, webhook, etc.). Users who want programmatic reaction use a webhook endpoint — no SDK polling callback needed.

### MCP Tool

- `foxhound_get_agent_budget` — returns budget config + current spend + status (read-only)

### Worker Queue

- **Queue name:** `cost-monitor`
- **Concurrency:** 10
- **Trigger:** Enqueued from ingestion path when Redis total crosses threshold
- **Retry:** 3 attempts with exponential backoff
- **Deduplication:** BullMQ `jobId: cost-alert:{orgId}:{agentId}:{periodKey}:{level}` prevents duplicate alerts for same threshold crossing

---

## Feature 2: Agent SLA Monitoring

### SLA Metrics Collection (Redis Counters)

On trace ingestion (inside `setImmediate()`), if the agent has an SLA config (checked via in-memory cache):
- Increment `sla:traces:{orgId}:{agentId}:{minuteBucket}` (total trace count)
- If any span has `status = 'error'`, increment `sla:errors:{orgId}:{agentId}:{minuteBucket}`
- Set `sla:duration:{orgId}:{agentId}:{minuteBucket}` via sorted set (ZADD with trace duration as score) for p95 computation
- All Redis keys have TTL of `evaluation_window_ms + 1 hour` (auto-cleanup)

### SLA Evaluation Flow (Fan-Out)

1. A lightweight recurring BullMQ scheduler job runs every 60 seconds
2. It queries all `agent_configs` where `max_duration_ms IS NOT NULL OR min_success_rate IS NOT NULL`
3. For each SLA, it enqueues an individual `sla-check` job: `{ slaId, orgId, agentId }`
4. Each `sla-check` job (deduplicated by `jobId: sla-check:{slaId}:{minute}`):
   - Reads Redis counters/sorted sets within `evaluation_window_ms`
   - If `sample_size < min_sample_size` → status = `"insufficient_data"`, no alert
   - **Duration check:** Compute p95 from sorted set. If p95 > `maxDurationMs` → `sla_duration_breach` alert
   - **Success rate check:** `1 - (errors / total)`. If rate < `minSuccessRate` → `sla_success_rate_breach` alert
5. Worker updates `last_sla_status` JSONB on `agent_configs`

### Alert Deduplication

Before firing, the worker checks `notification_log` for an existing entry with the same `(agent_id, event_type)` within the evaluation window. No new table needed.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/v1/slas/:agentId` | Create/update SLA config (returns 201/200) |
| GET | `/v1/slas` | List all SLA configs for org (paginated) |
| GET | `/v1/slas/:agentId` | Get SLA config + cached compliance status |
| DELETE | `/v1/slas/:agentId` | Remove SLA config |

Status is embedded via `last_sla_status`: `{ compliant: bool, durationP95Ms, successRate, sampleSize, status: "compliant"|"breach"|"insufficient_data", checkedAt }`.

### SDK Surface

```python
# Python
fox.slas.set(agent_id="support-bot", max_duration_ms=30000, min_success_rate=0.95,
             evaluation_window_ms=3600000, min_sample_size=20)
fox.slas.get(agent_id="support-bot")
# → { "config": { ... }, "status": { "compliant": False, "durationP95Ms": 34200, "successRate": 0.91, "sampleSize": 248 } }

fox.slas.list()
fox.slas.delete(agent_id="support-bot")
```

```typescript
// TypeScript
fox.slas.set({ agentId: "support-bot", maxDurationMs: 30000, minSuccessRate: 0.95,
               evaluationWindowMs: 3600000, minSampleSize: 20 })
fox.slas.get("support-bot")
fox.slas.list()
fox.slas.delete("support-bot")
```

### MCP Tool

- `foxhound_check_sla_status` — compliance status, current metrics (read-only)

### Worker Queues

- **Queue name:** `sla-scheduler` — recurring every 60s, concurrency 1, enqueues individual checks
- **Queue name:** `sla-check` — concurrency 10, processes individual SLA evaluations
- **Retry:** 3 attempts with exponential backoff on both queues
- **Deduplication:** `jobId: sla-check:{configId}:{minute}` prevents overlapping checks

---

## Feature 3: Behavior Regression Detection

### Version Tracking

Traces use `metadata.agent_version` to identify versions. SDKs encourage setting this via docs/examples but don't enforce it. Traces without a version are excluded from regression detection.

"Previous version" is determined by `behavior_baselines.created_at` ordering, not version string sorting (semver, date strings, and commit hashes are all valid version formats).

### Baseline Creation

When the worker sees 100 traces (configurable, default: 100) for an agent version without a baseline:
1. Compute span structure: frequency of each `(span_kind, span_name)` pair across traces
2. Store as `behavior_baselines` row with `span_structure` JSONB
3. Only structural data (presence/frequency of span types) — duration/frequency drift deferred to Phase 5 after real-world false positive data

### Regression Detection (Structural Drift Only)

Once a new version has a baseline, compare against the previous version's baseline (by `created_at`):
- **New span types:** A `(kind, name)` pair appearing in >10% of new-version traces that didn't exist in the previous baseline
- **Missing span types:** A `(kind, name)` pair that existed in >10% of previous-version traces but is absent from the new baseline

If any structural drift detected → `behavior_regression` alert.

**Why structural only for v1:** Fixed percentage thresholds for frequency/duration drift produce false positives for high-variance agents and miss regressions for stable agents. Structural changes (tool appearing/disappearing) have the clearest signal-to-noise ratio. Frequency and duration drift will be added in Phase 5 with self-calibrating thresholds based on historical variance.

### Alert Payload

```json
{
  "agentId": "support-bot",
  "previousVersion": "1.2.0",
  "newVersion": "1.3.0",
  "regressions": [
    { "type": "missing", "span": "tool_call:search_kb", "previousFrequency": 0.85 },
    { "type": "new", "span": "tool_call:escalate_human", "newFrequency": 0.30 }
  ],
  "sampleSize": { "before": 142, "after": 100 }
}
```

### No False Positives on First Deploy

If no previous version baseline exists, no comparison fires. The first version is always treated as the initial baseline.

### Acknowledging Regressions

To acknowledge a known regression (e.g., intentional tool removal), delete the old baseline:
`DELETE /v1/regressions/:agentId/baselines?version=1.2.0`

This forces the new version to become the baseline with no comparison target.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/regressions/:agentId` | Latest regression report (if any) |
| POST | `/v1/regressions/:agentId/compare` | On-demand comparison: `{ versionA, versionB }` |
| GET | `/v1/regressions/:agentId/baselines` | List stored baselines per version (paginated) |
| DELETE | `/v1/regressions/:agentId/baselines` | Delete baseline by `?version=` query param (handles special chars in version strings) |

### SDK Surface

```python
# Python
fox.regressions.compare(agent_id="support-bot", version_a="1.2.0", version_b="1.3.0")
# → RegressionReport with structural diffs

fox.regressions.baselines(agent_id="support-bot")
# → [{ "version": "1.2.0", "sampleSize": 142, "createdAt": "..." }, ...]

fox.regressions.delete_baseline(agent_id="support-bot", version="1.2.0")
```

```typescript
// TypeScript
fox.regressions.compare({ agentId: "support-bot", versionA: "1.2.0", versionB: "1.3.0" })
fox.regressions.baselines("support-bot")
fox.regressions.deleteBaseline({ agentId: "support-bot", version: "1.2.0" })
```

### MCP Tools

- `foxhound_detect_regression` — compare two agent versions, returns structural diff (read-only)
- `foxhound_list_baselines` — list baselined versions for an agent (read-only)

### Worker Queue

- **Queue name:** `regression-detector`
- **Concurrency:** 3 (heavy computation)
- **Trigger:** On trace ingestion, if `metadata.agent_version` is set, enqueue a check
- **Deduplication:** `jobId: regression:{orgId}:{agentId}:{version}` — BullMQ deduplicates by jobId; a duplicate `add()` is a no-op
- **Retry:** 3 attempts with exponential backoff

---

## Ingestion Hot Path Design

The trace ingestion endpoint (`POST /v1/traces`) must stay fast. All Phase 4 work happens **after** the 202 response, inside `setImmediate()`:

```
Request → Zod validate → sampling check → span limit check → return 202
                                                                  ↓
                                                          setImmediate()
                                                                  ↓
                                              persistTraceWithRetry() (existing)
                                              maybeFireAlerts() (existing)
                                              extractCosts() (NEW — in-memory pricing lookup)
                                              updateRedisCounters() (NEW — INCRBYFLOAT for cost, INCR for SLA)
                                              maybeEnqueueCostAlert() (NEW — compare Redis total vs cached threshold)
                                              maybeEnqueueRegression() (NEW — if agent_version in metadata)
```

**Zero additional DB reads on the hot path.** All lookups use in-memory caches:
- `agent_configs` cache: Map<`${orgId}:${agentId}`, config>, refreshed every 60s
- Model pricing cache: Map<prefix, pricing>, loaded from JSON file + DB overrides, refreshed every 60s

---

## Worker Architecture Summary

| Queue | Concurrency | Trigger | Retry |
|-------|------------|---------|-------|
| `cost-monitor` | 10 | Enqueued when Redis total crosses threshold | 3 attempts, exponential backoff |
| `sla-scheduler` | 1 | Recurring every 60s | 3 attempts |
| `sla-check` | 10 | Fan-out from sla-scheduler | 3 attempts, exponential backoff |
| `regression-detector` | 3 | On trace ingestion (if version set) | 3 attempts, exponential backoff |
| `cost-reconciler` | 1 | Recurring every 5 minutes | 3 attempts |

All queues use the existing Redis connection. Worker shutdown handler in `apps/worker/src/index.ts` must be updated to gracefully close all new workers.

---

## MCP Tools Summary (All Read-Only)

| Tool | Description |
|------|-------------|
| `foxhound_get_agent_budget` | Budget config + cached spend + status |
| `foxhound_check_sla_status` | Cached compliance status + metrics |
| `foxhound_detect_regression` | Compare two agent versions (structural) |
| `foxhound_list_baselines` | List baselined versions for an agent |

---

## SDK Namespaces Summary

| Namespace | Methods |
|-----------|---------|
| `fox.budgets` | `set()`, `get()`, `list()`, `delete()` |
| `fox.slas` | `set()`, `get()`, `list()`, `delete()` |
| `fox.regressions` | `compare()`, `baselines()`, `delete_baseline()` |

Multi-agent coordination namespace (`fox.coordination`) deferred to Phase 5. `startTrace()` accepts optional `parentAgentId` and `correlationId` params now (schema columns are additive), but SDK helper for header propagation deferred.

Manual propagation helper available immediately:

```python
headers = fox.get_propagation_headers()  # returns { "X-Foxhound-Correlation-Id": ..., "X-Foxhound-Parent-Agent-Id": ... }
requests.get("http://other-agent/...", headers={**headers, **my_headers})
```

```typescript
const headers = fox.getPropagationHeaders()
fetch("http://other-agent/...", { headers: { ...headers, ...myHeaders } })
```

---

## Files to Create/Modify

### New Files
- `packages/db/src/data/model-pricing.json` — default LLM pricing data
- `apps/api/src/routes/budgets.ts` — cost budget CRUD
- `apps/api/src/routes/slas.ts` — SLA CRUD
- `apps/api/src/routes/regressions.ts` — regression reports + baselines + on-demand compare
- `apps/api/src/lib/pricing-cache.ts` — in-memory pricing cache with 60s TTL
- `apps/api/src/lib/config-cache.ts` — in-memory agent_configs cache with 60s TTL
- `apps/worker/src/queues/cost-monitor.ts` — cost alert worker
- `apps/worker/src/queues/cost-reconciler.ts` — Redis↔Postgres cost reconciliation
- `apps/worker/src/queues/sla-scheduler.ts` — SLA fan-out scheduler
- `apps/worker/src/queues/sla-check.ts` — individual SLA evaluation worker
- `apps/worker/src/queues/regression-detector.ts` — baseline creation + structural drift detection

### Modified Files
- `packages/db/src/schema.ts` — new tables, spans.cost_usd column, traces columns + type migrations
- `packages/db/src/queries.ts` — queries for agent_configs, behavior_baselines, model_pricing_overrides
- `packages/types/src/index.ts` — AgentConfig, BehaviorBaseline, RegressionReport, SLAStatus types; update Trace to include parentAgentId/correlationId; update IngestTrace schema
- `packages/notifications/src/types.ts` — new alert event types
- `packages/notifications/src/providers/slack.ts` — event labels for new types
- `packages/notifications/src/providers/github.ts` — event labels for new types
- `packages/notifications/src/providers/linear.ts` — event labels for new types
- `packages/api-client/src/index.ts` — new typed methods for budgets, slas, regressions
- `packages/api-client/src/types.ts` — new request/response types
- `packages/sdk/src/client.ts` — budgets, slas, regressions namespaces + getPropagationHeaders() + startTrace accepts parentAgentId/correlationId
- `packages/sdk-py/foxhound/client.py` — same namespaces + get_propagation_headers() + start_trace accepts parent_agent_id/correlation_id
- `packages/mcp-server/src/index.ts` — 4 new read-only tools
- `apps/api/src/index.ts` — register new route modules
- `apps/api/src/routes/traces.ts` — cost extraction + Redis counter updates + job enqueuing (all inside setImmediate)
- `apps/worker/src/index.ts` — start new worker queues + update graceful shutdown handler

---

## Migration Strategy

1. **Migration 1:** `ALTER TABLE traces ALTER COLUMN start_time_ms TYPE BIGINT USING start_time_ms::bigint` (same for `end_time_ms`). On Neon, this requires a table rewrite but is online for tables under ~10M rows.
2. **Migration 2:** `ALTER TABLE spans ADD COLUMN cost_usd NUMERIC(12,6)`. Nullable, metadata-only on Neon — instant.
3. **Migration 3:** `ALTER TABLE traces ADD COLUMN parent_agent_id TEXT, ADD COLUMN correlation_id TEXT`. Nullable, instant.
4. **Migration 4:** Create `agent_configs`, `behavior_baselines`, `model_pricing_overrides` tables. New tables, no impact on existing data.
5. **Migration 5:** Add new indexes (partial indexes on coordination/cost columns).

No backfill needed for existing traces — they simply won't have cost data or coordination fields.

---

## Testing Strategy

- **Unit tests** for cost extraction logic (SDK-reported vs pricing file vs DB override vs unknown)
- **Unit tests** for longest-prefix model matching algorithm
- **Unit tests** for SLA evaluation (p95 from Redis sorted set, success rate, min_sample_size edge cases including zero traces)
- **Unit tests** for structural regression detection (new spans, missing spans, 10% threshold, first-version baseline)
- **Unit tests** for budget period boundary computation (daily/weekly/monthly, trace timestamp vs NOW)
- **Integration tests** for each API endpoint (CRUD + embedded status)
- **Integration tests** for Redis counter accuracy (increment on ingestion, reconciliation correctness)
- **Worker tests** for job processing (cost-monitor, sla-scheduler fan-out, sla-check, regression-detector, cost-reconciler)
- **SDK tests** for new namespaces and getPropagationHeaders()

---

## Success Criteria

- Agent cost budgets configurable and enforced with alerts (Redis-backed, sub-second detection)
- SLA monitoring with automated alerting, deduplication, and min_sample_size protection
- Behavior regression detection via structural drift (automatic on new version, 100-trace baseline)
- All features available on all plan tiers
- Zero additional DB reads on trace ingestion hot path
- 4 new read-only MCP tools
- 3 new SDK namespaces in both Python and TypeScript
- Manual propagation headers helper for multi-agent coordination (full feature in Phase 5)
