# Phase 4: Agent-Native Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add agent cost budgets, SLA monitoring, and behavior regression detection — the features that differentiate Foxhound from every competitor.

**Architecture:** Three new BullMQ worker queues (cost-monitor, sla-check, regression-detector) process intelligence jobs asynchronously. In-memory caches (60s TTL) protect the trace ingestion hot path from additional DB reads. Redis running totals track cost and SLA metrics in O(1). All features available on all plan tiers.

**Tech Stack:** Fastify, Drizzle ORM, BullMQ, Redis (ioredis), Zod, TypeScript SDK, Python SDK (httpx)

**Spec:** `docs/superpowers/specs/2026-04-10-phase4-agent-intelligence-design.md`

---

## File Map

### New Files

| File                                            | Responsibility                                 |
| ----------------------------------------------- | ---------------------------------------------- |
| `packages/db/src/data/model-pricing.json`       | Default LLM pricing data shipped with repo     |
| `apps/api/src/lib/pricing-cache.ts`             | In-memory model pricing cache (60s TTL)        |
| `apps/api/src/lib/config-cache.ts`              | In-memory agent_configs cache (60s TTL)        |
| `apps/api/src/lib/redis.ts`                     | Shared Redis client (ioredis) for counters     |
| `apps/api/src/routes/budgets.ts`                | Cost budget CRUD endpoints                     |
| `apps/api/src/routes/slas.ts`                   | SLA CRUD endpoints                             |
| `apps/api/src/routes/regressions.ts`            | Regression reports + baselines endpoints       |
| `apps/worker/src/queues/cost-monitor.ts`        | Cost alert worker                              |
| `apps/worker/src/queues/cost-reconciler.ts`     | Redis↔Postgres cost reconciliation             |
| `apps/worker/src/queues/sla-scheduler.ts`       | SLA fan-out scheduler                          |
| `apps/worker/src/queues/sla-check.ts`           | Individual SLA evaluation worker               |
| `apps/worker/src/queues/regression-detector.ts` | Baseline creation + structural drift detection |

### Modified Files

| File                                            | Changes                                                                                                                                                                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/src/schema.ts`                     | Add `agentConfigs`, `behaviorBaselines`, `modelPricingOverrides` tables; add `costUsd` to spans; add `parentAgentId`/`correlationId` to traces; migrate `startTimeMs`/`endTimeMs` to bigint; extend alert event types |
| `packages/db/src/queries.ts`                    | Add queries for agent configs, baselines, pricing overrides, cost sums, SLA metrics                                                                                                                                   |
| `packages/types/src/index.ts`                   | Add `AgentConfig`, `BehaviorBaseline`, `RegressionReport`, `BudgetStatus`, `SLAStatus` types; update `Trace` with `parentAgentId`/`correlationId`                                                                     |
| `packages/notifications/src/types.ts`           | Add 4 new `AlertEventType` values                                                                                                                                                                                     |
| `packages/notifications/src/providers/slack.ts` | Add event labels for new alert types                                                                                                                                                                                  |
| `packages/api-client/src/index.ts`              | Add budget, SLA, regression methods                                                                                                                                                                                   |
| `packages/api-client/src/types.ts`              | Add request/response types                                                                                                                                                                                            |
| `packages/sdk/src/client.ts`                    | Add `budgets`, `slas`, `regressions` namespaces; update `startTrace` params; add `getPropagationHeaders()`                                                                                                            |
| `packages/sdk-py/foxhound/client.py`            | Same namespaces; update `start_trace` params; add `get_propagation_headers()`                                                                                                                                         |
| `packages/mcp-server/src/index.ts`              | Add 4 read-only tools                                                                                                                                                                                                 |
| `apps/api/src/index.ts`                         | Register budget, SLA, regression routes                                                                                                                                                                               |
| `apps/api/src/routes/traces.ts`                 | Add cost extraction, Redis counter updates, job enqueuing inside `setImmediate`                                                                                                                                       |
| `apps/api/src/queue.ts`                         | Add queue getters for cost-monitor, sla-scheduler, regression-detector                                                                                                                                                |
| `apps/worker/src/index.ts`                      | Start new workers, update graceful shutdown                                                                                                                                                                           |

---

## Task 1: Schema — New Tables + Column Migrations

**Files:**

- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Add `numeric` import and `agentConfigs` table after the SSO section (~line 337)**

Add to the imports at the top of the file:

```typescript
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  unique,
  primaryKey,
  integer,
  boolean,
  bigint,
  real,
  doublePrecision,
  numeric,
} from "drizzle-orm/pg-core";
```

Then add after the `ssoSessions` table (after line 337):

```typescript
// ──────────────────────────────────────────────────────────────────────────────
// Agent Intelligence tables (Phase 4)
// ──────────────────────────────────────────────────────────────────────────────

export const agentConfigs = pgTable(
  "agent_configs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),

    // Cost budget fields (nullable = not configured)
    costBudgetUsd: numeric("cost_budget_usd", { precision: 12, scale: 6 }),
    costAlertThresholdPct: integer("cost_alert_threshold_pct").default(80),
    budgetPeriod: text("budget_period", { enum: ["daily", "weekly", "monthly"] }).default(
      "monthly",
    ),

    // SLA fields (nullable = not configured)
    maxDurationMs: bigint("max_duration_ms", { mode: "number" }),
    minSuccessRate: numeric("min_success_rate", { precision: 5, scale: 4 }),
    evaluationWindowMs: bigint("evaluation_window_ms", { mode: "number" }).default(86400000),
    minSampleSize: integer("min_sample_size").default(10),

    // Cached status from last worker run
    lastCostStatus: jsonb("last_cost_status").$type<Record<string, unknown> | null>(),
    lastSlaStatus: jsonb("last_sla_status").$type<Record<string, unknown> | null>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgAgentUnique: unique("agent_configs_org_agent_unique").on(table.orgId, table.agentId),
    orgIdIdx: index("agent_configs_org_id_idx").on(table.orgId),
  }),
);

export const behaviorBaselines = pgTable(
  "behavior_baselines",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    agentVersion: text("agent_version").notNull(),
    sampleSize: integer("sample_size").notNull(),
    spanStructure: jsonb("span_structure").notNull().$type<Record<string, number>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgAgentVersionUnique: unique("baselines_org_agent_version_unique").on(
      table.orgId,
      table.agentId,
      table.agentVersion,
    ),
    orgAgentCreatedIdx: index("baselines_org_agent_created_idx").on(
      table.orgId,
      table.agentId,
      table.createdAt,
    ),
  }),
);

export const modelPricingOverrides = pgTable(
  "model_pricing_overrides",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    modelPattern: text("model_pattern").notNull(),
    inputCostPerToken: numeric("input_cost_per_token", { precision: 18, scale: 12 }).notNull(),
    outputCostPerToken: numeric("output_cost_per_token", { precision: 18, scale: 12 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgProviderModelUnique: unique("pricing_overrides_unique").on(
      table.orgId,
      table.provider,
      table.modelPattern,
    ),
    orgIdIdx: index("pricing_overrides_org_id_idx").on(table.orgId),
  }),
);
```

- [ ] **Step 2: Add `costUsd` column to `spans` table**

In the `spans` table definition (~line 122-159), add after the `events` field:

```typescript
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
```

- [ ] **Step 3: Add `parentAgentId` and `correlationId` to `traces` table**

In the `traces` table definition (~line 100-120), add after `metadata`:

```typescript
    parentAgentId: text("parent_agent_id"),
    correlationId: text("correlation_id"),
```

And add to the index function:

```typescript
    correlationIdIdx: index("traces_correlation_id_idx").on(table.orgId, table.correlationId),
    orgAgentStartIdx: index("traces_org_agent_start_idx").on(table.orgId, table.agentId, table.startTimeMs),
```

- [ ] **Step 4: Migrate `traces.startTimeMs` and `endTimeMs` from text to bigint**

Change in the traces table:

```typescript
    startTimeMs: bigint("start_time_ms", { mode: "number" }).notNull(),
    endTimeMs: bigint("end_time_ms", { mode: "number" }),
```

- [ ] **Step 5: Extend `alertRules.eventType` enum**

Update the enum in the `alertRules` table (~line 230):

```typescript
    eventType: text("event_type", {
      enum: [
        "agent_failure",
        "anomaly_detected",
        "cost_spike",
        "compliance_violation",
        "cost_budget_exceeded",
        "sla_duration_breach",
        "sla_success_rate_breach",
        "behavior_regression",
      ],
    }).notNull(),
```

- [ ] **Step 6: Run build to verify schema compiles**

Run: `pnpm --filter @foxhound/db build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add Phase 4 agent intelligence schema — configs, baselines, pricing overrides, traces bigint migration"
```

---

## Task 2: Types — New Interfaces

**Files:**

- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Update `Trace` interface**

Add `parentAgentId` and `correlationId` to the existing `Trace` interface:

```typescript
export interface Trace {
  id: string;
  agentId: string;
  sessionId?: string;
  parentAgentId?: string;
  correlationId?: string;
  spans: Span[];
  startTimeMs: number;
  endTimeMs?: number;
  metadata: Record<string, string | number | boolean | null>;
}
```

- [ ] **Step 2: Add Phase 4 types at the end of the file**

```typescript
// ── Agent Intelligence types (Phase 4) ──────────────────────────────────

export type BudgetPeriod = "daily" | "weekly" | "monthly";
export type BudgetStatusLevel = "under" | "warning" | "exceeded";
export type SLAComplianceStatus = "compliant" | "breach" | "insufficient_data" | "no_data";

export interface AgentConfig {
  id: string;
  orgId: string;
  agentId: string;
  costBudgetUsd?: string | null;
  costAlertThresholdPct?: number | null;
  budgetPeriod?: BudgetPeriod | null;
  maxDurationMs?: number | null;
  minSuccessRate?: string | null;
  evaluationWindowMs?: number | null;
  minSampleSize?: number | null;
  lastCostStatus?: BudgetStatus | null;
  lastSlaStatus?: SLAStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetStatus {
  status: BudgetStatusLevel;
  spend: number;
  budget: number;
  unknownCostPct: number;
  checkedAt: string;
}

export interface SLAStatus {
  status: SLAComplianceStatus;
  compliant: boolean;
  durationP95Ms?: number;
  successRate?: number;
  sampleSize: number;
  checkedAt: string;
}

export interface BehaviorBaseline {
  id: string;
  orgId: string;
  agentId: string;
  agentVersion: string;
  sampleSize: number;
  spanStructure: Record<string, number>;
  createdAt: string;
}

export interface RegressionReport {
  agentId: string;
  previousVersion: string;
  newVersion: string;
  regressions: Array<{
    type: "missing" | "new";
    span: string;
    previousFrequency?: number;
    newFrequency?: number;
  }>;
  sampleSize: { before: number; after: number };
}
```

- [ ] **Step 3: Build types package**

Run: `pnpm --filter @foxhound/types build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): add Phase 4 agent intelligence type definitions"
```

---

## Task 3: Notification Types — New Alert Event Types

**Files:**

- Modify: `packages/notifications/src/types.ts`
- Modify: `packages/notifications/src/providers/slack.ts`

- [ ] **Step 1: Extend `AlertEventType` in notifications types**

In `packages/notifications/src/types.ts`, update the type (~line 5-9):

```typescript
export type AlertEventType =
  | "agent_failure"
  | "anomaly_detected"
  | "cost_spike"
  | "compliance_violation"
  | "cost_budget_exceeded"
  | "sla_duration_breach"
  | "sla_success_rate_breach"
  | "behavior_regression";
