# Phase 3: Datasets & Experiments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "eval from traces" differentiator — production failures become test cases automatically, and experiments run prompt variants with auto-scoring and side-by-side comparison.

**Architecture:** Four new database tables (datasets, dataset_items, experiments, experiment_runs) follow established Drizzle ORM patterns. Datasets support both manual item creation and auto-curation from production traces filtered by score. Experiments run asynchronously on the existing BullMQ worker, auto-scoring each run via configured evaluators. A dedicated experiment-comparisons resource enables side-by-side results. Full lineage is preserved: trace -> dataset item -> experiment run -> score.

**Tech Stack:** Drizzle ORM, Fastify, Zod, BullMQ, Vitest, httpx (Python SDK)

---

## File Map

| File                                                | Action | Responsibility                                                                       |
| --------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| `packages/db/src/schema.ts`                         | Modify | Add datasets, datasetItems, experiments, experimentRuns tables                       |
| `packages/db/drizzle/0007_datasets_experiments.sql` | Create | SQL migration for the 4 new tables + indexes                                         |
| `packages/db/src/queries.ts`                        | Modify | Add CRUD + query functions for datasets, dataset items, experiments, experiment runs |
| `packages/types/src/index.ts`                       | Modify | Add Dataset, DatasetItem, Experiment, ExperimentRun, ExperimentStatus types          |
| `apps/api/src/routes/datasets.ts`                   | Create | Dataset and dataset item CRUD + from-traces auto-curation                            |
| `apps/api/src/routes/datasets.test.ts`              | Create | Route tests for datasets                                                             |
| `apps/api/src/routes/experiments.ts`                | Create | Experiment CRUD + experiment-comparisons endpoint                                    |
| `apps/api/src/routes/experiments.test.ts`           | Create | Route tests for experiments                                                          |
| `apps/api/src/index.ts`                             | Modify | Register datasetsRoutes and experimentsRoutes                                        |
| `apps/api/src/queue.ts`                             | Modify | Add experiment queue getter                                                          |
| `apps/worker/src/queues/experiment.ts`              | Create | Experiment runner worker — executes dataset items and auto-scores                    |
| `apps/worker/src/index.ts`                          | Modify | Start experiment worker alongside evaluator worker                                   |
| `packages/api-client/src/types.ts`                  | Modify | Add Dataset/Experiment response types                                                |
| `packages/api-client/src/index.ts`                  | Modify | Add dataset and experiment client methods                                            |
| `packages/sdk-py/foxhound/client.py`                | Modify | Add DatasetsNamespace and ExperimentsNamespace                                       |

---

### Task 1: Add Phase 3 Types

**Files:**

- Modify: `packages/types/src/index.ts:123`

- [ ] **Step 1: Write failing type import test**

Create a temporary check that the new types exist. In your terminal:

```bash
cd /Users/caleb.love/Developer/Foxhound && npx tsc --noEmit -p packages/types/tsconfig.json 2>&1 | head -5
```

Expected: PASS (baseline — no errors yet)

- [ ] **Step 2: Add Dataset, DatasetItem, Experiment, ExperimentRun types**

Append to `packages/types/src/index.ts` after the `AnnotationQueueItem` interface (line 123):

```typescript
// ── Dataset & Experiment types ────────────────────────────────────────────

export interface Dataset {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface DatasetItem {
  id: string;
  datasetId: string;
  input: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  sourceTraceId?: string;
  createdAt: string;
}

export type ExperimentStatus = "pending" | "running" | "completed" | "failed";

export interface Experiment {
  id: string;
  orgId: string;
  datasetId: string;
  name: string;
  config: Record<string, unknown>;
  status: ExperimentStatus;
  createdAt: string;
  completedAt?: string;
}

export interface ExperimentRun {
  id: string;
  experimentId: string;
  datasetItemId: string;
  output?: Record<string, unknown>;
  latencyMs?: number;
  tokenCount?: number;
  cost?: number;
  createdAt: string;
}
```

- [ ] **Step 3: Verify types compile**

```bash
cd /Users/caleb.love/Developer/Foxhound && npx tsc --noEmit -p packages/types/tsconfig.json
```

Expected: PASS (no errors)

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): add Dataset, DatasetItem, Experiment, ExperimentRun types"
```

---

### Task 2: Add Database Schema for Datasets & Experiments

**Files:**

- Modify: `packages/db/src/schema.ts:483`

- [ ] **Step 1: Add the 4 new tables to schema.ts**

Append after the `annotationQueueItems` table definition (line 482) in `packages/db/src/schema.ts`:

```typescript
// ──────────────────────────────────────────────────────────────────────────────
// Dataset & Experiment tables (Phase 3)
// ──────────────────────────────────────────────────────────────────────────────

export const datasets = pgTable(
  "datasets",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("datasets_org_id_idx").on(table.orgId),
    orgNameIdx: index("datasets_org_name_idx").on(table.orgId, table.name),
  }),
);

export const datasetItems = pgTable(
  "dataset_items",
  {
    id: text("id").primaryKey(),
    datasetId: text("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    /** The input to feed into the experiment run */
    input: jsonb("input").notNull().$type<Record<string, unknown>>(),
    /** The expected/golden output for comparison */
    expectedOutput: jsonb("expected_output").$type<Record<string, unknown>>(),
    /** Arbitrary metadata preserved from trace or user-provided */
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    /** If this item was curated from a production trace, preserve lineage */
    sourceTraceId: text("source_trace_id").references(() => traces.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    datasetIdIdx: index("dataset_items_dataset_id_idx").on(table.datasetId),
    sourceTraceIdIdx: index("dataset_items_source_trace_id_idx").on(table.sourceTraceId),
  }),
);

export const experiments = pgTable(
  "experiments",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    datasetId: text("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Experiment configuration: model, prompt template, temperature, etc. */
    config: jsonb("config").notNull().default({}).$type<Record<string, unknown>>(),
    status: text("status", {
      enum: ["pending", "running", "completed", "failed"],
    })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    orgIdIdx: index("experiments_org_id_idx").on(table.orgId),
    datasetIdIdx: index("experiments_dataset_id_idx").on(table.datasetId),
    orgStatusIdx: index("experiments_org_status_idx").on(table.orgId, table.status),
  }),
);

