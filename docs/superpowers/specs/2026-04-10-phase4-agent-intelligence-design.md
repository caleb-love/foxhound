# Phase 4: Agent-Native Intelligence — Design Spec

**Date:** 2026-04-10
**Status:** Approved
**Depends on:** Phases 0-3 (all merged to main)

---

## Summary

Phase 4 deepens Foxhound's agent-first moat with four capabilities no competitor offers: agent cost budgets, SLA monitoring, behavior regression detection, and multi-agent coordination visualization. These features turn Foxhound from an observability tool into an agent fleet management platform.

**ClickHouse is deferred** — no production traffic data exists yet. Will evaluate separately if Postgres p95 trace queries exceed 200ms.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM cost source | Hybrid (SDK-reported preferred, server-side pricing table fallback) | SDK cost is most accurate; pricing table covers cases where SDK doesn't report |
| Entitlement gating | All features on all tiers | Matches "no feature gates, volume-limited only" philosophy |
| Regression trigger | Automatic on new version detection | Most agent-native UX; fires when N traces accumulated for new version |
| Multi-agent relationships | Explicit SDK params + automatic HTTP header propagation | Explicit always works; header propagation is DX bonus for HTTP-based systems |
| Worker architecture | Dedicated BullMQ queue per feature | Matches existing pattern (evaluator + experiment queues); independent scaling/tuning |
| ClickHouse | Deferred entirely | YAGNI — no production traffic to measure; add later without breaking changes |

---

## Database Schema

### New Tables

#### `model_pricing` — Built-in LLM pricing for hybrid cost tracking

```sql
model_pricing:
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,                     -- 'openai' | 'anthropic' | 'google' | ...
  model_pattern TEXT NOT NULL,                -- 'gpt-4o' | 'claude-sonnet-4-20250514' | matchable pattern
  input_cost_per_token DOUBLE PRECISION NOT NULL,
  output_cost_per_token DOUBLE PRECISION NOT NULL,
  effective_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
  UNIQUE(provider, model_pattern, effective_date)
```

#### `agent_configs` — Per-agent cost budget configuration

```sql
agent_configs:
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  agent_id TEXT NOT NULL,
  cost_budget_usd DOUBLE PRECISION NOT NULL,
  cost_alert_threshold_pct INTEGER NOT NULL DEFAULT 80,
  budget_period TEXT NOT NULL DEFAULT 'monthly',  -- 'daily' | 'weekly' | 'monthly' (resets at midnight UTC on period boundary)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
  UNIQUE(org_id, agent_id)
```

#### `agent_slas` — Per-agent SLA definitions

```sql
agent_slas:
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  agent_id TEXT NOT NULL,
  max_duration_ms BIGINT,                           -- NULL = no duration SLA
  min_success_rate DOUBLE PRECISION,                 -- NULL = no success rate SLA (0.0-1.0)
  evaluation_window_ms BIGINT NOT NULL DEFAULT 86400000,  -- 24h default
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
  UNIQUE(org_id, agent_id)
```

#### `behavior_baselines` — Span distribution snapshots per agent version

```sql
behavior_baselines:
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  agent_id TEXT NOT NULL,
  agent_version TEXT NOT NULL,
  sample_size INTEGER NOT NULL,
  span_distribution JSONB NOT NULL,  -- { "tool_call:search": 0.4, "llm_call:gpt-4o": 0.35, ... }
  created_at TIMESTAMP DEFAULT NOW()
  UNIQUE(org_id, agent_id, agent_version)
```

### Schema Modifications

**`traces` table** — two new nullable columns:

```sql
ALTER TABLE traces ADD COLUMN parent_agent_id TEXT;
ALTER TABLE traces ADD COLUMN correlation_id TEXT;
```

**New indexes:**
- `(org_id, correlation_id)` — coordination graph queries
- `(org_id, agent_id, parent_agent_id)` — parent-child agent lookups

### Alert Event Types

Extend the existing alert event type enum with four new values:
- `cost_budget_exceeded`
- `sla_duration_breach`
- `sla_success_rate_breach`
- `behavior_regression`

---

## Feature 1: Agent Cost Budgets

### Cost Extraction (Hybrid)

On trace ingestion, for each `llm_call` span:
1. If span attributes contain `cost_usd` (SDK-reported), use it directly
2. Otherwise, extract `model` + `token_count_input`/`token_count_output` from attributes, look up `model_pricing` table, compute cost
3. Store computed cost as `cost_usd` attribute on the span for future queries

### Budget Check Flow