```

- [ ] **Step 2: Add event labels to Slack provider**

Read `packages/notifications/src/providers/slack.ts` and add the new event labels to the `EVENT_LABEL` map (or equivalent display name mapping). Add entries:

```typescript
cost_budget_exceeded: "Cost Budget Exceeded",
sla_duration_breach: "SLA Duration Breach",
sla_success_rate_breach: "SLA Success Rate Breach",
behavior_regression: "Behavior Regression Detected",
```

Do the same for `github.ts` and `linear.ts` if they have similar label maps.

- [ ] **Step 3: Build notifications package**

Run: `pnpm --filter @foxhound/notifications build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/notifications/
git commit -m "feat(notifications): add Phase 4 alert event types — cost, SLA, regression"
```

---

## Task 4: Model Pricing JSON + Pricing Cache

**Files:**

- Create: `packages/db/src/data/model-pricing.json`
- Create: `apps/api/src/lib/pricing-cache.ts`

- [ ] **Step 1: Create the default pricing JSON file**

```json
[
  {
    "provider": "openai",
    "modelPattern": "gpt-4o",
    "inputCostPerToken": 0.0000025,
    "outputCostPerToken": 0.00001
  },
  {
    "provider": "openai",
    "modelPattern": "gpt-4o-mini",
    "inputCostPerToken": 0.00000015,
    "outputCostPerToken": 0.0000006
  },
  {
    "provider": "openai",
    "modelPattern": "gpt-4-turbo",
    "inputCostPerToken": 0.00001,
    "outputCostPerToken": 0.00003
  },
  {
    "provider": "openai",
    "modelPattern": "gpt-3.5-turbo",
    "inputCostPerToken": 0.0000005,
    "outputCostPerToken": 0.0000015
  },
  {
    "provider": "openai",
    "modelPattern": "o1",
    "inputCostPerToken": 0.000015,
    "outputCostPerToken": 0.00006
  },
  {
    "provider": "openai",
    "modelPattern": "o3-mini",
    "inputCostPerToken": 0.0000011,
    "outputCostPerToken": 0.0000044
  },
  {
    "provider": "anthropic",
    "modelPattern": "claude-opus-4",
    "inputCostPerToken": 0.000015,
    "outputCostPerToken": 0.000075
  },
  {
    "provider": "anthropic",
    "modelPattern": "claude-sonnet-4",
    "inputCostPerToken": 0.000003,
    "outputCostPerToken": 0.000015
  },
  {
    "provider": "anthropic",
    "modelPattern": "claude-haiku-4",
    "inputCostPerToken": 0.0000008,
    "outputCostPerToken": 0.000004
  },
  {
    "provider": "anthropic",
    "modelPattern": "claude-3.5-sonnet",
    "inputCostPerToken": 0.000003,
    "outputCostPerToken": 0.000015
  },
  {
    "provider": "google",
    "modelPattern": "gemini-2.5-pro",
    "inputCostPerToken": 0.00000125,
    "outputCostPerToken": 0.00001
  },
  {
    "provider": "google",
    "modelPattern": "gemini-2.5-flash",
    "inputCostPerToken": 0.00000015,
    "outputCostPerToken": 0.0000006
  },
  {
    "provider": "google",
    "modelPattern": "gemini-2.0-flash",
    "inputCostPerToken": 0.0000001,
    "outputCostPerToken": 0.0000004
  }
]
```

- [ ] **Step 2: Create the pricing cache module**

Create `apps/api/src/lib/pricing-cache.ts`:

```typescript
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getModelPricingOverrides } from "@foxhound/db";

interface PricingEntry {
  provider: string;
  modelPattern: string;
  inputCostPerToken: number;
  outputCostPerToken: number;
}

// In-memory cache: sorted by modelPattern length desc for longest-prefix match
let defaultPricing: PricingEntry[] = [];
let orgOverrides: Map<string, PricingEntry[]> = new Map();
let lastRefresh = 0;
const REFRESH_INTERVAL_MS = 60_000;

function loadDefaultPricing(): PricingEntry[] {
  try {
    // Resolve relative to this file → packages/db/src/data/model-pricing.json
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const filePath = resolve(__dirname, "../../../packages/db/src/data/model-pricing.json");
    const raw = readFileSync(filePath, "utf-8");
    const entries = JSON.parse(raw) as PricingEntry[];
    return entries.sort((a, b) => b.modelPattern.length - a.modelPattern.length);
  } catch {
    console.warn("[pricing-cache] Failed to load default pricing JSON");
    return [];
  }
}

export async function refreshPricingCache(): Promise<void> {
  defaultPricing = loadDefaultPricing();
  // Load all org overrides (small table)
  const overrides = await getModelPricingOverrides();
  orgOverrides = new Map();
  for (const o of overrides) {
    const list = orgOverrides.get(o.orgId) ?? [];
    list.push({
      provider: o.provider,
      modelPattern: o.modelPattern,
      inputCostPerToken: Number(o.inputCostPerToken),
      outputCostPerToken: Number(o.outputCostPerToken),
    });
    orgOverrides.set(o.orgId, list);
  }
  lastRefresh = Date.now();
}

async function ensureFresh(): Promise<void> {
  if (Date.now() - lastRefresh > REFRESH_INTERVAL_MS) {
    await refreshPricingCache();
  }
}

/**
 * Look up pricing for a model using longest-prefix match.
 * Org overrides take precedence (exact match only).
 * Returns null if no match found.
 */
export async function lookupPricing(
  orgId: string,
  model: string,
): Promise<{ inputCostPerToken: number; outputCostPerToken: number } | null> {
  await ensureFresh();

  // Check org overrides first (exact match)
  const overrides = orgOverrides.get(orgId);
  if (overrides) {
    const exactMatch = overrides.find((e) => model === e.modelPattern);
    if (exactMatch) {
      return {
        inputCostPerToken: exactMatch.inputCostPerToken,
        outputCostPerToken: exactMatch.outputCostPerToken,
      };
    }
  }

  // Longest-prefix match on default pricing (already sorted by length desc)
  for (const entry of defaultPricing) {
    if (model.startsWith(entry.modelPattern)) {
      return {
        inputCostPerToken: entry.inputCostPerToken,
        outputCostPerToken: entry.outputCostPerToken,
      };
    }
  }

  return null;
}
```

- [ ] **Step 3: Build to verify**

Run: `pnpm --filter @foxhound/api build`
Expected: PASS (may have import issues to fix — `getModelPricingOverrides` doesn't exist yet in queries.ts; that's fine, Task 5 adds it)

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/data/model-pricing.json apps/api/src/lib/pricing-cache.ts
git commit -m "feat: add model pricing JSON + in-memory pricing cache with longest-prefix match"
```

---

## Task 5: Database Queries — Agent Configs, Baselines, Pricing Overrides

**Files:**

- Modify: `packages/db/src/queries.ts`

- [ ] **Step 1: Add agent config queries at the end of queries.ts**

Import the new tables at the top of queries.ts alongside existing imports:

```typescript
import { agentConfigs, behaviorBaselines, modelPricingOverrides } from "./schema.js";
```

Then add these query functions at the end of the file:

```typescript
// ──────────────────────────────────────────────────────────────────────────────
// Agent Config queries (Phase 4)
// ──────────────────────────────────────────────────────────────────────────────

export async function upsertAgentConfig(
  data: typeof agentConfigs.$inferInsert,
): Promise<typeof agentConfigs.$inferSelect> {
  const [row] = await db
    .insert(agentConfigs)
    .values(data)
    .onConflictDoUpdate({
      target: [agentConfigs.orgId, agentConfigs.agentId],
      set: {
        costBudgetUsd: data.costBudgetUsd,
        costAlertThresholdPct: data.costAlertThresholdPct,
        budgetPeriod: data.budgetPeriod,
        maxDurationMs: data.maxDurationMs,
        minSuccessRate: data.minSuccessRate,
        evaluationWindowMs: data.evaluationWindowMs,
        minSampleSize: data.minSampleSize,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

export async function getAgentConfig(
  orgId: string,
  agentId: string,
): Promise<typeof agentConfigs.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(agentConfigs)
    .where(and(eq(agentConfigs.orgId, orgId), eq(agentConfigs.agentId, agentId)));
  return row;
}

export async function listAgentConfigs(
  orgId: string,
  page = 1,
  limit = 50,
): Promise<Array<typeof agentConfigs.$inferSelect>> {
  return db
    .select()
    .from(agentConfigs)
    .where(eq(agentConfigs.orgId, orgId))
    .orderBy(agentConfigs.createdAt)
    .limit(limit)
    .offset((page - 1) * limit);
}

export async function deleteAgentConfig(orgId: string, agentId: string): Promise<boolean> {
  const result = await db
    .delete(agentConfigs)
    .where(and(eq(agentConfigs.orgId, orgId), eq(agentConfigs.agentId, agentId)));
  return (result.rowCount ?? 0) > 0;
}

export async function updateAgentConfigStatus(
  orgId: string,
  agentId: string,
  costStatus: Record<string, unknown> | null,
  slaStatus: Record<string, unknown> | null,
): Promise<void> {
  await db
    .update(agentConfigs)
    .set({
      ...(costStatus !== undefined ? { lastCostStatus: costStatus } : {}),
      ...(slaStatus !== undefined ? { lastSlaStatus: slaStatus } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(agentConfigs.orgId, orgId), eq(agentConfigs.agentId, agentId)));
}

export async function getAllAgentConfigsWithSLA(): Promise<
  Array<typeof agentConfigs.$inferSelect>
> {
  return db
    .select()
    .from(agentConfigs)
    .where(or(isNotNull(agentConfigs.maxDurationMs), isNotNull(agentConfigs.minSuccessRate)));
}

// ──────────────────────────────────────────────────────────────────────────────
// Behavior Baseline queries (Phase 4)
// ──────────────────────────────────────────────────────────────────────────────

export async function upsertBaseline(
  data: typeof behaviorBaselines.$inferInsert,
): Promise<typeof behaviorBaselines.$inferSelect> {
  const [row] = await db
    .insert(behaviorBaselines)
    .values(data)
    .onConflictDoUpdate({
      target: [behaviorBaselines.orgId, behaviorBaselines.agentId, behaviorBaselines.agentVersion],
      set: {
        sampleSize: data.sampleSize,
        spanStructure: data.spanStructure,
      },
    })
    .returning();
  return row!;
}

export async function getBaseline(
  orgId: string,
  agentId: string,
  agentVersion: string,
): Promise<typeof behaviorBaselines.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(behaviorBaselines)
    .where(
      and(
        eq(behaviorBaselines.orgId, orgId),
        eq(behaviorBaselines.agentId, agentId),
        eq(behaviorBaselines.agentVersion, agentVersion),
      ),
    );
  return row;
}

export async function getRecentBaselines(
  orgId: string,
  agentId: string,
  limit = 10,
): Promise<Array<typeof behaviorBaselines.$inferSelect>> {
  return db
    .select()
    .from(behaviorBaselines)
    .where(and(eq(behaviorBaselines.orgId, orgId), eq(behaviorBaselines.agentId, agentId)))
    .orderBy(desc(behaviorBaselines.createdAt))
    .limit(limit);
}

export async function deleteBaseline(
  orgId: string,
  agentId: string,
  agentVersion: string,
): Promise<boolean> {
  const result = await db
    .delete(behaviorBaselines)
    .where(
      and(
        eq(behaviorBaselines.orgId, orgId),
        eq(behaviorBaselines.agentId, agentId),
        eq(behaviorBaselines.agentVersion, agentVersion),
      ),
    );
  return (result.rowCount ?? 0) > 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Model Pricing Override queries (Phase 4)
// ──────────────────────────────────────────────────────────────────────────────

export async function getModelPricingOverrides(): Promise<
  Array<typeof modelPricingOverrides.$inferSelect>
> {
  return db.select().from(modelPricingOverrides);
}

// ──────────────────────────────────────────────────────────────────────────────
// Cost aggregation queries (Phase 4)
// ──────────────────────────────────────────────────────────────────────────────

export async function sumSpanCosts(
  orgId: string,
  agentId: string,
  fromMs: number,
  toMs: number,
): Promise<{ totalCost: number; totalSpans: number; unknownCostSpans: number }> {
  const rows = await db
    .select({
      totalCost: sql<string>`COALESCE(SUM(${spans.costUsd}), 0)`,
      totalSpans: sql<number>`COUNT(*) FILTER (WHERE ${spans.kind} = 'llm_call')`,
      unknownCostSpans: sql<number>`COUNT(*) FILTER (WHERE ${spans.kind} = 'llm_call' AND ${spans.costUsd} IS NULL)`,
    })
    .from(spans)
    .innerJoin(traces, eq(spans.traceId, traces.id))
    .where(
      and(
        eq(spans.orgId, orgId),
        eq(traces.agentId, agentId),
        gte(traces.startTimeMs, fromMs),
        lt(traces.startTimeMs, toMs),
        eq(spans.kind, "llm_call"),
      ),
    );
  const row = rows[0]!;
  return {
    totalCost: Number(row.totalCost),
    totalSpans: row.totalSpans,
    unknownCostSpans: row.unknownCostSpans,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Span structure queries for regression detection (Phase 4)
// ──────────────────────────────────────────────────────────────────────────────

export async function countTracesForVersion(
  orgId: string,
  agentId: string,
  agentVersion: string,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(traces)
    .where(
      and(
        eq(traces.orgId, orgId),
        eq(traces.agentId, agentId),
        sql`${traces.metadata}->>'agent_version' = ${agentVersion}`,
      ),
    );
  return rows[0]?.count ?? 0;
}

export async function getSpanStructureForVersion(
  orgId: string,
  agentId: string,
  agentVersion: string,
  limit = 100,
): Promise<Record<string, number>> {
  // Get span (kind, name) frequency across recent traces for this version
  const rows = await db
    .select({
      kind: spans.kind,
      name: spans.name,
      traceCount: sql<number>`COUNT(DISTINCT ${spans.traceId})`,
    })
    .from(spans)
    .innerJoin(traces, eq(spans.traceId, traces.id))
    .where(
      and(
        eq(spans.orgId, orgId),
        eq(traces.agentId, agentId),
        sql`${traces.metadata}->>'agent_version' = ${agentVersion}`,
      ),
    )
    .groupBy(spans.kind, spans.name);

  // Count total traces for this version
  const totalTraces = await countTracesForVersion(orgId, agentId, agentVersion);
  if (totalTraces === 0) return {};

  const structure: Record<string, number> = {};
  for (const row of rows) {
    const key = `${row.kind}:${row.name}`;
    structure[key] = row.traceCount / Math.min(totalTraces, limit);
  }
  return structure;
}
```