export const experimentRuns = pgTable(
  "experiment_runs",
  {
    id: text("id").primaryKey(),
    experimentId: text("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    datasetItemId: text("dataset_item_id")
      .notNull()
      .references(() => datasetItems.id, { onDelete: "cascade" }),
    /** The output produced by running the experiment config against this dataset item */
    output: jsonb("output").$type<Record<string, unknown>>(),
    latencyMs: integer("latency_ms"),
    tokenCount: integer("token_count"),
    /** Cost in USD (e.g. 0.003) */
    cost: doublePrecision("cost"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    experimentIdIdx: index("experiment_runs_experiment_id_idx").on(table.experimentId),
    datasetItemIdIdx: index("experiment_runs_dataset_item_id_idx").on(table.datasetItemId),
  }),
);
```

- [ ] **Step 2: Verify schema compiles**

```bash
cd /Users/caleb.love/Developer/Foxhound && npx tsc --noEmit -p packages/db/tsconfig.json
```

Expected: PASS

- [ ] **Step 3: Create SQL migration file**

Create `packages/db/drizzle/0007_datasets_experiments.sql`:

```sql
-- Phase 3: Datasets & Experiments

CREATE TABLE IF NOT EXISTS "datasets" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "datasets_org_id_idx" ON "datasets" ("org_id");
CREATE INDEX IF NOT EXISTS "datasets_org_name_idx" ON "datasets" ("org_id", "name");

CREATE TABLE IF NOT EXISTS "dataset_items" (
  "id" text PRIMARY KEY NOT NULL,
  "dataset_id" text NOT NULL REFERENCES "datasets"("id") ON DELETE CASCADE,
  "input" jsonb NOT NULL,
  "expected_output" jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "source_trace_id" text REFERENCES "traces"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "dataset_items_dataset_id_idx" ON "dataset_items" ("dataset_id");
CREATE INDEX IF NOT EXISTS "dataset_items_source_trace_id_idx" ON "dataset_items" ("source_trace_id");

CREATE TABLE IF NOT EXISTS "experiments" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "dataset_id" text NOT NULL REFERENCES "datasets"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);

CREATE INDEX IF NOT EXISTS "experiments_org_id_idx" ON "experiments" ("org_id");
CREATE INDEX IF NOT EXISTS "experiments_dataset_id_idx" ON "experiments" ("dataset_id");
CREATE INDEX IF NOT EXISTS "experiments_org_status_idx" ON "experiments" ("org_id", "status");

CREATE TABLE IF NOT EXISTS "experiment_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "experiment_id" text NOT NULL REFERENCES "experiments"("id") ON DELETE CASCADE,
  "dataset_item_id" text NOT NULL REFERENCES "dataset_items"("id") ON DELETE CASCADE,
  "output" jsonb,
  "latency_ms" integer,
  "token_count" integer,
  "cost" double precision,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "experiment_runs_experiment_id_idx" ON "experiment_runs" ("experiment_id");
CREATE INDEX IF NOT EXISTS "experiment_runs_dataset_item_id_idx" ON "experiment_runs" ("dataset_item_id");
```

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/0007_datasets_experiments.sql
git commit -m "feat(db): add datasets, dataset_items, experiments, experiment_runs tables"
```

---

### Task 3: Add Database Query Functions for Datasets

**Files:**

- Modify: `packages/db/src/queries.ts:1352`

- [ ] **Step 1: Add dataset schema imports**

In `packages/db/src/queries.ts`, add `datasets` and `datasetItems` to the imports from `./schema.js` (line 4-21). Add them after `annotationQueueItems`:

```typescript
import {
  traces,
  spans,
  users,
  organizations,
  memberships,
  apiKeys,
  usageRecords,
  notificationChannels,
  alertRules,
  notificationLog,
  ssoConfigs,
  ssoSessions,
  waitlistSignups,
  scores,
  evaluators,
  evaluatorRuns,
  annotationQueues,
  annotationQueueItems,
  datasets,
  datasetItems,
  experiments,
  experimentRuns,
} from "./schema.js";
```

- [ ] **Step 2: Add dataset query functions**

Append after `getAnnotationQueueItem` function (after line 1352) in `packages/db/src/queries.ts`:

```typescript
// ──────────────────────────────────────────────────────────────────────────────
// Dataset queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateDatasetInput {
  id: string;
  orgId: string;
  name: string;
  description?: string;
}

export async function createDataset(input: CreateDatasetInput) {
  const rows = await db
    .insert(datasets)
    .values({
      id: input.id,
      orgId: input.orgId,
      name: input.name,
      description: input.description ?? null,
    })
    .returning();
  return rows[0]!;
}

export async function listDatasets(orgId: string) {
  return db
    .select()
    .from(datasets)
    .where(eq(datasets.orgId, orgId))
    .orderBy(desc(datasets.createdAt));
}

export async function getDataset(id: string, orgId: string) {
  const rows = await db
    .select()
    .from(datasets)
    .where(and(eq(datasets.id, id), eq(datasets.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteDataset(id: string, orgId: string): Promise<boolean> {
  const result = await db
    .delete(datasets)
    .where(and(eq(datasets.id, id), eq(datasets.orgId, orgId)));
  return (result as unknown as { rowCount?: number }).rowCount !== 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Dataset item queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateDatasetItemInput {
  id: string;
  datasetId: string;
  input: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  sourceTraceId?: string;
}

export async function createDatasetItem(input: CreateDatasetItemInput) {
  const rows = await db
    .insert(datasetItems)
    .values({
      id: input.id,
      datasetId: input.datasetId,
      input: input.input,
      expectedOutput: input.expectedOutput ?? null,
      metadata: input.metadata ?? {},
      sourceTraceId: input.sourceTraceId ?? null,
    })
    .returning();
  return rows[0]!;
}

export async function createDatasetItems(inputs: CreateDatasetItemInput[]) {
  if (inputs.length === 0) return [];
  const rows = await db
    .insert(datasetItems)
    .values(
      inputs.map((input) => ({
        id: input.id,
        datasetId: input.datasetId,
        input: input.input,
        expectedOutput: input.expectedOutput ?? null,
        metadata: input.metadata ?? {},
        sourceTraceId: input.sourceTraceId ?? null,
      })),
    )
    .returning();
  return rows;
}

export interface DatasetItemFilters {
  datasetId: string;
  page?: number;
  limit?: number;
}

export async function listDatasetItems(filters: DatasetItemFilters) {
  const { datasetId, page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;
  return db
    .select()
    .from(datasetItems)
    .where(eq(datasetItems.datasetId, datasetId))
    .orderBy(desc(datasetItems.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getDatasetItem(id: string) {
  const rows = await db.select().from(datasetItems).where(eq(datasetItems.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteDatasetItem(id: string): Promise<boolean> {
  const result = await db.delete(datasetItems).where(eq(datasetItems.id, id));
  return (result as unknown as { rowCount?: number }).rowCount !== 0;
}

export async function countDatasetItems(datasetId: string): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(datasetItems)
    .where(eq(datasetItems.datasetId, datasetId));
  return Number(rows[0]?.count ?? 0);
}

/**
 * Auto-curate dataset items from production traces filtered by score.
 * This is the "killer feature" — traces matching score filters become test cases.
 */
export async function getTracesForDatasetCuration(filters: {
  orgId: string;
  scoreName: string;
  scoreOperator: "lt" | "gt" | "lte" | "gte";
  scoreThreshold: number;
  since?: Date;
  limit?: number;
}) {
  const {
    orgId,
    scoreName,
    scoreOperator,
    scoreThreshold,
    since,
    limit: maxResults = 100,
  } = filters;

  const conditions = [eq(scores.orgId, orgId), eq(scores.name, scoreName)];

  if (scoreOperator === "lt") conditions.push(lt(scores.value, scoreThreshold));
  else if (scoreOperator === "gt") conditions.push(gte(scores.value, scoreThreshold + 0.0001));
  else if (scoreOperator === "lte") conditions.push(lte(scores.value, scoreThreshold));
  else if (scoreOperator === "gte") conditions.push(gte(scores.value, scoreThreshold));

  if (since) conditions.push(gte(scores.createdAt, since));

  // Get distinct trace IDs matching score filter, then join with traces + spans
  const matchingScores = await db
    .select({ traceId: scores.traceId })
    .from(scores)
    .where(and(...conditions))
    .groupBy(scores.traceId)
    .limit(maxResults);

  if (matchingScores.length === 0) return [];

  const traceIds = matchingScores.map((s) => s.traceId);

  // Fetch full trace data with spans for input/output extraction
  const results = [];
  for (const traceId of traceIds) {
    const trace = await db
      .select()
      .from(traces)
      .where(and(eq(traces.id, traceId), eq(traces.orgId, orgId)))
      .limit(1);

    if (trace[0]) {
      const traceSpans = await db
        .select()
        .from(spans)
        .where(eq(spans.traceId, traceId))
        .orderBy(asc(spans.startTimeMs));

      results.push({ trace: trace[0], spans: traceSpans });
    }
  }

  return results;
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/caleb.love/Developer/Foxhound && npx tsc --noEmit -p packages/db/tsconfig.json
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/queries.ts
git commit -m "feat(db): add dataset and dataset item query functions"
```

---

### Task 4: Add Database Query Functions for Experiments

**Files:**

- Modify: `packages/db/src/queries.ts` (append after dataset queries from Task 3)

- [ ] **Step 1: Add experiment query functions**

Append after the dataset query functions:

```typescript
// ──────────────────────────────────────────────────────────────────────────────
// Experiment queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateExperimentInput {
  id: string;
  orgId: string;
  datasetId: string;
  name: string;
  config: Record<string, unknown>;
}

export async function createExperiment(input: CreateExperimentInput) {
  const rows = await db
    .insert(experiments)
    .values({
      id: input.id,
      orgId: input.orgId,
      datasetId: input.datasetId,
      name: input.name,
      config: input.config,
      status: "pending",
    })
    .returning();
  return rows[0]!;
}

export async function listExperiments(orgId: string, datasetId?: string) {
  const conditions = [eq(experiments.orgId, orgId)];
  if (datasetId) conditions.push(eq(experiments.datasetId, datasetId));

  return db
    .select()
    .from(experiments)
    .where(and(...conditions))
    .orderBy(desc(experiments.createdAt));
}

export async function getExperiment(id: string, orgId: string) {
  const rows = await db
    .select()
    .from(experiments)
    .where(and(eq(experiments.id, id), eq(experiments.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateExperimentStatus(
  id: string,
  status: "running" | "completed" | "failed",
) {
  const set: Record<string, unknown> = { status };
  if (status === "completed" || status === "failed") set.completedAt = new Date();

  const rows = await db.update(experiments).set(set).where(eq(experiments.id, id)).returning();
  return rows[0] ?? null;
}

export async function deleteExperiment(id: string, orgId: string): Promise<boolean> {
  const result = await db
    .delete(experiments)
    .where(and(eq(experiments.id, id), eq(experiments.orgId, orgId)));
  return (result as unknown as { rowCount?: number }).rowCount !== 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Experiment run queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateExperimentRunInput {
  id: string;
  experimentId: string;
  datasetItemId: string;
}

export async function createExperimentRun(input: CreateExperimentRunInput) {
  const rows = await db
    .insert(experimentRuns)
    .values({
      id: input.id,
      experimentId: input.experimentId,
      datasetItemId: input.datasetItemId,
    })
    .returning();
  return rows[0]!;
}

export async function createExperimentRuns(inputs: CreateExperimentRunInput[]) {
  if (inputs.length === 0) return [];
  const rows = await db
    .insert(experimentRuns)
    .values(
      inputs.map((input) => ({
        id: input.id,
        experimentId: input.experimentId,
        datasetItemId: input.datasetItemId,
      })),
    )
    .returning();
  return rows;
}

export async function getExperimentRun(id: string) {
  const rows = await db.select().from(experimentRuns).where(eq(experimentRuns.id, id)).limit(1);
  return rows[0] ?? null;
}

export interface UpdateExperimentRunInput {
  output?: Record<string, unknown>;
  latencyMs?: number;
  tokenCount?: number;
  cost?: number;
}

export async function updateExperimentRun(id: string, input: UpdateExperimentRunInput) {
  const rows = await db
    .update(experimentRuns)
    .set({
      output: input.output ?? null,
      latencyMs: input.latencyMs ?? null,
      tokenCount: input.tokenCount ?? null,
      cost: input.cost ?? null,
    })
    .where(eq(experimentRuns.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function listExperimentRuns(experimentId: string) {
  return db
    .select()
    .from(experimentRuns)
    .where(eq(experimentRuns.experimentId, experimentId))
    .orderBy(asc(experimentRuns.createdAt));
}

/**
 * Get side-by-side comparison data for multiple experiments.
 * Returns experiment runs grouped by dataset item for easy comparison.
 */
export async function getExperimentComparison(experimentIds: string[], orgId: string) {
  // Verify all experiments belong to this org
  const exps = await db
    .select()
    .from(experiments)
    .where(and(eq(experiments.orgId, orgId), sql`${experiments.id} = ANY(${experimentIds})`));

  if (exps.length !== experimentIds.length) return null;

  // Fetch all runs for these experiments
  const runs = await db
    .select()
    .from(experimentRuns)
    .where(sql`${experimentRuns.experimentId} = ANY(${experimentIds})`)
    .orderBy(asc(experimentRuns.datasetItemId));

  // Fetch the dataset items referenced by these runs
  const itemIds = [...new Set(runs.map((r) => r.datasetItemId))];
  const items =
    itemIds.length > 0
      ? await db
          .select()
          .from(datasetItems)
          .where(sql`${datasetItems.id} = ANY(${itemIds})`)
      : [];

  // Fetch scores for experiment runs (auto-scored by evaluators)
  const runIds = runs.map((r) => r.id);
  const runScores =
    runIds.length > 0
      ? await db
          .select()
          .from(scores)
          .where(sql`${scores.comment} = ANY(${runIds})`)
      : [];

  return { experiments: exps, runs, items, scores: runScores };
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/caleb.love/Developer/Foxhound && npx tsc --noEmit -p packages/db/tsconfig.json
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/queries.ts
git commit -m "feat(db): add experiment and experiment run query functions"
```

---

### Task 5: Add Dataset API Routes

**Files:**

- Create: `apps/api/src/routes/datasets.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/routes/datasets.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { datasetsRoutes } from "./datasets.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  createDataset: vi.fn(),
  listDatasets: vi.fn(),
  getDataset: vi.fn(),
  deleteDataset: vi.fn(),
  createDatasetItem: vi.fn(),
  createDatasetItems: vi.fn(),
  listDatasetItems: vi.fn(),
  deleteDatasetItem: vi.fn(),
  countDatasetItems: vi.fn(),
  getTracesForDatasetCuration: vi.fn(),
}));

vi.mock("@foxhound/billing", () => ({
  getEntitlements: vi.fn(),
  invalidateEntitlements: vi.fn(),
}));

import * as db from "@foxhound/db";

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(datasetsRoutes);
  return app;
}

function mockApiKey(orgId = "org_1") {
  vi.mocked(db.resolveApiKey).mockResolvedValue({
    apiKey: {
      id: "key_1",
      orgId,
      keyHash: "hash",
      prefix: "sk-test",
      name: "Test Key",
      createdByUserId: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    org: {
      id: orgId,
      name: "Test Org",
      slug: "test-org",
      plan: "free" as const,
      stripeCustomerId: null,
      retentionDays: 90,
      samplingRate: 1.0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

describe("POST /v1/datasets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a dataset", async () => {
    mockApiKey();
    const created = {
      id: "ds_123",
      orgId: "org_1",
      name: "my-eval-set",
      description: "Test dataset",
      createdAt: new Date(),
    };
    vi.mocked(db.createDataset).mockResolvedValue(created);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/datasets",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: { name: "my-eval-set", description: "Test dataset" },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject({ name: "my-eval-set" });
  });

  it("rejects missing name", async () => {
    mockApiKey();
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/datasets",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /v1/datasets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists datasets for the org", async () => {
    mockApiKey();
    vi.mocked(db.listDatasets).mockResolvedValue([]);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/datasets",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveProperty("data");
  });
});

describe("POST /v1/datasets/:id/items", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a dataset item", async () => {
    mockApiKey();
    vi.mocked(db.getDataset).mockResolvedValue({
      id: "ds_123",
      orgId: "org_1",
      name: "test",
      description: null,
      createdAt: new Date(),
    });
    const created = {
      id: "dsi_123",
      datasetId: "ds_123",
      input: { prompt: "hello" },
      expectedOutput: { response: "hi" },
      metadata: {},
      sourceTraceId: null,
      createdAt: new Date(),
    };
    vi.mocked(db.createDatasetItem).mockResolvedValue(created);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/datasets/ds_123/items",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: { input: { prompt: "hello" }, expectedOutput: { response: "hi" } },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject({ datasetId: "ds_123" });
  });
});

describe("POST /v1/datasets/:id/items/from-traces", () => {
  beforeEach(() => vi.clearAllMocks());

  it("curates items from traces matching score filter", async () => {
    mockApiKey();
    vi.mocked(db.getDataset).mockResolvedValue({
      id: "ds_123",
      orgId: "org_1",
      name: "test",
      description: null,
      createdAt: new Date(),
    });
    vi.mocked(db.getTracesForDatasetCuration).mockResolvedValue([
      {
        trace: {
          id: "trace_1",
          orgId: "org_1",
          agentId: "agent_1",
          sessionId: null,
          startTimeMs: "1000",
          endTimeMs: null,
          spans: [],
          metadata: {},
          createdAt: new Date(),
        },
        spans: [
          {
            id: "span_1",
            traceId: "trace_1",
            orgId: "org_1",
            parentSpanId: null,
            name: "step",
            kind: "agent_step",
            status: "ok",
            startTimeMs: 1000,
            endTimeMs: 2000,
            attributes: { input: "hello", output: "world" },
            events: [],
            createdAt: new Date(),
          },
        ],
      },
    ]);
    vi.mocked(db.createDatasetItems).mockResolvedValue([
      {
        id: "dsi_1",
        datasetId: "ds_123",
        input: { input: "hello" },
        expectedOutput: { output: "world" },
        metadata: {},
        sourceTraceId: "trace_1",
        createdAt: new Date(),
      },
    ]);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/datasets/ds_123/items/from-traces",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: {
        scoreName: "helpfulness",
        scoreOperator: "lt",
        scoreThreshold: 0.5,
        sinceDays: 7,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.added).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/caleb.love/Developer/Foxhound && npx vitest run apps/api/src/routes/datasets.test.ts 2>&1 | tail -10
```

Expected: FAIL (datasets.ts doesn't exist yet)

- [ ] **Step 3: Implement datasets routes**

Create `apps/api/src/routes/datasets.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  createDataset,
  listDatasets,
  getDataset,
  deleteDataset,
  createDatasetItem,
  createDatasetItems,
  listDatasetItems,
  deleteDatasetItem,
  countDatasetItems,
  getTracesForDatasetCuration,
} from "@foxhound/db";

const CreateDatasetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
});

const CreateDatasetItemSchema = z.object({
  input: z.record(z.unknown()),
  expectedOutput: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  sourceTraceId: z.string().optional(),
});

const ListDatasetItemsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const FromTracesSchema = z.object({
  scoreName: z.string().min(1),
  scoreOperator: z.enum(["lt", "gt", "lte", "gte"]),
  scoreThreshold: z.number(),
  sinceDays: z.number().int().positive().max(365).optional(),
  limit: z.number().int().positive().max(500).default(100),
});

export function datasetsRoutes(fastify: FastifyInstance): void {
  /**
   * POST /v1/datasets
   * Create a new dataset.
   */
  fastify.post("/v1/datasets", async (request, reply) => {
    const result = CreateDatasetSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const dataset = await createDataset({
      id: `ds_${randomUUID()}`,
      orgId: request.orgId,
      name: result.data.name,
      description: result.data.description,
    });

    return reply.code(201).send(dataset);
  });

  /**
   * GET /v1/datasets
   * List all datasets for the authenticated org.
   */
  fastify.get("/v1/datasets", async (request, reply) => {
    const rows = await listDatasets(request.orgId);
    return reply.code(200).send({ data: rows });
  });

  /**
   * GET /v1/datasets/:id
   * Get a single dataset with item count.
   */
  fastify.get("/v1/datasets/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const dataset = await getDataset(id, request.orgId);
    if (!dataset) {
      return reply.code(404).send({ error: "Not Found" });
    }
    const itemCount = await countDatasetItems(id);
    return reply.code(200).send({ ...dataset, itemCount });
  });

  /**
   * DELETE /v1/datasets/:id
   * Delete a dataset and all its items.
   */
  fastify.delete("/v1/datasets/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await deleteDataset(id, request.orgId);
    if (!deleted) {
      return reply.code(404).send({ error: "Not Found" });
    }
    return reply.code(204).send();
  });

  /**
   * POST /v1/datasets/:id/items
   * Add a single item to a dataset.
   */
  fastify.post("/v1/datasets/:id/items", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = CreateDatasetItemSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const dataset = await getDataset(id, request.orgId);
    if (!dataset) {
      return reply.code(404).send({ error: "Dataset not found" });
    }

    const item = await createDatasetItem({
      id: `dsi_${randomUUID()}`,
      datasetId: id,
      input: result.data.input,
      expectedOutput: result.data.expectedOutput,
      metadata: result.data.metadata,
      sourceTraceId: result.data.sourceTraceId,
    });

    return reply.code(201).send(item);
  });

  /**
   * GET /v1/datasets/:id/items
   * List items in a dataset with pagination.
   */
  fastify.get("/v1/datasets/:id/items", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = ListDatasetItemsSchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const dataset = await getDataset(id, request.orgId);
    if (!dataset) {
      return reply.code(404).send({ error: "Dataset not found" });
    }

    const rows = await listDatasetItems({
      datasetId: id,
      page: result.data.page,
      limit: result.data.limit,
    });

    return reply.code(200).send({
      data: rows,
      pagination: { page: result.data.page, limit: result.data.limit, count: rows.length },
    });
  });

  /**
   * DELETE /v1/datasets/:id/items/:itemId
   * Delete a single item from a dataset.
   */
  fastify.delete("/v1/datasets/:id/items/:itemId", async (request, reply) => {
    const { id, itemId } = request.params as { id: string; itemId: string };

    const dataset = await getDataset(id, request.orgId);
    if (!dataset) {
      return reply.code(404).send({ error: "Dataset not found" });
    }

    const deleted = await deleteDatasetItem(itemId);
    if (!deleted) {
      return reply.code(404).send({ error: "Not Found" });
    }
    return reply.code(204).send();
  });

  /**
   * POST /v1/datasets/:id/items/from-traces
   * Auto-curate dataset items from production traces filtered by score.
   * The killer feature: "Add all traces where helpfulness < 0.5 from last 7 days"
   */
  fastify.post("/v1/datasets/:id/items/from-traces", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = FromTracesSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const dataset = await getDataset(id, request.orgId);
    if (!dataset) {
      return reply.code(404).send({ error: "Dataset not found" });
    }

    const { scoreName, scoreOperator, scoreThreshold, sinceDays, limit } = result.data;

    const since = sinceDays ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000) : undefined;

    const traceResults = await getTracesForDatasetCuration({
      orgId: request.orgId,
      scoreName,
      scoreOperator,
      scoreThreshold,
      since,
      limit,
    });

    if (traceResults.length === 0) {
      return reply.code(201).send({ added: 0, items: [] });
    }

    // Extract input/output from spans and create dataset items
    const itemInputs = traceResults.map(({ trace, spans }) => {
      const firstSpan = spans[0];
      const lastSpan = spans[spans.length - 1];
      const input = firstSpan?.attributes?.["input"] ?? firstSpan?.attributes ?? {};
      const output = lastSpan?.attributes?.["output"] ?? lastSpan?.attributes ?? {};

      return {
        id: `dsi_${randomUUID()}`,
        datasetId: id,
        input: typeof input === "object" ? (input as Record<string, unknown>) : { value: input },
        expectedOutput:
          typeof output === "object" ? (output as Record<string, unknown>) : { value: output },
        metadata: trace.metadata as Record<string, unknown>,
        sourceTraceId: trace.id,
      };
    });

    const items = await createDatasetItems(itemInputs);

    return reply.code(201).send({ added: items.length, items });
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/caleb.love/Developer/Foxhound && npx vitest run apps/api/src/routes/datasets.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/datasets.ts apps/api/src/routes/datasets.test.ts
git commit -m "feat(api): add dataset CRUD and from-traces auto-curation routes"
```

---

### Task 6: Add Experiment API Routes

**Files:**

- Create: `apps/api/src/routes/experiments.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/routes/experiments.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { experimentsRoutes } from "./experiments.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  createExperiment: vi.fn(),
  listExperiments: vi.fn(),
  getExperiment: vi.fn(),
  deleteExperiment: vi.fn(),
  getDataset: vi.fn(),
  listDatasetItems: vi.fn(),
  createExperimentRuns: vi.fn(),
  listExperimentRuns: vi.fn(),
  getExperimentComparison: vi.fn(),
}));

vi.mock("@foxhound/billing", () => ({
  getEntitlements: vi.fn(),
  invalidateEntitlements: vi.fn(),
}));

vi.mock("../queue.js", () => ({
  getExperimentQueue: vi.fn(() => null),
}));

import * as db from "@foxhound/db";

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(experimentsRoutes);
  return app;
}

function mockApiKey(orgId = "org_1") {
  vi.mocked(db.resolveApiKey).mockResolvedValue({
    apiKey: {
      id: "key_1",
      orgId,
      keyHash: "hash",
      prefix: "sk-test",
      name: "Test Key",
      createdByUserId: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    org: {
      id: orgId,
      name: "Test Org",
      slug: "test-org",
      plan: "free" as const,
      stripeCustomerId: null,
      retentionDays: 90,
      samplingRate: 1.0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

describe("POST /v1/experiments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an experiment and enqueues async job", async () => {
    mockApiKey();
    vi.mocked(db.getDataset).mockResolvedValue({
      id: "ds_123",
      orgId: "org_1",
      name: "test",
      description: null,
      createdAt: new Date(),
    });
    vi.mocked(db.listDatasetItems).mockResolvedValue([
      {
        id: "dsi_1",
        datasetId: "ds_123",
        input: { prompt: "hello" },
        expectedOutput: null,
        metadata: {},
        sourceTraceId: null,
        createdAt: new Date(),
      },
    ]);
    vi.mocked(db.createExperiment).mockResolvedValue({
      id: "exp_123",
      orgId: "org_1",
      datasetId: "ds_123",
      name: "test-experiment",
      config: { model: "gpt-4o", promptTemplate: "Answer: {{input}}" },
      status: "pending",
      createdAt: new Date(),
      completedAt: null,
    });
    vi.mocked(db.createExperimentRuns).mockResolvedValue([
      {
        id: "exr_1",
        experimentId: "exp_123",
        datasetItemId: "dsi_1",
        output: null,
        latencyMs: null,
        tokenCount: null,
        cost: null,
        createdAt: new Date(),
      },
    ]);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/experiments",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: {
        datasetId: "ds_123",
        name: "test-experiment",
        config: { model: "gpt-4o", promptTemplate: "Answer: {{input}}" },
      },
    });

    expect(res.statusCode).toBe(202);
    expect(JSON.parse(res.body)).toMatchObject({ experiment: { name: "test-experiment" } });
  });

  it("rejects if dataset not found", async () => {
    mockApiKey();
    vi.mocked(db.getDataset).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/experiments",
      headers: { authorization: "Bearer sk-testkey123" },
      payload: {
        datasetId: "ds_nope",
        name: "test",
        config: { model: "gpt-4o" },
      },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /v1/experiment-comparisons", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns side-by-side comparison", async () => {
    mockApiKey();
    vi.mocked(db.getExperimentComparison).mockResolvedValue({
      experiments: [],
      runs: [],
      items: [],
      scores: [],
    });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/experiment-comparisons?experiment_ids=exp_1,exp_2",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveProperty("experiments");
  });

  it("rejects missing experiment_ids param", async () => {
    mockApiKey();
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/experiment-comparisons",
      headers: { authorization: "Bearer sk-testkey123" },
    });

    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/caleb.love/Developer/Foxhound && npx vitest run apps/api/src/routes/experiments.test.ts 2>&1 | tail -10
```

Expected: FAIL (experiments.ts doesn't exist yet)

- [ ] **Step 3: Implement experiments routes**

Create `apps/api/src/routes/experiments.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  createExperiment,
  listExperiments,
  getExperiment,
  deleteExperiment,
  getDataset,
  listDatasetItems,
  createExperimentRuns,
  listExperimentRuns,
  getExperimentComparison,
} from "@foxhound/db";
import { getExperimentQueue } from "../queue.js";

const CreateExperimentSchema = z.object({
  datasetId: z.string().min(1),
  name: z.string().min(1).max(100),
  config: z.record(z.unknown()),
});

const ListExperimentsSchema = z.object({
  datasetId: z.string().optional(),
});

const ComparisonSchema = z.object({
  experiment_ids: z.string().min(1),
});

export function experimentsRoutes(fastify: FastifyInstance): void {
  /**
   * POST /v1/experiments
   * Create an experiment and enqueue it for async execution on the worker.
   */
  fastify.post("/v1/experiments", async (request, reply) => {
    const result = CreateExperimentSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const { datasetId, name, config } = result.data;
    const orgId = request.orgId;

    // Verify dataset belongs to this org
    const dataset = await getDataset(datasetId, orgId);
    if (!dataset) {
      return reply.code(404).send({ error: "Dataset not found" });
    }

    // Get all dataset items to create experiment runs
    const items = await listDatasetItems({ datasetId, limit: 10000 });
    if (items.length === 0) {
      return reply.code(400).send({ error: "Dataset has no items" });
    }

    const experiment = await createExperiment({
      id: `exp_${randomUUID()}`,
      orgId,
      datasetId,
      name,
      config,
    });

    // Create a run for each dataset item
    const runs = await createExperimentRuns(
      items.map((item) => ({
        id: `exr_${randomUUID()}`,
        experimentId: experiment.id,
        datasetItemId: item.id,
      })),
    );

    // Enqueue BullMQ job for the worker to process
    const queue = getExperimentQueue();
    if (queue) {
      await queue.add(
        "run-experiment",
        { experimentId: experiment.id },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    }

    return reply.code(202).send({
      experiment,
      runCount: runs.length,
      message: `Experiment queued with ${runs.length} run(s)`,
    });
  });

  /**
   * GET /v1/experiments
   * List experiments, optionally filtered by dataset.
   */
  fastify.get("/v1/experiments", async (request, reply) => {
    const result = ListExperimentsSchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const rows = await listExperiments(request.orgId, result.data.datasetId);
    return reply.code(200).send({ data: rows });
  });

  /**
   * GET /v1/experiments/:id
   * Get a single experiment with its runs.
   */
  fastify.get("/v1/experiments/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const experiment = await getExperiment(id, request.orgId);
    if (!experiment) {
      return reply.code(404).send({ error: "Not Found" });
    }

    const runs = await listExperimentRuns(id);
    return reply.code(200).send({ ...experiment, runs });
  });

  /**
   * DELETE /v1/experiments/:id
   * Delete an experiment and all its runs.
   */
  fastify.delete("/v1/experiments/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await deleteExperiment(id, request.orgId);
    if (!deleted) {
      return reply.code(404).send({ error: "Not Found" });
    }
    return reply.code(204).send();
  });

  /**
   * GET /v1/experiment-comparisons?experiment_ids=exp1,exp2
   * Side-by-side comparison of experiment results.
   * Dedicated resource per architecture review — not RPC.
   */
  fastify.get("/v1/experiment-comparisons", async (request, reply) => {
    const result = ComparisonSchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({ error: "experiment_ids query parameter is required" });
    }

    const experimentIds = result.data.experiment_ids.split(",").filter(Boolean);
    if (experimentIds.length < 2) {
      return reply.code(400).send({ error: "At least 2 experiment IDs required for comparison" });
    }

    const comparison = await getExperimentComparison(experimentIds, request.orgId);
    if (!comparison) {
      return reply.code(404).send({ error: "One or more experiments not found" });
    }

    return reply.code(200).send(comparison);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/caleb.love/Developer/Foxhound && npx vitest run apps/api/src/routes/experiments.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/experiments.ts apps/api/src/routes/experiments.test.ts
git commit -m "feat(api): add experiment CRUD, async execution, and side-by-side comparison routes"
```

---

### Task 7: Register Routes and Add Experiment Queue

**Files:**

- Modify: `apps/api/src/index.ts:17,63`
- Modify: `apps/api/src/queue.ts:41`

- [ ] **Step 1: Add route imports and registration to index.ts**

In `apps/api/src/index.ts`, add imports after the annotations import (line 17):

```typescript
import { datasetsRoutes } from "./routes/datasets.js";
import { experimentsRoutes } from "./routes/experiments.js";
```

Add registrations after the `annotationsRoutes` registration (line 63):

```typescript
await app.register(datasetsRoutes);
await app.register(experimentsRoutes);
```

- [ ] **Step 2: Add experiment queue to queue.ts**

Append to `apps/api/src/queue.ts` after the `getEvaluatorQueue` function (after line 41):

```typescript
const EXPERIMENT_QUEUE_NAME = "experiment-runs";

let experimentQueue: Queue | null = null;
let experimentInitialized = false;

export function getExperimentQueue(): Queue | null {
  if (experimentInitialized) return experimentQueue;
  experimentInitialized = true;

  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) return null;

  try {
    const connection = parseRedisUrl(redisUrl);
    experimentQueue = new Queue(EXPERIMENT_QUEUE_NAME, { connection });
  } catch {
    // Redis not available — experiment runs will stay in "pending" state
  }

  return experimentQueue;
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/caleb.love/Developer/Foxhound && npx tsc --noEmit -p apps/api/tsconfig.json
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/queue.ts
git commit -m "feat(api): register dataset and experiment routes, add experiment queue"
```

---

### Task 8: Add Experiment Worker

**Files:**

- Create: `apps/worker/src/queues/experiment.ts`
- Modify: `apps/worker/src/index.ts:11,31-32`

- [ ] **Step 1: Create the experiment worker**

Create `apps/worker/src/queues/experiment.ts`:

```typescript
import { Worker, Queue } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import {
  getExperiment,
  listExperimentRuns,
  getDatasetItem,
  updateExperimentRun,
  updateExperimentStatus,
  createScore,
  listEvaluators,
} from "@foxhound/db";
import { randomUUID } from "crypto";

export const EXPERIMENT_QUEUE_NAME = "experiment-runs";

export interface ExperimentJobData {
  experimentId: string;
}

/**
 * Run a single dataset item through the experiment config.
 * Calls the configured LLM model with the prompt template + input.
 */
async function executeExperimentRun(
  config: Record<string, unknown>,
  input: Record<string, unknown>,
): Promise<{
  output: Record<string, unknown>;
  latencyMs: number;
  tokenCount: number;
  cost: number;
}> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for experiment execution");
  }

  const model = (config.model as string) ?? "gpt-4o";
  const promptTemplate = (config.promptTemplate as string) ?? "{{input}}";
  const temperature = (config.temperature as number) ?? 0;

  // Render template with input
  const prompt = promptTemplate.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = input[key];
    if (value === undefined) return `{{${key}}}`;
    return typeof value === "string" ? value : JSON.stringify(value);
  });

  const startTime = Date.now();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
    }),
  });

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`LLM API error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
  };

  const content = data.choices[0]?.message?.content ?? "";
  const totalTokens = data.usage?.total_tokens ?? 0;

  // Rough cost estimate (per 1M tokens pricing)
  const MODEL_COSTS: Record<string, number> = {
    "gpt-4o": 0.005,
    "gpt-4o-mini": 0.00015,
    "gpt-4-turbo": 0.01,
  };
  const costPerToken = (MODEL_COSTS[model] ?? 0.005) / 1_000_000;
  const cost = totalTokens * costPerToken;

  return {
    output: { content },
    latencyMs,
    tokenCount: totalTokens,
    cost: Math.round(cost * 1_000_000) / 1_000_000, // 6 decimal places
  };
}

/**
 * Process an entire experiment: run all dataset items, then auto-score.
 */
async function processExperimentJob(job: Job<ExperimentJobData>): Promise<void> {
  const { experimentId } = job.data;

  await updateExperimentStatus(experimentId, "running");

  const experiment = await getExperiment(experimentId, "");
  if (!experiment) {
    throw new Error(`Experiment ${experimentId} not found`);
  }

  const runs = await listExperimentRuns(experimentId);
  let failedCount = 0;

  for (const run of runs) {
    try {
      const item = await getDatasetItem(run.datasetItemId);
      if (!item) continue;

      const result = await executeExperimentRun(
        experiment.config as Record<string, unknown>,
        item.input as Record<string, unknown>,
      );

      await updateExperimentRun(run.id, {
        output: result.output,
        latencyMs: result.latencyMs,
        tokenCount: result.tokenCount,
        cost: result.cost,
      });
    } catch (err) {
      failedCount++;
      console.error(`[experiment] Run ${run.id} failed:`, (err as Error).message);
      await updateExperimentRun(run.id, {
        output: { error: (err as Error).message },
      });
    }
  }

  // Auto-score experiment runs using org's enabled evaluators
  try {
    const enabledEvaluators = await listEvaluators(experiment.orgId);
    const active = enabledEvaluators.filter((e) => e.enabled);

    if (active.length > 0) {
      console.log(
        `[experiment] Auto-scoring ${runs.length} runs with ${active.length} evaluator(s)`,
      );
      // Scores get created and linked to the experiment run via the comment field
      // (stores the experiment run ID for comparison queries)
      for (const run of runs) {
        const updatedRun = await import("@foxhound/db").then((m) => m.getExperimentRun(run.id));
        if (!updatedRun?.output || (updatedRun.output as Record<string, unknown>).error) continue;

        for (const evaluator of active) {
          try {
            await createScore({
              id: `scr_${randomUUID()}`,
              orgId: experiment.orgId,
              traceId: experiment.id, // Use experiment ID as pseudo-trace for score linkage
              name: evaluator.name,
              source: "llm_judge",
              comment: run.id, // Store run ID for comparison lookup
            });
          } catch {
            // Non-fatal: scoring failure shouldn't fail the experiment
          }
        }
      }
    }
  } catch (err) {
    console.error(`[experiment] Auto-scoring failed:`, (err as Error).message);
  }

  await updateExperimentStatus(experimentId, failedCount === runs.length ? "failed" : "completed");
}

/**
 * Create the experiment queue (for the API to enqueue jobs).
 */
export function createExperimentQueue(connection: ConnectionOptions): Queue<ExperimentJobData> {
  return new Queue<ExperimentJobData>(EXPERIMENT_QUEUE_NAME, { connection });
}

/**
 * Start the experiment worker (runs in the worker process).
 */
export function startExperimentWorker(connection: ConnectionOptions): Worker<ExperimentJobData> {
  const worker = new Worker<ExperimentJobData>(
    EXPERIMENT_QUEUE_NAME,
    async (job) => {
      await processExperimentJob(job);
    },
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 60_000, // 10 experiments per minute
      },
    },
  );

  worker.on("completed", (job) => {
    console.log(`[experiment] Job ${job.id} completed (experiment: ${job.data.experimentId})`);
  });

  worker.on("failed", (job, err) => {
    const experimentId = job?.data?.experimentId ?? "unknown";
    console.error(`[experiment] Job ${job?.id} failed (experiment: ${experimentId}):`, err.message);

    if (job?.data?.experimentId) {
      updateExperimentStatus(job.data.experimentId, "failed").catch((e) => {
        console.error(`[experiment] Failed to update experiment status:`, e);
      });
    }
  });

  return worker;
}
```

- [ ] **Step 2: Update worker index.ts to start experiment worker**

In `apps/worker/src/index.ts`, add the import after the evaluator import (line 11):

```typescript
import { startExperimentWorker } from "./queues/experiment.js";
```

After the evaluator worker start (line 32), add:

```typescript
// Start experiment worker
const experimentWorker = startExperimentWorker(connection);
console.log("[worker] Experiment worker started (concurrency: 5)");
```

Update the shutdown function to close both workers:

```typescript
async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] Received ${signal}, shutting down...`);
  await Promise.all([evaluatorWorker.close(), experimentWorker.close()]);
  console.log("[worker] Shutdown complete");
  process.exit(0);
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/caleb.love/Developer/Foxhound && npx tsc --noEmit -p apps/worker/tsconfig.json
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/queues/experiment.ts apps/worker/src/index.ts
git commit -m "feat(worker): add experiment runner with auto-scoring via evaluators"
```