1. User configures budget via `POST /v1/agent-configs`
2. On trace ingestion, if agent has a config, enqueue `cost-monitor` job
3. Worker sums all `cost_usd` for agent within current budget period
4. If spend >= `cost_alert_threshold_pct` of budget → `cost_budget_exceeded` alert (severity: high)
5. If spend >= 100% of budget → `cost_budget_exceeded` alert (severity: critical)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/agent-configs` | Create/update agent config (upsert on org_id + agent_id) |
| GET | `/v1/agent-configs` | List all configs for org |
| GET | `/v1/agent-configs/:agentId` | Get config + current spend summary |
| DELETE | `/v1/agent-configs/:agentId` | Remove config |
| GET | `/v1/agent-configs/:agentId/status` | Budget status: under/warning/exceeded + current spend |

### SDK Surface

```python
# Python
fox.budgets.set(agent_id="support-bot", cost_budget_usd=50.0, alert_threshold_pct=80, period="monthly")
fox.budgets.get(agent_id="support-bot")
fox.budgets.status(agent_id="support-bot")
# → { "status": "warning", "spend": 42.50, "budget": 50.0 }

# Budget-exceeded callback (opt-in polling)
client = FoxhoundClient(api_key="...", on_budget_exceeded=lambda status: sys.exit(1))
```

```typescript
// TypeScript
fox.budgets.set({ agentId: "support-bot", costBudgetUsd: 50, alertThresholdPct: 80, period: "monthly" })
fox.budgets.get("support-bot")
fox.budgets.status("support-bot")

const client = new FoxhoundClient({ apiKey: "...", onBudgetExceeded: (status) => process.exit(1) })
```

### MCP Tools

- `foxhound_get_agent_budget` — returns budget config + current spend + status
- `foxhound_set_agent_budget` — configure budget from IDE

### Worker Queue

- **Queue name:** `cost-monitor`
- **Concurrency:** 10
- **Trigger:** On trace ingestion when agent has a config
- **Rate limiter:** None needed (lightweight sum query)

---

## Feature 2: Agent SLA Monitoring

### SLA Evaluation Flow

1. User defines SLA via `POST /v1/agent-slas`
2. Recurring BullMQ job runs every 60 seconds on `sla-monitor` queue
3. For each configured SLA, query traces within `evaluation_window_ms`:
   - **Duration check:** Compute p95 duration. If p95 > `maxDurationMs` → `sla_duration_breach` alert
   - **Success rate check:** Error traces / total traces. If rate < `minSuccessRate` → `sla_success_rate_breach` alert
4. Alerts include: agent ID, current metric value, SLA threshold, evaluation window, sample size

### Alert Deduplication

Same alert type won't fire again within the evaluation window for the same SLA. Tracked via the existing `notification_log` table — before firing, the worker checks if a log entry exists for the same `(agent_id, event_type)` within the evaluation window. No new table needed.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/agent-slas` | Create/update SLA (upsert on org_id + agent_id) |
| GET | `/v1/agent-slas` | List all SLAs for org |
| GET | `/v1/agent-slas/:agentId` | Get SLA config |
| DELETE | `/v1/agent-slas/:agentId` | Remove SLA |
| GET | `/v1/agent-slas/:agentId/status` | Real-time compliance: metrics + breach state |

### SDK Surface

```python
# Python
fox.slas.set(agent_id="support-bot", max_duration_ms=30000, min_success_rate=0.95, evaluation_window_ms=3600000)
fox.slas.get(agent_id="support-bot")
fox.slas.status(agent_id="support-bot")
# → { "compliant": False, "duration_p95_ms": 34200, "success_rate": 0.91, "sample_size": 248 }
```

```typescript
// TypeScript
fox.slas.set({ agentId: "support-bot", maxDurationMs: 30000, minSuccessRate: 0.95, evaluationWindowMs: 3600000 })
fox.slas.get("support-bot")
fox.slas.status("support-bot")
```

### MCP Tool

- `foxhound_check_sla_status` — compliance status, current metrics, breach history

### Worker Queue

- **Queue name:** `sla-monitor`
- **Concurrency:** 5
- **Trigger:** Recurring every 60 seconds (repeatable BullMQ job)
- **Rate limiter:** None (fast aggregate queries)

---

## Feature 3: Behavior Regression Detection

### Version Tracking

Traces use `metadata.agent_version` to identify versions. SDKs encourage setting this via docs/examples but don't enforce it. Traces without a version are excluded from regression detection.

### Baseline Creation