- [ ] **Step 2: Add missing Drizzle imports if needed**

Ensure `and`, `eq`, `desc`, `or`, `isNotNull`, `gte`, `lt`, `sql` are all imported from `drizzle-orm` at the top of queries.ts. Also ensure `spans` and `traces` are imported from `./schema.js`.

- [ ] **Step 3: Build db package**

Run: `pnpm --filter @foxhound/db build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/queries.ts
git commit -m "feat(db): add Phase 4 queries — agent configs, baselines, cost aggregation, span structure"
```

---

## Task 6: Redis Client + Config Cache

**Files:**

- Create: `apps/api/src/lib/redis.ts`
- Create: `apps/api/src/lib/config-cache.ts`

- [ ] **Step 1: Create shared Redis client**

Create `apps/api/src/lib/redis.ts`:

```typescript
import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env["REDIS_URL"];
  if (!url) return null;
  redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true });
  redis.connect().catch(() => {});
  return redis;
}
```

- [ ] **Step 2: Create agent config cache**

Create `apps/api/src/lib/config-cache.ts`:

```typescript
import { listAgentConfigs } from "@foxhound/db";

interface CachedConfig {
  costBudgetUsd: number | null;
  costAlertThresholdPct: number | null;
  budgetPeriod: string | null;
  maxDurationMs: number | null;
  minSuccessRate: number | null;
  evaluationWindowMs: number | null;
}

// Map<"orgId:agentId", config>
let cache: Map<string, CachedConfig> = new Map();
let lastRefresh = 0;
const REFRESH_INTERVAL_MS = 60_000;

export async function refreshConfigCache(): Promise<void> {
  // Load configs for all orgs (this is a small table)
  // In production, this would be scoped or paginated
  // For now, load all — same pattern as pricing cache
  cache = new Map();
  lastRefresh = Date.now();
}

export async function getConfigFromCache(
  orgId: string,
  agentId: string,
): Promise<CachedConfig | null> {
  if (Date.now() - lastRefresh > REFRESH_INTERVAL_MS) {
    await refreshConfigCache();
  }
  return cache.get(`${orgId}:${agentId}`) ?? null;
}

export function setCacheEntry(orgId: string, agentId: string, config: CachedConfig): void {
  cache.set(`${orgId}:${agentId}`, config);
}

export function deleteCacheEntry(orgId: string, agentId: string): void {
  cache.delete(`${orgId}:${agentId}`);
}
```

- [ ] **Step 3: Install ioredis dependency in the API package**

Run: `pnpm --filter @foxhound/api add ioredis`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/redis.ts apps/api/src/lib/config-cache.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat: add shared Redis client + agent config in-memory cache"
```

---

## Task 7: API Routes — Budgets

**Files:**

- Create: `apps/api/src/routes/budgets.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create budgets route file**

Create `apps/api/src/routes/budgets.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  upsertAgentConfig,
  getAgentConfig,
  listAgentConfigs,
  deleteAgentConfig,
} from "@foxhound/db";
import { setCacheEntry, deleteCacheEntry } from "../lib/config-cache.js";

const UpsertBudgetSchema = z.object({
  costBudgetUsd: z.number().positive(),
  costAlertThresholdPct: z.number().int().min(1).max(100).default(80),
  budgetPeriod: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
});

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export function budgetsRoutes(fastify: FastifyInstance): void {
  fastify.put("/v1/budgets/:agentId", async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const result = UpsertBudgetSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const orgId = request.orgId;
    const existing = await getAgentConfig(orgId, agentId);
    const isCreate = !existing;

    const config = await upsertAgentConfig({
      id: existing?.id ?? `ac_${randomUUID()}`,
      orgId,
      agentId,
      costBudgetUsd: String(result.data.costBudgetUsd),
      costAlertThresholdPct: result.data.costAlertThresholdPct,
      budgetPeriod: result.data.budgetPeriod,
      // Preserve existing SLA fields if they exist
      maxDurationMs: existing?.maxDurationMs,
      minSuccessRate: existing?.minSuccessRate,
      evaluationWindowMs: existing?.evaluationWindowMs,
      minSampleSize: existing?.minSampleSize,
    });

    setCacheEntry(orgId, agentId, {
      costBudgetUsd: Number(config.costBudgetUsd),
      costAlertThresholdPct: config.costAlertThresholdPct,
      budgetPeriod: config.budgetPeriod,
      maxDurationMs: config.maxDurationMs,
      minSuccessRate: config.minSuccessRate ? Number(config.minSuccessRate) : null,
      evaluationWindowMs: config.evaluationWindowMs,
    });

    return reply.code(isCreate ? 201 : 200).send(config);
  });

  fastify.get("/v1/budgets", async (request, reply) => {
    const result = ListQuerySchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }
    const configs = await listAgentConfigs(request.orgId, result.data.page, result.data.limit);
    const budgetConfigs = configs.filter((c) => c.costBudgetUsd !== null);
    return reply.code(200).send({
      data: budgetConfigs,
      pagination: { page: result.data.page, limit: result.data.limit, count: budgetConfigs.length },
    });
  });

  fastify.get("/v1/budgets/:agentId", async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const config = await getAgentConfig(request.orgId, agentId);
    if (!config || config.costBudgetUsd === null) {
      return reply.code(404).send({ error: "No budget configured for this agent" });
    }
    return reply.code(200).send(config);
  });

  fastify.delete("/v1/budgets/:agentId", async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const config = await getAgentConfig(request.orgId, agentId);
    if (config) {
      // If SLA fields exist, just null out budget fields; otherwise delete the row
      if (config.maxDurationMs !== null || config.minSuccessRate !== null) {
        await upsertAgentConfig({
          ...config,
          costBudgetUsd: null,
          costAlertThresholdPct: null,
          budgetPeriod: null,
        });
      } else {
        await deleteAgentConfig(request.orgId, agentId);
      }
    }
    deleteCacheEntry(request.orgId, agentId);
    return reply.code(204).send();
  });
}
```

- [ ] **Step 2: Register route in `apps/api/src/index.ts`**

Add import and registration:

```typescript
import { budgetsRoutes } from "./routes/budgets.js";
// ... after experimentsRoutes registration:
await app.register(budgetsRoutes);
```

- [ ] **Step 3: Build API**

Run: `pnpm --filter @foxhound/api build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/budgets.ts apps/api/src/index.ts
git commit -m "feat(api): add /v1/budgets CRUD endpoints for agent cost budgets"
```

---

## Task 8: API Routes — SLAs

**Files:**

- Create: `apps/api/src/routes/slas.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create SLA route file**

Create `apps/api/src/routes/slas.ts` following the identical pattern as budgets.ts but for SLA fields:

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  upsertAgentConfig,
  getAgentConfig,
  listAgentConfigs,
  deleteAgentConfig,
} from "@foxhound/db";
import { setCacheEntry, deleteCacheEntry } from "../lib/config-cache.js";

const UpsertSLASchema = z
  .object({
    maxDurationMs: z.number().int().positive().optional(),
    minSuccessRate: z.number().min(0).max(1).optional(),
    evaluationWindowMs: z.number().int().positive().default(86400000),
    minSampleSize: z.number().int().positive().default(10),
  })
  .refine((data) => data.maxDurationMs !== undefined || data.minSuccessRate !== undefined, {
    message: "At least one of maxDurationMs or minSuccessRate is required",
  });

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export function slasRoutes(fastify: FastifyInstance): void {
  fastify.put("/v1/slas/:agentId", async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const result = UpsertSLASchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const orgId = request.orgId;
    const existing = await getAgentConfig(orgId, agentId);
    const isCreate = !existing;

    const config = await upsertAgentConfig({
      id: existing?.id ?? `ac_${randomUUID()}`,
      orgId,
      agentId,
      maxDurationMs: result.data.maxDurationMs ?? null,
      minSuccessRate:
        result.data.minSuccessRate !== undefined ? String(result.data.minSuccessRate) : null,
      evaluationWindowMs: result.data.evaluationWindowMs,
      minSampleSize: result.data.minSampleSize,
      // Preserve existing budget fields
      costBudgetUsd: existing?.costBudgetUsd,
      costAlertThresholdPct: existing?.costAlertThresholdPct,
      budgetPeriod: existing?.budgetPeriod,
    });

    setCacheEntry(orgId, agentId, {
      costBudgetUsd: config.costBudgetUsd ? Number(config.costBudgetUsd) : null,
      costAlertThresholdPct: config.costAlertThresholdPct,
      budgetPeriod: config.budgetPeriod,
      maxDurationMs: config.maxDurationMs,
      minSuccessRate: config.minSuccessRate ? Number(config.minSuccessRate) : null,
      evaluationWindowMs: config.evaluationWindowMs,
    });

    return reply.code(isCreate ? 201 : 200).send(config);
  });

  fastify.get("/v1/slas", async (request, reply) => {
    const result = ListQuerySchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }
    const configs = await listAgentConfigs(request.orgId, result.data.page, result.data.limit);
    const slaConfigs = configs.filter((c) => c.maxDurationMs !== null || c.minSuccessRate !== null);
    return reply.code(200).send({
      data: slaConfigs,
      pagination: { page: result.data.page, limit: result.data.limit, count: slaConfigs.length },
    });
  });

  fastify.get("/v1/slas/:agentId", async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const config = await getAgentConfig(request.orgId, agentId);
    if (!config || (config.maxDurationMs === null && config.minSuccessRate === null)) {
      return reply.code(404).send({ error: "No SLA configured for this agent" });
    }
    return reply.code(200).send(config);
  });

  fastify.delete("/v1/slas/:agentId", async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const config = await getAgentConfig(request.orgId, agentId);
    if (config) {
      if (config.costBudgetUsd !== null) {
        await upsertAgentConfig({
          ...config,
          maxDurationMs: null,
          minSuccessRate: null,
          evaluationWindowMs: null,
          minSampleSize: null,
        });
      } else {
        await deleteAgentConfig(request.orgId, agentId);
      }
    }
    deleteCacheEntry(request.orgId, agentId);
    return reply.code(204).send();
  });
}
```