---

### Task 9: Add API Client Methods

**Files:**

- Modify: `packages/api-client/src/types.ts:195`
- Modify: `packages/api-client/src/index.ts:353`

- [ ] **Step 1: Add response types**

Append to `packages/api-client/src/types.ts` after `SubmitAnnotationResponse` (line 194):

```typescript
// ── Datasets ──────────────────────────────────────────────────────────────

export interface DatasetListResponse {
  data: import("@foxhound/types").Dataset[];
}

export interface DatasetWithCount extends import("@foxhound/types").Dataset {
  itemCount: number;
}

export interface DatasetItemListResponse {
  data: import("@foxhound/types").DatasetItem[];
  pagination: { page: number; limit: number; count: number };
}

export interface FromTracesResponse {
  added: number;
  items: import("@foxhound/types").DatasetItem[];
}

// ── Experiments ───────────────────────────────────────────────────────────

export interface ExperimentListResponse {
  data: import("@foxhound/types").Experiment[];
}

export interface ExperimentWithRuns extends import("@foxhound/types").Experiment {
  runs: import("@foxhound/types").ExperimentRun[];
}

export interface CreateExperimentResponse {
  experiment: import("@foxhound/types").Experiment;
  runCount: number;
  message: string;
}

export interface ExperimentComparisonResponse {
  experiments: import("@foxhound/types").Experiment[];
  runs: import("@foxhound/types").ExperimentRun[];
  items: import("@foxhound/types").DatasetItem[];
  scores: Score[];
}
```