When the worker sees N traces (default: 50) for an agent version without a baseline:
1. Compute span distribution: frequency of each `(span_kind, span_name)` pair across traces
2. Compute average span counts per trace, average duration per span type, tool call frequency distribution
3. Store as `behavior_baselines` row with `span_distribution` JSONB

### Regression Detection

Once a new version has a baseline, compare against the previous version's baseline:
- **Structural drift:** Span types appearing or disappearing
- **Frequency drift:** >25% change in any `(kind, name)` category (threshold configurable)
- **Duration drift:** Significant shift in average duration per span type

If drift exceeds threshold → `behavior_regression` alert.

### Alert Payload

```json
{
  "agentId": "support-bot",
  "previousVersion": "1.2.0",
  "newVersion": "1.3.0",
  "regressions": [
    { "type": "frequency", "span": "tool_call:search_kb", "before": 0.85, "after": 0.45, "changePct": -47 },
    { "type": "structural", "span": "tool_call:escalate_human", "status": "new", "frequency": 0.30 }
  ],
  "sampleSize": { "before": 142, "after": 50 }
}
```

### No False Positives on First Deploy

If no previous version baseline exists, no comparison fires. The first version is always treated as the initial baseline.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/agent-regressions/:agentId` | Latest regression report (if any) |
| POST | `/v1/agent-regressions/:agentId/compare` | On-demand comparison: `{ versionA, versionB }` |
| GET | `/v1/agent-regressions/:agentId/baselines` | List stored baselines per version |
| DELETE | `/v1/agent-regressions/:agentId/baselines/:version` | Delete baseline (forces re-computation) |

### SDK Surface

```python
# Python
fox.regressions.compare(agent_id="support-bot", version_a="1.2.0", version_b="1.3.0")
# → RegressionReport with structural/frequency/duration diffs

fox.regressions.baselines(agent_id="support-bot")
# → [{ "version": "1.2.0", "sample_size": 142, "created_at": "..." }, ...]
```

```typescript
// TypeScript
fox.regressions.compare({ agentId: "support-bot", versionA: "1.2.0", versionB: "1.3.0" })
fox.regressions.baselines("support-bot")
```

### MCP Tools

- `foxhound_detect_regression` — compare two agent versions, returns structured diff
- `foxhound_list_baselines` — list baselined versions for an agent

### Worker Queue

- **Queue name:** `regression-detector`
- **Concurrency:** 3 (heavy computation)
- **Trigger:** On trace ingestion, if `metadata.agent_version` is set, enqueue a check
- **Debounce:** One check per agent+version per 5 minutes to avoid redundant work

---

## Feature 4: Multi-Agent Coordination

### Relationship Population (Hybrid)

- **Explicit:** Developer passes `parentAgentId` and/or `correlationId` to `startTrace()`
- **Header propagation:** SDK includes `X-Foxhound-Correlation-Id` and `X-Foxhound-Parent-Agent-Id` in outgoing HTTP requests when tracing is active. Receiving agents auto-extract these.
- Explicit params override propagated values
- If no `correlationId` is set, the field stays null (single-agent trace)

### Coordination Graph Assembly

`GET /v1/coordination/:correlationId` reconstructs the full DAG:
1. Fetch all traces with that `correlation_id`
2. Build DAG from `parent_agent_id` → `agent_id` relationships
3. Return nodes (agents with trace summaries) and edges (parent→child with timing)

### Response Shape

```json
{
  "correlationId": "workflow-abc-123",
  "agents": [
    { "agentId": "orchestrator", "traceId": "tr_001", "status": "ok", "durationMs": 12400, "spanCount": 8 },
    { "agentId": "researcher", "traceId": "tr_002", "parentAgentId": "orchestrator", "status": "ok", "durationMs": 8200, "spanCount": 5 },
    { "agentId": "writer", "traceId": "tr_003", "parentAgentId": "orchestrator", "status": "error", "durationMs": 3100, "spanCount": 3 }
  ],
  "edges": [
    { "from": "orchestrator", "to": "researcher", "startedAtMs": 1712000000 },
    { "from": "orchestrator", "to": "writer", "startedAtMs": 1712000400 }
  ],
  "totalDurationMs": 12400,
  "status": "error"
}
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/coordination/:correlationId` | Full multi-agent graph |
| GET | `/v1/coordination` | List recent correlation IDs for org (paginated) |

### SDK Surface

```python
# Python — explicit relationship declaration
trace = fox.start_trace(agent_id="researcher", correlation_id="workflow-abc", parent_agent_id="orchestrator")