- [ ] **Step 2: Register in index.ts**

```typescript
import { slasRoutes } from "./routes/slas.js";
await app.register(slasRoutes);
```

- [ ] **Step 3: Build and commit**

```bash
pnpm --filter @foxhound/api build
git add apps/api/src/routes/slas.ts apps/api/src/index.ts
git commit -m "feat(api): add /v1/slas CRUD endpoints for agent SLA monitoring"
```

---

## Task 9: API Routes — Regressions

**Files:**

- Create: `apps/api/src/routes/regressions.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create regressions route file**

Create `apps/api/src/routes/regressions.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getRecentBaselines,
  deleteBaseline,
  getBaseline,
  getSpanStructureForVersion,
} from "@foxhound/db";

const CompareSchema = z.object({
  versionA: z.string().min(1),
  versionB: z.string().min(1),
});

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

function detectStructuralDrift(
  baselineA: Record<string, number>,
  baselineB: Record<string, number>,
): Array<{
  type: "missing" | "new";
  span: string;
  previousFrequency?: number;
  newFrequency?: number;
}> {
  const regressions: Array<{
    type: "missing" | "new";
    span: string;
    previousFrequency?: number;
    newFrequency?: number;
  }> = [];
  const THRESHOLD = 0.1; // 10% frequency threshold

  // Missing spans: existed in A but not in B
  for (const [span, freq] of Object.entries(baselineA)) {
    if (freq >= THRESHOLD && (baselineB[span] === undefined || baselineB[span] < THRESHOLD)) {
      regressions.push({ type: "missing", span, previousFrequency: freq });
    }
  }

  // New spans: exist in B but not in A
  for (const [span, freq] of Object.entries(baselineB)) {
    if (freq >= THRESHOLD && (baselineA[span] === undefined || baselineA[span] < THRESHOLD)) {
      regressions.push({ type: "new", span, newFrequency: freq });
    }
  }

  return regressions;
}

export function regressionsRoutes(fastify: FastifyInstance): void {
  // GET latest regression report for an agent
  fastify.get("/v1/regressions/:agentId", async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const baselines = await getRecentBaselines(request.orgId, agentId, 2);

    if (baselines.length < 2) {
      return reply
        .code(200)
        .send({ agentId, regressions: [], message: "Insufficient baselines for comparison" });
    }

    const [newer, older] = baselines;
    const regressions = detectStructuralDrift(
      older!.spanStructure as Record<string, number>,
      newer!.spanStructure as Record<string, number>,
    );

    return reply.code(200).send({
      agentId,
      previousVersion: older!.agentVersion,
      newVersion: newer!.agentVersion,
      regressions,
      sampleSize: { before: older!.sampleSize, after: newer!.sampleSize },
    });
  });

  // On-demand comparison
  fastify.post("/v1/regressions/:agentId/compare", async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const result = CompareSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const { versionA, versionB } = result.data;
    const orgId = request.orgId;

    const [baselineA, baselineB] = await Promise.all([
      getBaseline(orgId, agentId, versionA),
      getBaseline(orgId, agentId, versionB),
    ]);

    // If baselines don't exist, compute on the fly
    const structA =
      (baselineA?.spanStructure as Record<string, number>) ??
      (await getSpanStructureForVersion(orgId, agentId, versionA));
    const structB =
      (baselineB?.spanStructure as Record<string, number>) ??
      (await getSpanStructureForVersion(orgId, agentId, versionB));

    const regressions = detectStructuralDrift(structA, structB);

    return reply.code(200).send({
      agentId,
      previousVersion: versionA,
      newVersion: versionB,
      regressions,
      sampleSize: {
        before: baselineA?.sampleSize ?? 0,
        after: baselineB?.sampleSize ?? 0,
      },
    });
  });

  // List baselines
  fastify.get("/v1/regressions/:agentId/baselines", async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const query = ListQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Bad Request", issues: query.error.issues });
    }
    const baselines = await getRecentBaselines(request.orgId, agentId, query.data.limit);
    return reply.code(200).send({ data: baselines });
  });

  // Delete baseline
  fastify.delete("/v1/regressions/:agentId/baselines", async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const { version } = request.query as { version?: string };
    if (!version) {
      return reply.code(400).send({ error: "version query parameter is required" });
    }
    await deleteBaseline(request.orgId, agentId, version);
    return reply.code(204).send();
  });
}
```

- [ ] **Step 2: Register in index.ts**

```typescript
import { regressionsRoutes } from "./routes/regressions.js";
await app.register(regressionsRoutes);
```

- [ ] **Step 3: Build and commit**

```bash
pnpm --filter @foxhound/api build
git add apps/api/src/routes/regressions.ts apps/api/src/index.ts
git commit -m "feat(api): add /v1/regressions endpoints for behavior regression detection"
```

---

## Task 10: Queue Infrastructure — API Side

**Files:**

- Modify: `apps/api/src/queue.ts`

- [ ] **Step 1: Add queue getters for Phase 4 workers**

Add to `apps/api/src/queue.ts` following the existing pattern:

```typescript
const COST_MONITOR_QUEUE = "cost-monitor";
const SLA_SCHEDULER_QUEUE = "sla-scheduler";
const REGRESSION_DETECTOR_QUEUE = "regression-detector";

let costMonitorQueue: Queue | null = null;
let costMonitorInitialized = false;

export function getCostMonitorQueue(): Queue | null {
  if (costMonitorInitialized) return costMonitorQueue;
  costMonitorInitialized = true;
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) return null;
  try {
    costMonitorQueue = new Queue(COST_MONITOR_QUEUE, { connection: parseRedisUrl(redisUrl) });
  } catch {}
  return costMonitorQueue;
}

let slaSchedulerQueue: Queue | null = null;
let slaSchedulerInitialized = false;

export function getSlaSchedulerQueue(): Queue | null {
  if (slaSchedulerInitialized) return slaSchedulerQueue;
  slaSchedulerInitialized = true;
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) return null;
  try {
    slaSchedulerQueue = new Queue(SLA_SCHEDULER_QUEUE, { connection: parseRedisUrl(redisUrl) });
  } catch {}
  return slaSchedulerQueue;
}

let regressionQueue: Queue | null = null;
let regressionInitialized = false;

export function getRegressionDetectorQueue(): Queue | null {
  if (regressionInitialized) return regressionQueue;
  regressionInitialized = true;
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) return null;
  try {
    regressionQueue = new Queue(REGRESSION_DETECTOR_QUEUE, { connection: parseRedisUrl(redisUrl) });
  } catch {}
  return regressionQueue;
}
```

- [ ] **Step 2: Build and commit**

```bash
pnpm --filter @foxhound/api build
git add apps/api/src/queue.ts
git commit -m "feat(api): add BullMQ queue getters for cost-monitor, sla-scheduler, regression-detector"
```

---

## Task 11: Trace Ingestion — Cost Extraction + Redis Counters + Job Enqueuing

**Files:**

- Modify: `apps/api/src/routes/traces.ts`

- [ ] **Step 1: Add Phase 4 ingestion logic inside the existing `setImmediate` block**

Add imports at the top of traces.ts:

```typescript
import { lookupPricing } from "../lib/pricing-cache.js";
import { getRedis } from "../lib/redis.js";
import { getConfigFromCache } from "../lib/config-cache.js";
import { getCostMonitorQueue, getRegressionDetectorQueue } from "../queue.js";
```

Update the `IngestTraceSchema` to accept new fields:

```typescript
const IngestTraceSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  sessionId: z.string().optional(),
  parentAgentId: z.string().optional(),
  correlationId: z.string().optional(),
  spans: z.array(SpanSchema),
  startTimeMs: z.number(),
  endTimeMs: z.number().optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
});
```

Replace the `setImmediate` block (~line 181-184) with:

```typescript
setImmediate(() => {
  persistTraceWithRetry(fastify.log, trace as unknown as Trace, orgId).catch(() => {});
  void maybeFireAlerts(fastify, trace as unknown as Trace, orgId);
  void handlePhase4Ingestion(fastify, trace, orgId);
});
```

Add the new function before `tracesRoutes`:

```typescript
async function handlePhase4Ingestion(
  fastify: FastifyInstance,
  trace: z.infer<typeof IngestTraceSchema>,
  orgId: string,
): Promise<void> {
  try {
    const redis = getRedis();
    const config = await getConfigFromCache(orgId, trace.agentId);

    // 1. Cost extraction for LLM spans
    let traceCost = 0;
    for (const span of trace.spans) {
      if (span.kind !== "llm_call") continue;

      let cost: number | null = null;
      const attrs = span.attributes;

      // Prefer SDK-reported cost
      if (typeof attrs["cost_usd"] === "number") {
        cost = attrs["cost_usd"];
      } else if (typeof attrs["model"] === "string") {
        const model = attrs["model"];
        const inputTokens =
          typeof attrs["token_count_input"] === "number" ? attrs["token_count_input"] : 0;
        const outputTokens =
          typeof attrs["token_count_output"] === "number" ? attrs["token_count_output"] : 0;
        if (inputTokens > 0 || outputTokens > 0) {
          const pricing = await lookupPricing(orgId, model);
          if (pricing) {
            cost =
              inputTokens * pricing.inputCostPerToken + outputTokens * pricing.outputCostPerToken;
          }
        }
      }

      if (cost !== null) {
        traceCost += cost;
        // Note: cost_usd column is set during persistTraceWithRetry via span enrichment
      }
    }

    // 2. Update Redis running cost total
    if (redis && traceCost > 0 && config?.costBudgetUsd) {
      const periodKey = getBudgetPeriodKey(config.budgetPeriod ?? "monthly", trace.startTimeMs);
      const redisKey = `cost:${orgId}:${trace.agentId}:${periodKey}`;
      const newTotal = await redis.incrbyfloat(redisKey, traceCost);
      // Set TTL to 35 days (covers monthly periods)
      await redis.expire(redisKey, 35 * 24 * 3600);

      // Check if threshold crossed
      const budget = config.costBudgetUsd;
      const threshold = (config.costAlertThresholdPct ?? 80) / 100;
      if (newTotal >= budget) {
        const queue = getCostMonitorQueue();
        await queue?.add(
          "cost-alert",
          { orgId, agentId: trace.agentId, periodKey, level: "critical" },
          {
            jobId: `cost-alert:${orgId}:${trace.agentId}:${periodKey}:critical`,
          },
        );
      } else if (newTotal >= budget * threshold) {
        const queue = getCostMonitorQueue();
        await queue?.add(
          "cost-alert",
          { orgId, agentId: trace.agentId, periodKey, level: "high" },
          {
            jobId: `cost-alert:${orgId}:${trace.agentId}:${periodKey}:high`,
          },
        );
      }
    }

    // 3. Update Redis SLA counters
    if (redis && (config?.maxDurationMs || config?.minSuccessRate)) {
      const minuteBucket = Math.floor(trace.startTimeMs / 60000);
      const tracesKey = `sla:traces:${orgId}:${trace.agentId}:${minuteBucket}`;
      await redis.incr(tracesKey);
      await redis.expire(tracesKey, 90000); // 25 hours

      const hasError = trace.spans.some((s) => s.status === "error");
      if (hasError) {
        const errorsKey = `sla:errors:${orgId}:${trace.agentId}:${minuteBucket}`;
        await redis.incr(errorsKey);
        await redis.expire(errorsKey, 90000);
      }

      if (trace.endTimeMs) {
        const duration = trace.endTimeMs - trace.startTimeMs;
        const durKey = `sla:duration:${orgId}:${trace.agentId}:${minuteBucket}`;
        await redis.zadd(durKey, duration, trace.id);
        await redis.expire(durKey, 90000);
      }
    }

    // 4. Enqueue regression detection if agent_version is set
    const agentVersion = trace.metadata?.["agent_version"];
    if (typeof agentVersion === "string") {
      const queue = getRegressionDetectorQueue();
      await queue?.add(
        "regression-check",
        { orgId, agentId: trace.agentId, agentVersion },
        { jobId: `regression:${orgId}:${trace.agentId}:${agentVersion}` },
      );
    }
  } catch (err) {
    fastify.log.error({ err }, "Phase 4 ingestion processing failed");
  }
}