- [ ] **Step 2: Add client methods**

In `packages/api-client/src/index.ts`, add the new type imports at the top (line 26-33 area), then append the methods after the annotation queue section (before the HTTP helpers section around line 353):

First, update the imports from `./types.js`:

```typescript
import type {
  FoxhoundApiConfig,
  TraceListResponse,
  ReplayResponse,
  DiffResponse,
  AlertRule,
  AlertRuleListResponse,
  AlertEventType,
  AlertSeverity,
  ChannelKind,
  NotificationChannel,
  ChannelListResponse,
  ApiKeyCreatedResponse,
  ApiKeyListResponse,
  LoginResponse,
  MeResponse,
  HealthResponse,
  UsageResponse,
  ScoreListResponse,
  TraceScoresResponse,
  EvaluatorListResponse,
  TriggerEvaluatorRunsResponse,
  AnnotationQueueListResponse,
  AnnotationQueueWithStats,
  AddAnnotationItemsResponse,
  SubmitAnnotationResponse,
  DatasetListResponse,
  DatasetWithCount,
  DatasetItemListResponse,
  FromTracesResponse,
  ExperimentListResponse,
  ExperimentWithRuns,
  CreateExperimentResponse,
  ExperimentComparisonResponse,
} from "./types.js";
```

Add the import for new types:

```typescript
import type {
  Score,
  Evaluator,
  EvaluatorRun,
  AnnotationQueueItem,
  ScoreSource,
  Dataset,
  DatasetItem,
  Experiment,
} from "@foxhound/types";
```

Then add client methods before the `// ── HTTP helpers` section:

```typescript
  // ── Datasets ──────────────────────────────────────────────────────────

  async createDataset(params: {
    name: string;
    description?: string;
  }): Promise<Dataset> {
    return this.post("/v1/datasets", params as unknown as Record<string, unknown>);
  }

  async listDatasets(): Promise<DatasetListResponse> {
    return this.get("/v1/datasets");
  }

  async getDataset(datasetId: string): Promise<DatasetWithCount> {
    return this.get(`/v1/datasets/${encodeURIComponent(datasetId)}`);
  }

  async deleteDataset(datasetId: string): Promise<void> {
    await this.del(`/v1/datasets/${encodeURIComponent(datasetId)}`);
  }

  async createDatasetItem(
    datasetId: string,
    params: {
      input: Record<string, unknown>;
      expectedOutput?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      sourceTraceId?: string;
    },
  ): Promise<DatasetItem> {
    return this.post(
      `/v1/datasets/${encodeURIComponent(datasetId)}/items`,
      params as unknown as Record<string, unknown>,
    );
  }

  async listDatasetItems(
    datasetId: string,
    params?: { page?: number; limit?: number },
  ): Promise<DatasetItemListResponse> {
    const query = new URLSearchParams();
    if (params?.page !== undefined) query.set("page", String(params.page));
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    return this.get(`/v1/datasets/${encodeURIComponent(datasetId)}/items?${query.toString()}`);
  }

  async deleteDatasetItem(datasetId: string, itemId: string): Promise<void> {
    await this.del(
      `/v1/datasets/${encodeURIComponent(datasetId)}/items/${encodeURIComponent(itemId)}`,
    );
  }

  async createDatasetItemsFromTraces(
    datasetId: string,
    params: {
      scoreName: string;
      scoreOperator: "lt" | "gt" | "lte" | "gte";
      scoreThreshold: number;
      sinceDays?: number;
      limit?: number;
    },
  ): Promise<FromTracesResponse> {
    return this.post(
      `/v1/datasets/${encodeURIComponent(datasetId)}/items/from-traces`,
      params as unknown as Record<string, unknown>,
    );
  }

  // ── Experiments ────────────────────────────────────────────────────────

  async createExperiment(params: {
    datasetId: string;
    name: string;
    config: Record<string, unknown>;
  }): Promise<CreateExperimentResponse> {
    return this.post("/v1/experiments", params as unknown as Record<string, unknown>);
  }

  async listExperiments(params?: { datasetId?: string }): Promise<ExperimentListResponse> {
    const query = new URLSearchParams();
    if (params?.datasetId !== undefined) query.set("datasetId", params.datasetId);
    return this.get(`/v1/experiments?${query.toString()}`);
  }

  async getExperiment(experimentId: string): Promise<ExperimentWithRuns> {
    return this.get(`/v1/experiments/${encodeURIComponent(experimentId)}`);
  }

  async deleteExperiment(experimentId: string): Promise<void> {
    await this.del(`/v1/experiments/${encodeURIComponent(experimentId)}`);
  }

  async compareExperiments(experimentIds: string[]): Promise<ExperimentComparisonResponse> {
    const ids = experimentIds.join(",");
    return this.get(`/v1/experiment-comparisons?experiment_ids=${encodeURIComponent(ids)}`);
  }
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/caleb.love/Developer/Foxhound && npx tsc --noEmit -p packages/api-client/tsconfig.json
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/types.ts packages/api-client/src/index.ts
git commit -m "feat(api-client): add dataset and experiment client methods"
```