# Header propagation is automatic within traced context
fox.coordination.get(correlation_id="workflow-abc-123")
fox.coordination.list()
```

```typescript
// TypeScript
const trace = fox.startTrace({ agentId: "researcher", correlationId: "workflow-abc", parentAgentId: "orchestrator" })

fox.coordination.get("workflow-abc-123")
fox.coordination.list()
```

### MCP Tool

- `foxhound_get_coordination_graph` — full multi-agent DAG with status and timing, formatted as readable tree

### No Background Jobs

Purely a query-time feature. Trace ingestion persists the two new columns; graph is assembled on read.

---

## Worker Architecture Summary

| Queue | Concurrency | Trigger | Rate Limiter |
|-------|------------|---------|--------------|
| `cost-monitor` | 10 | On trace ingestion (if agent has config) | None |
| `sla-monitor` | 5 | Recurring every 60s | None |
| `regression-detector` | 3 | On trace ingestion (if version set), debounced 5min | None |

All queues use the existing Redis connection and follow established patterns from `evaluator-runs` and `experiment-runs` queues.

---

## New MCP Tools Summary

| Tool | Description |
|------|-------------|
| `foxhound_get_agent_budget` | Budget config + current spend + status |
| `foxhound_set_agent_budget` | Configure budget from IDE |
| `foxhound_check_sla_status` | Compliance status + metrics + breach history |
| `foxhound_detect_regression` | Compare two agent versions |
| `foxhound_list_baselines` | List baselined versions |
| `foxhound_get_coordination_graph` | Multi-agent DAG visualization |

---

## New SDK Namespaces Summary

| Namespace | Methods |
|-----------|---------|
| `fox.budgets` | `set()`, `get()`, `status()` |
| `fox.slas` | `set()`, `get()`, `status()` |
| `fox.regressions` | `compare()`, `baselines()` |
| `fox.coordination` | `get()`, `list()` |

Plus `onBudgetExceeded` callback on client constructor, and automatic `X-Foxhound-Correlation-Id` / `X-Foxhound-Parent-Agent-Id` header propagation.

---

## Files to Create/Modify

### New Files
- `apps/api/src/routes/agent-configs.ts` — cost budget CRUD + status
- `apps/api/src/routes/agent-slas.ts` — SLA CRUD + status
- `apps/api/src/routes/agent-regressions.ts` — regression reports + baselines + on-demand compare
- `apps/api/src/routes/coordination.ts` — coordination graph queries
- `apps/worker/src/queues/cost-monitor.ts` — cost budget check worker
- `apps/worker/src/queues/sla-monitor.ts` — SLA evaluation worker (recurring)
- `apps/worker/src/queues/regression-detector.ts` — baseline creation + regression detection worker

### Modified Files
- `packages/db/src/schema.ts` — new tables + traces columns
- `packages/db/src/queries.ts` — queries for all new tables
- `packages/types/src/index.ts` — new type definitions
- `packages/notifications/src/types.ts` — new alert event types
- `packages/api-client/src/index.ts` — new typed methods
- `packages/api-client/src/types.ts` — new request/response types
- `packages/sdk/src/client.ts` — budgets, slas, regressions, coordination namespaces + header propagation + onBudgetExceeded
- `packages/sdk-py/foxhound/client.py` — same namespaces + header propagation + on_budget_exceeded
- `packages/mcp-server/src/index.ts` — 6 new tools
- `packages/billing/src/entitlements.ts` — no feature gates needed (all tiers), but verify no blockers
- `apps/api/src/index.ts` — register new route modules
- `apps/api/src/routes/traces.ts` — extract cost on ingestion, enqueue cost-monitor/regression jobs, persist parent_agent_id/correlation_id
- `apps/worker/src/index.ts` — start new worker queues

---

## Testing Strategy

- **Unit tests** for cost extraction logic (SDK-reported vs pricing table fallback)
- **Unit tests** for SLA evaluation queries (duration p95, success rate)
- **Unit tests** for regression detection algorithm (structural, frequency, duration drift)
- **Unit tests** for coordination graph assembly (DAG construction, edge cases)
- **Integration tests** for each API endpoint (CRUD + status)
- **Worker tests** for job processing (cost-monitor, sla-monitor, regression-detector)
- **SDK tests** for new namespaces and header propagation

---

## Success Criteria

- Agent cost budgets configurable and enforced with alerts
- SLA monitoring with automated alerting and deduplication
- Behavior regression detection across agent versions (automatic on new version)
- Multi-agent workflows visualized via coordination graph API
- All features available on all plan tiers
- 6 new MCP tools for IDE-based agent management
- 4 new SDK namespaces in both Python and TypeScript