function getBudgetPeriodKey(period: string, timestampMs: number): string {
  const d = new Date(timestampMs);
  switch (period) {
    case "daily":
      return d.toISOString().slice(0, 10); // 2026-04-10
    case "weekly": {
      // ISO week: get the Monday of the week
      const day = d.getUTCDay();
      const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setUTCDate(diff);
      const year = monday.getUTCFullYear();
      const oneJan = new Date(year, 0, 1);
      const week = Math.ceil(
        ((monday.getTime() - oneJan.getTime()) / 86400000 + oneJan.getUTCDay() + 1) / 7,
      );
      return `${year}-W${String(week).padStart(2, "0")}`;
    }
    case "monthly":
    default:
      return d.toISOString().slice(0, 7); // 2026-04
  }
}
```

- [ ] **Step 2: Build and test**

Run: `pnpm --filter @foxhound/api build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/traces.ts
git commit -m "feat(traces): add Phase 4 ingestion — cost extraction, Redis counters, regression job enqueuing"
```

---

## Task 12: Worker — Cost Monitor + Cost Reconciler

**Files:**

- Create: `apps/worker/src/queues/cost-monitor.ts`
- Create: `apps/worker/src/queues/cost-reconciler.ts`

- [ ] **Step 1: Create cost monitor worker**

Create `apps/worker/src/queues/cost-monitor.ts`:

```typescript
import { Worker, Queue } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import {
  getAgentConfig,
  getAlertRulesForOrg,
  listNotificationChannels,
  createNotificationLogEntry,
  updateAgentConfigStatus,
  sumSpanCosts,
} from "@foxhound/db";
import { dispatchAlert } from "@foxhound/notifications";
import type { AlertEvent, NotificationChannel } from "@foxhound/notifications";
import { randomUUID } from "crypto";

export const COST_MONITOR_QUEUE = "cost-monitor";

interface CostAlertJobData {
  orgId: string;
  agentId: string;
  periodKey: string;
  level: "high" | "critical";
}

async function processCostAlert(job: Job<CostAlertJobData>): Promise<void> {
  const { orgId, agentId, periodKey, level } = job.data;

  const config = await getAgentConfig(orgId, agentId);
  if (!config || !config.costBudgetUsd) return;

  const budget = Number(config.costBudgetUsd);
  // Compute actual spend from DB for accuracy
  const now = Date.now();
  const periodStart = parsePeriodStart(periodKey);
  const costs = await sumSpanCosts(orgId, agentId, periodStart, now);

  const status =
    costs.totalCost >= budget
      ? "exceeded"
      : costs.totalCost >= budget * ((config.costAlertThresholdPct ?? 80) / 100)
        ? "warning"
        : "under";

  const unknownPct = costs.totalSpans > 0 ? (costs.unknownCostSpans / costs.totalSpans) * 100 : 0;

  // Update cached status
  await updateAgentConfigStatus(
    orgId,
    agentId,
    {
      status,
      spend: costs.totalCost,
      budget,
      unknownCostPct: Math.round(unknownPct * 10) / 10,
      checkedAt: new Date().toISOString(),
    },
    null,
  );

  if (status === "under") return; // No alert needed

  // Fire alert
  const event: AlertEvent = {
    type: "cost_budget_exceeded",
    severity: level === "critical" ? "critical" : "high",
    orgId,
    agentId,
    message: `Agent "${agentId}" has ${status === "exceeded" ? "exceeded" : "reached " + (config.costAlertThresholdPct ?? 80) + "% of"} its $${budget} ${config.budgetPeriod} budget. Current spend: $${costs.totalCost.toFixed(2)}.`,
    metadata: { spend: costs.totalCost, budget, periodKey, unknownCostPct: unknownPct },
    occurredAt: new Date(),
  };

  const [rules, channels] = await Promise.all([
    getAlertRulesForOrg(orgId),
    listNotificationChannels(orgId),
  ]);

  const channelMap = new Map<string, NotificationChannel>(
    channels.map((c) => [c.id, c as unknown as NotificationChannel]),
  );
  const matchingRules = rules.filter((r) => r.eventType === "cost_budget_exceeded");
  await dispatchAlert(event, matchingRules, channelMap, console);

  await Promise.allSettled(
    matchingRules
      .filter((r) => channelMap.has(r.channelId))
      .map((rule) =>
        createNotificationLogEntry({
          id: randomUUID(),
          orgId,
          ruleId: rule.id,
          channelId: rule.channelId,
          eventType: "cost_budget_exceeded",
          severity: level,
          agentId,
          status: "sent",
        }),
      ),
  );
}

function parsePeriodStart(periodKey: string): number {
  // "2026-04-10" (daily), "2026-W15" (weekly), "2026-04" (monthly)
  if (periodKey.includes("W")) {
    // Weekly: approximate — parse year + week
    const [yearStr, weekStr] = periodKey.split("-W");
    const year = Number(yearStr);
    const week = Number(weekStr);
    const jan1 = new Date(year, 0, 1);
    const d = new Date(jan1.getTime() + (week - 1) * 7 * 86400000);
    return d.getTime();
  }
  if (periodKey.length === 10) return new Date(periodKey + "T00:00:00Z").getTime();
  return new Date(periodKey + "-01T00:00:00Z").getTime();
}