---

### Task 10: Add Python SDK Namespaces

**Files:**

- Modify: `packages/sdk-py/foxhound/client.py:148`

- [ ] **Step 1: Add DatasetsNamespace class**

In `packages/sdk-py/foxhound/client.py`, add after the `ScoresNamespace` class (after line 111, before the `FoxhoundClient` class):

```python
class DatasetsNamespace:
    """Namespaced API for managing datasets. Access via ``fox.datasets.create(...)``."""

    def __init__(self, endpoint: str, api_key: str, timeout: float) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    async def create(
        self,
        *,
        name: str,
        description: str | None = None,
    ) -> dict[str, Any]:
        """Create a new dataset.

        Usage::

            dataset = await fox.datasets.create(name="my-eval-set")
        """
        body: dict[str, Any] = {"name": name}
        if description is not None:
            body["description"] = description

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._endpoint}/v1/datasets",
                json=body,
                headers=self._headers(),
            )
        if response.status_code not in (200, 201):
            raise RuntimeError(
                f"Foxhound: failed to create dataset: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def add_item(
        self,
        *,
        dataset_id: str,
        input: dict[str, Any],
        expected_output: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        source_trace_id: str | None = None,
    ) -> dict[str, Any]:
        """Add a single item to a dataset.

        Usage::

            item = await fox.datasets.add_item(
                dataset_id="ds_...", input={"prompt": "hello"}
            )
        """
        body: dict[str, Any] = {"input": input}
        if expected_output is not None:
            body["expectedOutput"] = expected_output
        if metadata is not None:
            body["metadata"] = metadata
        if source_trace_id is not None:
            body["sourceTraceId"] = source_trace_id

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._endpoint}/v1/datasets/{dataset_id}/items",
                json=body,
                headers=self._headers(),
            )
        if response.status_code not in (200, 201):
            raise RuntimeError(
                f"Foxhound: failed to add dataset item: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def add_items_from_traces(
        self,
        *,
        dataset_id: str,
        score_name: str,
        score_operator: str = "lt",
        score_threshold: float = 0.5,
        since_days: int | None = None,
        limit: int = 100,
    ) -> dict[str, Any]:
        """Auto-curate dataset items from production traces filtered by score.

        Usage::

            result = await fox.datasets.add_items_from_traces(
                dataset_id="ds_...",
                score_name="helpfulness",
                score_operator="lt",
                score_threshold=0.5,
                since_days=7,
            )
            print(f"Added {result['added']} items")
        """
        body: dict[str, Any] = {
            "scoreName": score_name,
            "scoreOperator": score_operator,
            "scoreThreshold": score_threshold,
            "limit": limit,
        }
        if since_days is not None:
            body["sinceDays"] = since_days

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._endpoint}/v1/datasets/{dataset_id}/items/from-traces",
                json=body,
                headers=self._headers(),
            )
        if response.status_code not in (200, 201):
            raise RuntimeError(
                f"Foxhound: failed to curate from traces: "
                f"{response.status_code} {response.text}"
            )
        return response.json()


class ExperimentsNamespace:
    """Namespaced API for managing experiments. Access via ``fox.experiments.create(...)``."""

    def __init__(self, endpoint: str, api_key: str, timeout: float) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    async def create(
        self,
        *,
        dataset_id: str,
        name: str,
        config: dict[str, Any],
    ) -> dict[str, Any]:
        """Create and enqueue an experiment for async execution.

        Usage::

            result = await fox.experiments.create(
                dataset_id="ds_...",
                name="gpt4o-v2",
                config={"model": "gpt-4o", "promptTemplate": "Answer: {{input}}"},
            )
        """
        body: dict[str, Any] = {
            "datasetId": dataset_id,
            "name": name,
            "config": config,
        }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._endpoint}/v1/experiments",
                json=body,
                headers=self._headers(),
            )
        if response.status_code not in (200, 201, 202):
            raise RuntimeError(
                f"Foxhound: failed to create experiment: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def get(self, *, experiment_id: str) -> dict[str, Any]:
        """Get an experiment with its runs."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{self._endpoint}/v1/experiments/{experiment_id}",
                headers=self._headers(),
            )
        if response.status_code != 200:
            raise RuntimeError(
                f"Foxhound: failed to get experiment: "
                f"{response.status_code} {response.text}"
            )
        return response.json()

    async def compare(self, *, experiment_ids: list[str]) -> dict[str, Any]:
        """Get side-by-side comparison of experiment results."""
        ids = ",".join(experiment_ids)
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{self._endpoint}/v1/experiment-comparisons?experiment_ids={ids}",
                headers=self._headers(),
            )
        if response.status_code != 200:
            raise RuntimeError(
                f"Foxhound: failed to compare experiments: "
                f"{response.status_code} {response.text}"
            )
        return response.json()
```

