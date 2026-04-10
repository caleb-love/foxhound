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