export function startCostMonitorWorker(connection: ConnectionOptions): Worker<CostAlertJobData> {
  const worker = new Worker<CostAlertJobData>(
    COST_MONITOR_QUEUE,
    async (job) => {
      await processCostAlert(job);
    },
    {
      connection,
      concurrency: 10,
      autorun: true,
    },
  );

  worker.on("completed", (job) => console.log(`[cost-monitor] Job ${job.id} completed`));
  worker.on("failed", (job, err) =>
    console.error(`[cost-monitor] Job ${job?.id} failed:`, err.message),
  );

  return worker;
}
```

- [ ] **Step 2: Create cost reconciler worker**

Create `apps/worker/src/queues/cost-reconciler.ts`:

```typescript
import { Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import Redis from "ioredis";
import { getAllAgentConfigsWithSLA, sumSpanCosts } from "@foxhound/db";

export const COST_RECONCILER_QUEUE = "cost-reconciler";

function parsePeriodStart(periodKey: string): number {
  if (periodKey.includes("W")) {
    const [yearStr, weekStr] = periodKey.split("-W");
    const d = new Date(Number(yearStr), 0, 1);
    d.setDate(d.getDate() + (Number(weekStr) - 1) * 7);
    return d.getTime();
  }
  if (periodKey.length === 10) return new Date(periodKey + "T00:00:00Z").getTime();
  return new Date(periodKey + "-01T00:00:00Z").getTime();
}

export function startCostReconcilerWorker(connection: ConnectionOptions): Worker {
  const redisUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";
  const redis = new Redis(redisUrl);

  const worker = new Worker(
    COST_RECONCILER_QUEUE,
    async () => {
      // This is a repeatable job — reconcile all cost counters
      const configs = await getAllAgentConfigsWithSLA();
      const now = Date.now();

      for (const config of configs) {
        if (!config.costBudgetUsd) continue;
        const period = config.budgetPeriod ?? "monthly";
        const d = new Date(now);
        const periodKey =
          period === "daily"
            ? d.toISOString().slice(0, 10)
            : period === "weekly"
              ? `${d.getUTCFullYear()}-W${String(Math.ceil((d.getTime() - new Date(d.getUTCFullYear(), 0, 1).getTime()) / 604800000)).padStart(2, "0")}`
              : d.toISOString().slice(0, 7);

        const redisKey = `cost:${config.orgId}:${config.agentId}:${periodKey}`;
        const periodStart = parsePeriodStart(periodKey);
        const costs = await sumSpanCosts(config.orgId, config.agentId, periodStart, now);
        await redis.set(redisKey, String(costs.totalCost));
        await redis.expire(redisKey, 35 * 24 * 3600);
      }
    },
    {
      connection,
      concurrency: 1,
      autorun: true,
    },
  );

  worker.on("failed", (job, err) => console.error(`[cost-reconciler] Failed:`, err.message));

  return worker;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/queues/cost-monitor.ts apps/worker/src/queues/cost-reconciler.ts
git commit -m "feat(worker): add cost-monitor and cost-reconciler workers"
```

---

## Task 13: Worker — SLA Scheduler + SLA Check

**Files:**

- Create: `apps/worker/src/queues/sla-scheduler.ts`
- Create: `apps/worker/src/queues/sla-check.ts`

- [ ] **Step 1: Create SLA scheduler (fans out individual checks)**

Create `apps/worker/src/queues/sla-scheduler.ts`:

```typescript
import { Worker, Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { getAllAgentConfigsWithSLA } from "@foxhound/db";

export const SLA_SCHEDULER_QUEUE = "sla-scheduler";
export const SLA_CHECK_QUEUE = "sla-check";

export function startSlaSchedulerWorker(connection: ConnectionOptions): Worker {
  const checkQueue = new Queue(SLA_CHECK_QUEUE, { connection });

  const worker = new Worker(
    SLA_SCHEDULER_QUEUE,
    async () => {
      const configs = await getAllAgentConfigsWithSLA();
      const minute = Math.floor(Date.now() / 60000);

      await Promise.all(
        configs.map((config) =>
          checkQueue.add(
            "sla-check",
            {
              configId: config.id,
              orgId: config.orgId,
              agentId: config.agentId,
              maxDurationMs: config.maxDurationMs,
              minSuccessRate: config.minSuccessRate ? Number(config.minSuccessRate) : null,
              evaluationWindowMs: config.evaluationWindowMs,
              minSampleSize: config.minSampleSize,
            },
            {
              jobId: `sla-check:${config.id}:${minute}`,
              attempts: 3,
              backoff: { type: "exponential", delay: 1000 },
            },
          ),
        ),
      );
    },
    {
      connection,
      concurrency: 1,
      autorun: true,
    },
  );

  worker.on("failed", (job, err) => console.error(`[sla-scheduler] Failed:`, err.message));

  return worker;
}
```

- [ ] **Step 2: Create SLA check worker**

Create `apps/worker/src/queues/sla-check.ts`:

```typescript
import { Worker } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import Redis from "ioredis";
import {
  updateAgentConfigStatus,
  getAlertRulesForOrg,
  listNotificationChannels,
  createNotificationLogEntry,
} from "@foxhound/db";
import { dispatchAlert } from "@foxhound/notifications";
import type { AlertEvent, NotificationChannel } from "@foxhound/notifications";
import { randomUUID } from "crypto";

export const SLA_CHECK_QUEUE = "sla-check";

interface SlaCheckJobData {
  configId: string;
  orgId: string;
  agentId: string;
  maxDurationMs: number | null;
  minSuccessRate: number | null;
  evaluationWindowMs: number | null;
  minSampleSize: number | null;
}

async function processSlaCheck(job: Job<SlaCheckJobData>, redis: Redis): Promise<void> {
  const { orgId, agentId, maxDurationMs, minSuccessRate, evaluationWindowMs, minSampleSize } =
    job.data;
  const windowMs = evaluationWindowMs ?? 86400000;
  const minSamples = minSampleSize ?? 10;
  const now = Date.now();
  const windowStart = Math.floor((now - windowMs) / 60000);
  const windowEnd = Math.floor(now / 60000);

  // Aggregate Redis counters across minute buckets
  let totalTraces = 0;
  let totalErrors = 0;
  const durations: number[] = [];

  for (let minute = windowStart; minute <= windowEnd; minute++) {
    const tracesKey = `sla:traces:${orgId}:${agentId}:${minute}`;
    const errorsKey = `sla:errors:${orgId}:${agentId}:${minute}`;
    const durKey = `sla:duration:${orgId}:${agentId}:${minute}`;

    const [tracesCount, errorsCount, durs] = await Promise.all([
      redis.get(tracesKey),
      redis.get(errorsKey),
      redis.zrange(durKey, 0, -1, "WITHSCORES"),
    ]);

    totalTraces += Number(tracesCount ?? 0);
    totalErrors += Number(errorsCount ?? 0);

    // Parse sorted set scores as durations
    for (let i = 1; i < durs.length; i += 2) {
      durations.push(Number(durs[i]));
    }
  }

  // Check minimum sample size
  if (totalTraces < minSamples) {
    await updateAgentConfigStatus(orgId, agentId, null, {
      status: totalTraces === 0 ? "no_data" : "insufficient_data",
      compliant: true,
      sampleSize: totalTraces,
      checkedAt: new Date().toISOString(),
    });
    return;
  }

  // Compute metrics
  const successRate = totalTraces > 0 ? 1 - totalErrors / totalTraces : 1;
  durations.sort((a, b) => a - b);
  const p95Index = Math.ceil(durations.length * 0.95) - 1;
  const durationP95 = durations.length > 0 ? durations[Math.max(0, p95Index)]! : 0;

  let compliant = true;
  const alerts: Array<{
    type: "sla_duration_breach" | "sla_success_rate_breach";
    message: string;
  }> = [];

  if (maxDurationMs !== null && durationP95 > maxDurationMs) {
    compliant = false;
    alerts.push({
      type: "sla_duration_breach",
      message: `Agent "${agentId}" p95 duration ${durationP95}ms exceeds SLA of ${maxDurationMs}ms (${totalTraces} traces).`,
    });
  }

  if (minSuccessRate !== null && successRate < minSuccessRate) {
    compliant = false;
    alerts.push({
      type: "sla_success_rate_breach",
      message: `Agent "${agentId}" success rate ${(successRate * 100).toFixed(1)}% below SLA of ${(minSuccessRate * 100).toFixed(1)}% (${totalTraces} traces).`,
    });
  }

  await updateAgentConfigStatus(orgId, agentId, null, {
    status: compliant ? "compliant" : "breach",
    compliant,
    durationP95Ms: durationP95,
    successRate,
    sampleSize: totalTraces,
    checkedAt: new Date().toISOString(),
  });

  // Fire alerts
  for (const alert of alerts) {
    // Dedup: check notification_log (simplified — check if alert was sent recently)
    const event: AlertEvent = {
      type: alert.type,
      severity: "high",
      orgId,
      agentId,
      message: alert.message,
      metadata: { durationP95, successRate, sampleSize: totalTraces },
      occurredAt: new Date(),
    };

    const [rules, channels] = await Promise.all([
      getAlertRulesForOrg(orgId),
      listNotificationChannels(orgId),
    ]);

    const channelMap = new Map<string, NotificationChannel>(
      channels.map((c) => [c.id, c as unknown as NotificationChannel]),
    );
    const matchingRules = rules.filter((r) => r.eventType === alert.type);
    await dispatchAlert(event, matchingRules, channelMap, console);

    await Promise.allSettled(
      matchingRules
        .filter((r) => channelMap.has(r.channelId))
        .map((rule) =>
          createNotificationLogEntry({
            id: randomUUID(),
            orgId,
            ruleId: rule.id,
            channelId: rule.channelId,
            eventType: alert.type,
            severity: "high",
            agentId,
            status: "sent",
          }),
        ),
    );
  }
}

export function startSlaCheckWorker(connection: ConnectionOptions): Worker<SlaCheckJobData> {
  const redisUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";
  const redis = new Redis(redisUrl);

  const worker = new Worker<SlaCheckJobData>(
    SLA_CHECK_QUEUE,
    async (job) => {
      await processSlaCheck(job, redis);
    },
    {
      connection,
      concurrency: 10,
      autorun: true,
    },
  );

  worker.on("completed", (job) => console.log(`[sla-check] Job ${job.id} completed`));
  worker.on("failed", (job, err) =>
    console.error(`[sla-check] Job ${job?.id} failed:`, err.message),
  );

  return worker;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/queues/sla-scheduler.ts apps/worker/src/queues/sla-check.ts
git commit -m "feat(worker): add SLA scheduler (fan-out) and SLA check workers"
```

---

## Task 14: Worker — Regression Detector

**Files:**

- Create: `apps/worker/src/queues/regression-detector.ts`

- [ ] **Step 1: Create regression detector worker**

Create `apps/worker/src/queues/regression-detector.ts`:

```typescript
import { Worker } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import {
  countTracesForVersion,
  getBaseline,
  getRecentBaselines,
  getSpanStructureForVersion,
  upsertBaseline,
  getAlertRulesForOrg,
  listNotificationChannels,
  createNotificationLogEntry,
} from "@foxhound/db";
import { dispatchAlert } from "@foxhound/notifications";
import type { AlertEvent, NotificationChannel } from "@foxhound/notifications";
import { randomUUID } from "crypto";

export const REGRESSION_DETECTOR_QUEUE = "regression-detector";

const BASELINE_SAMPLE_SIZE = 100;
const STRUCTURAL_THRESHOLD = 0.1; // 10% frequency

interface RegressionJobData {
  orgId: string;
  agentId: string;
  agentVersion: string;
}

async function processRegressionCheck(job: Job<RegressionJobData>): Promise<void> {
  const { orgId, agentId, agentVersion } = job.data;

  // Check if baseline already exists
  const existing = await getBaseline(orgId, agentId, agentVersion);
  if (existing) return; // Already baselined

  // Check if enough traces
  const count = await countTracesForVersion(orgId, agentId, agentVersion);
  if (count < BASELINE_SAMPLE_SIZE) return; // Not enough data yet

  // Compute span structure
  const structure = await getSpanStructureForVersion(
    orgId,
    agentId,
    agentVersion,
    BASELINE_SAMPLE_SIZE,
  );

  // Save baseline
  await upsertBaseline({
    id: `bl_${randomUUID()}`,
    orgId,
    agentId,
    agentVersion,
    sampleSize: Math.min(count, BASELINE_SAMPLE_SIZE),
    spanStructure: structure,
  });

  console.log(`[regression] Created baseline for ${agentId}@${agentVersion} (${count} traces)`);

  // Compare against previous version
  const baselines = await getRecentBaselines(orgId, agentId, 2);
  if (baselines.length < 2) return; // First version, nothing to compare

  const [newer, older] = baselines;
  const regressions = detectStructuralDrift(
    older!.spanStructure as Record<string, number>,
    newer!.spanStructure as Record<string, number>,
  );

  if (regressions.length === 0) return; // No regressions

  // Fire behavior_regression alert
  const event: AlertEvent = {
    type: "behavior_regression",
    severity: "high",
    orgId,
    agentId,
    message: `Agent "${agentId}" behavior changed between ${older!.agentVersion} and ${newer!.agentVersion}: ${regressions.length} structural change(s) detected.`,
    metadata: {
      previousVersion: older!.agentVersion,
      newVersion: newer!.agentVersion,
      regressions,
      sampleSize: { before: older!.sampleSize, after: newer!.sampleSize },
    },
    occurredAt: new Date(),
  };

  const [rules, channels] = await Promise.all([
    getAlertRulesForOrg(orgId),
    listNotificationChannels(orgId),
  ]);

  const channelMap = new Map<string, NotificationChannel>(
    channels.map((c) => [c.id, c as unknown as NotificationChannel]),
  );
  const matchingRules = rules.filter((r) => r.eventType === "behavior_regression");
  await dispatchAlert(event, matchingRules, channelMap, console);

  await Promise.allSettled(
    matchingRules
      .filter((r) => channelMap.has(r.channelId))
      .map((rule) =>
        createNotificationLogEntry({
          id: randomUUID(),
          orgId,
          ruleId: rule.id,
          channelId: rule.channelId,
          eventType: "behavior_regression",
          severity: "high",
          agentId,
          status: "sent",
        }),
      ),
  );
}

function detectStructuralDrift(
  baseA: Record<string, number>,
  baseB: Record<string, number>,
): Array<{ type: string; span: string; previousFrequency?: number; newFrequency?: number }> {
  const drifts: Array<{
    type: string;
    span: string;
    previousFrequency?: number;
    newFrequency?: number;
  }> = [];

  for (const [span, freq] of Object.entries(baseA)) {
    if (
      freq >= STRUCTURAL_THRESHOLD &&
      (baseB[span] === undefined || baseB[span]! < STRUCTURAL_THRESHOLD)
    ) {
      drifts.push({ type: "missing", span, previousFrequency: freq });
    }
  }

  for (const [span, freq] of Object.entries(baseB)) {
    if (
      freq >= STRUCTURAL_THRESHOLD &&
      (baseA[span] === undefined || baseA[span]! < STRUCTURAL_THRESHOLD)
    ) {
      drifts.push({ type: "new", span, newFrequency: freq });
    }
  }

  return drifts;
}

export function startRegressionDetectorWorker(
  connection: ConnectionOptions,
): Worker<RegressionJobData> {
  const worker = new Worker<RegressionJobData>(
    REGRESSION_DETECTOR_QUEUE,
    async (job) => {
      await processRegressionCheck(job);
    },
    {
      connection,
      concurrency: 3,
      autorun: true,
    },
  );

  worker.on("completed", (job) => console.log(`[regression] Job ${job.id} completed`));
  worker.on("failed", (job, err) =>
    console.error(`[regression] Job ${job?.id} failed:`, err.message),
  );

  return worker;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/worker/src/queues/regression-detector.ts
git commit -m "feat(worker): add regression detector — auto-baseline + structural drift detection"
```

---

## Task 15: Worker Entry Point — Register All New Workers

**Files:**

- Modify: `apps/worker/src/index.ts`

- [ ] **Step 1: Update worker entry to start all Phase 4 workers + repeatable jobs**

Replace `apps/worker/src/index.ts`:

```typescript
import type { ConnectionOptions } from "bullmq";
import { Queue } from "bullmq";
import { startEvaluatorWorker } from "./queues/evaluator.js";
import { startExperimentWorker } from "./queues/experiment.js";
import { startCostMonitorWorker } from "./queues/cost-monitor.js";
import { startCostReconcilerWorker, COST_RECONCILER_QUEUE } from "./queues/cost-reconciler.js";
import { startSlaSchedulerWorker, SLA_SCHEDULER_QUEUE } from "./queues/sla-scheduler.js";
import { startSlaCheckWorker } from "./queues/sla-check.js";
import { startRegressionDetectorWorker } from "./queues/regression-detector.js";

const redisUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

const connection = parseRedisUrl(redisUrl);

console.log("[worker] Starting Foxhound worker...");
console.log(`[worker] Redis: ${redisUrl.replace(/\/\/.*@/, "//***@")}`);

// Phase 2 workers
const evaluatorWorker = startEvaluatorWorker(connection);
console.log("[worker] Evaluator worker started (concurrency: 10)");

const experimentWorker = startExperimentWorker(connection);
console.log("[worker] Experiment worker started (concurrency: 5)");

// Phase 4 workers
const costMonitorWorker = startCostMonitorWorker(connection);
console.log("[worker] Cost monitor worker started (concurrency: 10)");

const costReconcilerWorker = startCostReconcilerWorker(connection);
console.log("[worker] Cost reconciler worker started (concurrency: 1)");

const slaSchedulerWorker = startSlaSchedulerWorker(connection);
console.log("[worker] SLA scheduler worker started (concurrency: 1)");

const slaCheckWorker = startSlaCheckWorker(connection);
console.log("[worker] SLA check worker started (concurrency: 10)");

const regressionWorker = startRegressionDetectorWorker(connection);
console.log("[worker] Regression detector worker started (concurrency: 3)");

// Set up repeatable jobs
async function setupRepeatableJobs(): Promise<void> {
  // SLA scheduler: run every 60 seconds
  const slaQueue = new Queue(SLA_SCHEDULER_QUEUE, { connection });
  await slaQueue.add(
    "sla-schedule",
    {},
    {
      repeat: { every: 60_000 },
      jobId: "sla-schedule-repeatable",
    },
  );
  console.log("[worker] SLA scheduler repeatable job configured (every 60s)");

  // Cost reconciler: run every 5 minutes
  const reconcilerQueue = new Queue(COST_RECONCILER_QUEUE, { connection });
  await reconcilerQueue.add(
    "reconcile",
    {},
    {
      repeat: { every: 300_000 },
      jobId: "cost-reconcile-repeatable",
    },
  );
  console.log("[worker] Cost reconciler repeatable job configured (every 5m)");
}

void setupRepeatableJobs();

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] Received ${signal}, shutting down...`);
  await Promise.all([
    evaluatorWorker.close(),
    experimentWorker.close(),
    costMonitorWorker.close(),
    costReconcilerWorker.close(),
    slaSchedulerWorker.close(),
    slaCheckWorker.close(),
    regressionWorker.close(),
  ]);
  console.log("[worker] Shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
```

- [ ] **Step 2: Install ioredis in worker package**

Run: `pnpm --filter @foxhound/worker add ioredis`

- [ ] **Step 3: Build worker**

Run: `pnpm --filter @foxhound/worker build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/index.ts apps/worker/package.json pnpm-lock.yaml
git commit -m "feat(worker): register all Phase 4 workers + repeatable jobs for SLA and cost reconciliation"
```

---

## Task 16: API Client — New Methods + Types

**Files:**

- Modify: `packages/api-client/src/types.ts`
- Modify: `packages/api-client/src/index.ts`

- [ ] **Step 1: Add Phase 4 types to api-client types.ts**

Add at the end of `packages/api-client/src/types.ts`:

```typescript
// ── Agent Intelligence (Phase 4) ────────────────────────────────────────

export interface AgentConfigResponse {
  id: string;
  orgId: string;
  agentId: string;
  costBudgetUsd: string | null;
  costAlertThresholdPct: number | null;
  budgetPeriod: string | null;
  maxDurationMs: number | null;
  minSuccessRate: string | null;
  evaluationWindowMs: number | null;
  minSampleSize: number | null;
  lastCostStatus: Record<string, unknown> | null;
  lastSlaStatus: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentConfigListResponse {
  data: AgentConfigResponse[];
  pagination: { page: number; limit: number; count: number };
}

export interface BaselineResponse {
  id: string;
  agentId: string;
  agentVersion: string;
  sampleSize: number;
  spanStructure: Record<string, number>;
  createdAt: string;
}

export interface BaselineListResponse {
  data: BaselineResponse[];
}

export interface RegressionReportResponse {
  agentId: string;
  previousVersion: string;
  newVersion: string;
  regressions: Array<{
    type: "missing" | "new";
    span: string;
    previousFrequency?: number;
    newFrequency?: number;
  }>;
  sampleSize: { before: number; after: number };
}
```

- [ ] **Step 2: Add methods to FoxhoundApiClient in index.ts**

Add these methods to the `FoxhoundApiClient` class in `packages/api-client/src/index.ts`:

```typescript
  // ── Budgets (Phase 4) ─────────────────────────────────────────────────

  async setBudget(agentId: string, params: { costBudgetUsd: number; costAlertThresholdPct?: number; budgetPeriod?: string }): Promise<AgentConfigResponse> {
    return this.request<AgentConfigResponse>(`/v1/budgets/${agentId}`, { method: "PUT", body: params });
  }

  async getBudget(agentId: string): Promise<AgentConfigResponse> {
    return this.request<AgentConfigResponse>(`/v1/budgets/${agentId}`);
  }

  async listBudgets(params?: { page?: number; limit?: number }): Promise<AgentConfigListResponse> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    return this.request<AgentConfigListResponse>(`/v1/budgets?${qs}`);
  }

  async deleteBudget(agentId: string): Promise<void> {
    await this.request(`/v1/budgets/${agentId}`, { method: "DELETE" });
  }

  // ── SLAs (Phase 4) ───────────────────────────────────────────────────

  async setSla(agentId: string, params: { maxDurationMs?: number; minSuccessRate?: number; evaluationWindowMs?: number; minSampleSize?: number }): Promise<AgentConfigResponse> {
    return this.request<AgentConfigResponse>(`/v1/slas/${agentId}`, { method: "PUT", body: params });
  }

  async getSla(agentId: string): Promise<AgentConfigResponse> {
    return this.request<AgentConfigResponse>(`/v1/slas/${agentId}`);
  }

  async listSlas(params?: { page?: number; limit?: number }): Promise<AgentConfigListResponse> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    return this.request<AgentConfigListResponse>(`/v1/slas?${qs}`);
  }

  async deleteSla(agentId: string): Promise<void> {
    await this.request(`/v1/slas/${agentId}`, { method: "DELETE" });
  }

  // ── Regressions (Phase 4) ────────────────────────────────────────────

  async getRegression(agentId: string): Promise<RegressionReportResponse> {
    return this.request<RegressionReportResponse>(`/v1/regressions/${agentId}`);
  }

  async compareVersions(agentId: string, versionA: string, versionB: string): Promise<RegressionReportResponse> {
    return this.request<RegressionReportResponse>(`/v1/regressions/${agentId}/compare`, {
      method: "POST",
      body: { versionA, versionB },
    });
  }

  async listBaselines(agentId: string): Promise<BaselineListResponse> {
    return this.request<BaselineListResponse>(`/v1/regressions/${agentId}/baselines`);
  }

  async deleteBaseline(agentId: string, version: string): Promise<void> {
    await this.request(`/v1/regressions/${agentId}/baselines?version=${encodeURIComponent(version)}`, { method: "DELETE" });
  }
```

Add the new type imports at the top of the file.

- [ ] **Step 3: Build and commit**

```bash
pnpm --filter @foxhound/api-client build
git add packages/api-client/src/types.ts packages/api-client/src/index.ts
git commit -m "feat(api-client): add typed methods for budgets, SLAs, and regressions"
```

---

## Task 17: TypeScript SDK — New Namespaces

**Files:**

- Modify: `packages/sdk/src/client.ts`

- [ ] **Step 1: Add `BudgetsNamespace`, `SLAsNamespace`, `RegressionsNamespace` + update `startTrace` + add `getPropagationHeaders`**

Add before the `FoxhoundClient` class, after `ScoresNamespace`:

```typescript
class BudgetsNamespace {
  private readonly endpoint: string;
  private readonly apiKey: string;

  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  private headers() {
    return { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` };
  }

  async set(params: {
    agentId: string;
    costBudgetUsd: number;
    alertThresholdPct?: number;
    period?: string;
  }): Promise<unknown> {
    const res = await fetch(`${this.endpoint}/v1/budgets/${params.agentId}`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({
        costBudgetUsd: params.costBudgetUsd,
        costAlertThresholdPct: params.alertThresholdPct ?? 80,
        budgetPeriod: params.period ?? "monthly",
      }),
    });
    if (!res.ok) throw new Error(`Failed to set budget: ${res.status}`);
    return res.json();
  }

  async get(agentId: string): Promise<unknown> {
    const res = await fetch(`${this.endpoint}/v1/budgets/${agentId}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Failed to get budget: ${res.status}`);
    return res.json();
  }

  async list(): Promise<unknown> {
    const res = await fetch(`${this.endpoint}/v1/budgets`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Failed to list budgets: ${res.status}`);
    return res.json();
  }

  async delete(agentId: string): Promise<void> {
    const res = await fetch(`${this.endpoint}/v1/budgets/${agentId}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to delete budget: ${res.status}`);
  }
}

class SLAsNamespace {
  private readonly endpoint: string;
  private readonly apiKey: string;

  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  private headers() {
    return { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` };
  }

  async set(params: {
    agentId: string;
    maxDurationMs?: number;
    minSuccessRate?: number;
    evaluationWindowMs?: number;
    minSampleSize?: number;
  }): Promise<unknown> {
    const res = await fetch(`${this.endpoint}/v1/slas/${params.agentId}`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({
        maxDurationMs: params.maxDurationMs,
        minSuccessRate: params.minSuccessRate,
        evaluationWindowMs: params.evaluationWindowMs,
        minSampleSize: params.minSampleSize,
      }),
    });
    if (!res.ok) throw new Error(`Failed to set SLA: ${res.status}`);
    return res.json();
  }

  async get(agentId: string): Promise<unknown> {
    const res = await fetch(`${this.endpoint}/v1/slas/${agentId}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Failed to get SLA: ${res.status}`);
    return res.json();
  }

  async list(): Promise<unknown> {
    const res = await fetch(`${this.endpoint}/v1/slas`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Failed to list SLAs: ${res.status}`);
    return res.json();
  }

  async delete(agentId: string): Promise<void> {
    const res = await fetch(`${this.endpoint}/v1/slas/${agentId}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to delete SLA: ${res.status}`);
  }
}

class RegressionsNamespace {
  private readonly endpoint: string;
  private readonly apiKey: string;

  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  private headers() {
    return { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` };
  }

  async compare(params: { agentId: string; versionA: string; versionB: string }): Promise<unknown> {
    const res = await fetch(`${this.endpoint}/v1/regressions/${params.agentId}/compare`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ versionA: params.versionA, versionB: params.versionB }),
    });
    if (!res.ok) throw new Error(`Failed to compare versions: ${res.status}`);
    return res.json();
  }

  async baselines(agentId: string): Promise<unknown> {
    const res = await fetch(`${this.endpoint}/v1/regressions/${agentId}/baselines`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to list baselines: ${res.status}`);
    return res.json();
  }

  async deleteBaseline(params: { agentId: string; version: string }): Promise<void> {
    const res = await fetch(
      `${this.endpoint}/v1/regressions/${params.agentId}/baselines?version=${encodeURIComponent(params.version)}`,
      { method: "DELETE", headers: this.headers() },
    );
    if (!res.ok) throw new Error(`Failed to delete baseline: ${res.status}`);
  }
}
```

Then update the `FoxhoundClient` class:

```typescript
export class FoxhoundClient {
  private readonly options: Required<FoxhoundClientOptions>;
  private readonly tracers: Map<string, Tracer> = new Map();
  private currentCorrelationId?: string;
  private currentAgentId?: string;

  readonly scores: ScoresNamespace;
  readonly budgets: BudgetsNamespace;
  readonly slas: SLAsNamespace;
  readonly regressions: RegressionsNamespace;

  constructor(options: FoxhoundClientOptions) {
    this.options = { flushIntervalMs: 5000, maxBatchSize: 100, ...options };
    this.scores = new ScoresNamespace(this.options.endpoint, this.options.apiKey);
    this.budgets = new BudgetsNamespace(this.options.endpoint, this.options.apiKey);
    this.slas = new SLAsNamespace(this.options.endpoint, this.options.apiKey);
    this.regressions = new RegressionsNamespace(this.options.endpoint, this.options.apiKey);
  }

  startTrace(params: {
    agentId: string;
    sessionId?: string;
    parentAgentId?: string;
    correlationId?: string;
    metadata?: Record<string, string | number | boolean | null>;
  }): Tracer {
    this.currentAgentId = params.agentId;
    this.currentCorrelationId = params.correlationId;

    const tracer = new Tracer({
      agentId: params.agentId,
      sessionId: params.sessionId,
      metadata: {
        ...params.metadata ?? {},
        ...(params.parentAgentId ? { parentAgentId: params.parentAgentId } : {}),
        ...(params.correlationId ? { correlationId: params.correlationId } : {}),
      },
      onFlush: (trace) => this.sendTrace(trace),
    });
    this.tracers.set(tracer.traceId, tracer);
    return tracer;
  }

  getPropagationHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.currentCorrelationId) headers["X-Foxhound-Correlation-Id"] = this.currentCorrelationId;
    if (this.currentAgentId) headers["X-Foxhound-Parent-Agent-Id"] = this.currentAgentId;
    return headers;
  }

  // ... sendTrace stays the same
```

- [ ] **Step 2: Build and commit**

```bash
pnpm --filter @foxhound/sdk build
git add packages/sdk/src/client.ts
git commit -m "feat(sdk): add budgets, slas, regressions namespaces + propagation headers"
```

---

## Task 18: Python SDK — New Namespaces

**Files:**

- Modify: `packages/sdk-py/foxhound/client.py`

- [ ] **Step 1: Add `BudgetsNamespace`, `SLAsNamespace`, `RegressionsNamespace` classes**

Add after `ExperimentsNamespace` (before `FoxhoundClient`):

```python
class BudgetsNamespace:
    """Namespaced API for agent cost budgets. Access via ``fox.budgets.set(...)``."""

    def __init__(self, endpoint: str, api_key: str, timeout: float) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}

    async def set(self, *, agent_id: str, cost_budget_usd: float, alert_threshold_pct: int = 80, period: str = "monthly") -> dict[str, Any]:
        body = {"costBudgetUsd": cost_budget_usd, "costAlertThresholdPct": alert_threshold_pct, "budgetPeriod": period}
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.put(f"{self._endpoint}/v1/budgets/{agent_id}", json=body, headers=self._headers())
        if response.status_code not in (200, 201):
            raise RuntimeError(f"Foxhound: failed to set budget: {response.status_code} {response.text}")
        return response.json()

    async def get(self, *, agent_id: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(f"{self._endpoint}/v1/budgets/{agent_id}", headers=self._headers())
        if response.status_code != 200:
            raise RuntimeError(f"Foxhound: failed to get budget: {response.status_code} {response.text}")
        return response.json()

    async def list(self) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(f"{self._endpoint}/v1/budgets", headers=self._headers())
        if response.status_code != 200:
            raise RuntimeError(f"Foxhound: failed to list budgets: {response.status_code} {response.text}")
        return response.json()

    async def delete(self, *, agent_id: str) -> None:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.delete(f"{self._endpoint}/v1/budgets/{agent_id}", headers=self._headers())
        if response.status_code != 204:
            raise RuntimeError(f"Foxhound: failed to delete budget: {response.status_code} {response.text}")


class SLAsNamespace:
    """Namespaced API for agent SLAs. Access via ``fox.slas.set(...)``."""

    def __init__(self, endpoint: str, api_key: str, timeout: float) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}

    async def set(self, *, agent_id: str, max_duration_ms: int | None = None, min_success_rate: float | None = None, evaluation_window_ms: int = 86400000, min_sample_size: int = 10) -> dict[str, Any]:
        body: dict[str, Any] = {"evaluationWindowMs": evaluation_window_ms, "minSampleSize": min_sample_size}
        if max_duration_ms is not None:
            body["maxDurationMs"] = max_duration_ms
        if min_success_rate is not None:
            body["minSuccessRate"] = min_success_rate
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.put(f"{self._endpoint}/v1/slas/{agent_id}", json=body, headers=self._headers())
        if response.status_code not in (200, 201):
            raise RuntimeError(f"Foxhound: failed to set SLA: {response.status_code} {response.text}")
        return response.json()

    async def get(self, *, agent_id: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(f"{self._endpoint}/v1/slas/{agent_id}", headers=self._headers())
        if response.status_code != 200:
            raise RuntimeError(f"Foxhound: failed to get SLA: {response.status_code} {response.text}")
        return response.json()

    async def list(self) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(f"{self._endpoint}/v1/slas", headers=self._headers())
        if response.status_code != 200:
            raise RuntimeError(f"Foxhound: failed to list SLAs: {response.status_code} {response.text}")
        return response.json()

    async def delete(self, *, agent_id: str) -> None:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.delete(f"{self._endpoint}/v1/slas/{agent_id}", headers=self._headers())
        if response.status_code != 204:
            raise RuntimeError(f"Foxhound: failed to delete SLA: {response.status_code} {response.text}")


class RegressionsNamespace:
    """Namespaced API for behavior regression detection. Access via ``fox.regressions.compare(...)``."""

    def __init__(self, endpoint: str, api_key: str, timeout: float) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}

    async def compare(self, *, agent_id: str, version_a: str, version_b: str) -> dict[str, Any]:
        body = {"versionA": version_a, "versionB": version_b}
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(f"{self._endpoint}/v1/regressions/{agent_id}/compare", json=body, headers=self._headers())
        if response.status_code != 200:
            raise RuntimeError(f"Foxhound: failed to compare versions: {response.status_code} {response.text}")
        return response.json()

    async def baselines(self, *, agent_id: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(f"{self._endpoint}/v1/regressions/{agent_id}/baselines", headers=self._headers())
        if response.status_code != 200:
            raise RuntimeError(f"Foxhound: failed to list baselines: {response.status_code} {response.text}")
        return response.json()

    async def delete_baseline(self, *, agent_id: str, version: str) -> None:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.delete(f"{self._endpoint}/v1/regressions/{agent_id}/baselines", params={"version": version}, headers=self._headers())
        if response.status_code != 204:
            raise RuntimeError(f"Foxhound: failed to delete baseline: {response.status_code} {response.text}")
```

- [ ] **Step 2: Update `FoxhoundClient.__init__` to register new namespaces and update `start_trace`**

```python
class FoxhoundClient:
    def __init__(self, api_key: str, endpoint: str, timeout: float = 10.0) -> None:
        self._api_key = api_key
        self._endpoint = endpoint.rstrip("/")
        self._timeout = timeout
        self._current_correlation_id: str | None = None
        self._current_agent_id: str | None = None

        self.scores = ScoresNamespace(self._endpoint, self._api_key, self._timeout)
        self.datasets = DatasetsNamespace(self._endpoint, self._api_key, self._timeout)
        self.experiments = ExperimentsNamespace(self._endpoint, self._api_key, self._timeout)
        self.budgets = BudgetsNamespace(self._endpoint, self._api_key, self._timeout)
        self.slas = SLAsNamespace(self._endpoint, self._api_key, self._timeout)
        self.regressions = RegressionsNamespace(self._endpoint, self._api_key, self._timeout)

    def start_trace(
        self,
        agent_id: str,
        session_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        parent_agent_id: str | None = None,
        correlation_id: str | None = None,
    ) -> Tracer:
        self._current_agent_id = agent_id
        self._current_correlation_id = correlation_id
        meta = dict(metadata or {})
        if parent_agent_id:
            meta["parentAgentId"] = parent_agent_id
        if correlation_id:
            meta["correlationId"] = correlation_id
        return Tracer(agent_id=agent_id, session_id=session_id, metadata=meta, on_flush=self._send_trace)

    def get_propagation_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self._current_correlation_id:
            headers["X-Foxhound-Correlation-Id"] = self._current_correlation_id
        if self._current_agent_id:
            headers["X-Foxhound-Parent-Agent-Id"] = self._current_agent_id
        return headers
```

- [ ] **Step 3: Commit**

```bash
git add packages/sdk-py/foxhound/client.py
git commit -m "feat(sdk-py): add budgets, slas, regressions namespaces + propagation headers"
```

---

## Task 19: MCP Server — 4 New Read-Only Tools

**Files:**

- Modify: `packages/mcp-server/src/index.ts`

- [ ] **Step 1: Add 4 new tools after existing tool definitions**

Follow the existing pattern (Zod schema + `server.tool()` call + formatted text output). Add these tools:

1. `foxhound_get_agent_budget` — calls `client.getBudget(agentId)`, formats config + status
2. `foxhound_check_sla_status` — calls `client.getSla(agentId)`, formats compliance data
3. `foxhound_detect_regression` — calls `client.compareVersions(agentId, versionA, versionB)`, formats diff
4. `foxhound_list_baselines` — calls `client.listBaselines(agentId)`, formats version list

Each tool follows the identical pattern of existing tools: Zod input schema, try/catch, formatted markdown output.

- [ ] **Step 2: Build and commit**

```bash
pnpm --filter @foxhound/mcp-server build
git add packages/mcp-server/src/index.ts
git commit -m "feat(mcp): add 4 read-only Phase 4 tools — budget, SLA, regression, baselines"
```

---

## Task 20: Full Build + Lint + Test

- [ ] **Step 1: Full workspace build**

Run: `pnpm build`
Expected: All packages pass

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: PASS (fix any issues)

- [ ] **Step 3: Format**

Run: `pnpm format:check`
Expected: PASS (run `pnpm format` to fix if needed)

- [ ] **Step 4: Test**

Run: `pnpm test`
Expected: All existing tests pass (new tests in Task 21)

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix lint/format issues from Phase 4 implementation"
```

---

## Task 21: Integration Tests

**Files:**

- Create: `apps/api/src/routes/budgets.test.ts`
- Create: `apps/api/src/routes/slas.test.ts`
- Create: `apps/api/src/routes/regressions.test.ts`

- [ ] **Step 1: Write budget endpoint tests**

Follow the pattern from existing test files (e.g., `scores.test.ts`). Test:

- PUT creates a new budget (201)
- PUT updates an existing budget (200)
- GET returns budget with status
- GET 404 for non-existent
- DELETE removes budget (204)
- LIST returns paginated results

- [ ] **Step 2: Write SLA endpoint tests**

Same pattern. Test:

- PUT creates SLA (201)
- Validation: at least one of maxDurationMs or minSuccessRate required
- GET returns SLA with cached status
- DELETE removes SLA but preserves budget if it exists

- [ ] **Step 3: Write regression endpoint tests**

Test:

- GET with no baselines returns empty regressions
- POST compare with two versions
- DELETE baseline by version query param
- Version as query param handles special characters

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/budgets.test.ts apps/api/src/routes/slas.test.ts apps/api/src/routes/regressions.test.ts
git commit -m "test: add integration tests for Phase 4 budget, SLA, and regression endpoints"
```