- [ ] **Step 2: Register namespaces in FoxhoundClient.**init\*\*\*\*

In the `FoxhoundClient.__init__` method, after `self.scores = ScoresNamespace(...)` (line 148), add:

```python
        self.datasets = DatasetsNamespace(self._endpoint, self._api_key, self._timeout)
        self.experiments = ExperimentsNamespace(self._endpoint, self._api_key, self._timeout)
```

- [ ] **Step 3: Verify Python syntax**

```bash
cd /Users/caleb.love/Developer/Foxhound && python3 -c "import ast; ast.parse(open('packages/sdk-py/foxhound/client.py').read()); print('OK')"
```

Expected: OK

- [ ] **Step 4: Commit**

```bash
git add packages/sdk-py/foxhound/client.py
git commit -m "feat(sdk-py): add datasets and experiments namespaces"
```

---

### Task 11: Run Full Test Suite and Fix Issues

**Files:**

- All modified files

- [ ] **Step 1: Run existing tests to check for regressions**

```bash
cd /Users/caleb.love/Developer/Foxhound && npx vitest run 2>&1 | tail -30
```

Expected: All pre-existing tests PASS, new tests PASS

- [ ] **Step 2: Run TypeScript compilation across all packages**

```bash
cd /Users/caleb.love/Developer/Foxhound && npx tsc --build --force 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 3: Run Prettier/ESLint if configured**

```bash
cd /Users/caleb.love/Developer/Foxhound && npx prettier --check "apps/api/src/routes/datasets.ts" "apps/api/src/routes/experiments.ts" "apps/worker/src/queues/experiment.ts" 2>&1 | tail -10
```

Fix any formatting issues.

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: resolve test regressions and formatting for Phase 3"
```

---

## Success Criteria Verification

After all tasks complete, verify against the spec:

| Criterion                                                      | How to verify                                                                                   |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Datasets populated from production traces                      | `POST /v1/datasets/:id/items/from-traces` with score filter works                               |
| Experiments run prompt variants with auto-scoring              | `POST /v1/experiments` enqueues job, worker executes and auto-scores                            |
| Side-by-side comparison via dedicated API resource             | `GET /v1/experiment-comparisons?experiment_ids=exp1,exp2` returns grouped results               |
| Full lineage: trace -> dataset item -> experiment run -> score | `sourceTraceId` on dataset items, `datasetItemId` on experiment runs, scores linked via comment |
| Python SDK support                                             | `fox.datasets.create()`, `fox.datasets.add_items_from_traces()`, `fox.experiments.create()`     |
| TypeScript API client support                                  | All CRUD methods available on `FoxhoundApiClient`                                               |
| Worker handles execution independently                         | Experiment worker runs in `apps/worker/` process, never blocks API                              |
