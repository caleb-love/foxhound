-- Phase 2: Evaluation engine tables
-- Scores, evaluators, evaluator runs, annotation queues, and annotation queue items.

CREATE TABLE IF NOT EXISTS "scores" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "trace_id" text NOT NULL REFERENCES "traces"("id") ON DELETE CASCADE,
  "span_id" text,
  "name" text NOT NULL,
  "value" double precision,
  "label" text,
  "source" text NOT NULL,
  "comment" text,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "scores_org_name_created_idx" ON "scores" ("org_id", "name", "created_at");
CREATE INDEX IF NOT EXISTS "scores_trace_id_idx" ON "scores" ("trace_id");
CREATE INDEX IF NOT EXISTS "scores_org_source_idx" ON "scores" ("org_id", "source");

CREATE TABLE IF NOT EXISTS "evaluators" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "prompt_template" text NOT NULL,
  "model" text NOT NULL,
  "scoring_type" text NOT NULL,
  "labels" text[] DEFAULT '{}'::text[],
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "evaluators_org_id_idx" ON "evaluators" ("org_id");
CREATE INDEX IF NOT EXISTS "evaluators_org_name_idx" ON "evaluators" ("org_id", "name");

CREATE TABLE IF NOT EXISTS "evaluator_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "evaluator_id" text NOT NULL REFERENCES "evaluators"("id") ON DELETE CASCADE,
  "trace_id" text NOT NULL REFERENCES "traces"("id") ON DELETE CASCADE,
  "score_id" text REFERENCES "scores"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);

CREATE INDEX IF NOT EXISTS "evaluator_runs_evaluator_status_idx" ON "evaluator_runs" ("evaluator_id", "status");
CREATE INDEX IF NOT EXISTS "evaluator_runs_trace_id_idx" ON "evaluator_runs" ("trace_id");

CREATE TABLE IF NOT EXISTS "annotation_queues" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "score_configs" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "annotation_queues_org_id_idx" ON "annotation_queues" ("org_id");

CREATE TABLE IF NOT EXISTS "annotation_queue_items" (
  "id" text PRIMARY KEY NOT NULL,
  "queue_id" text NOT NULL REFERENCES "annotation_queues"("id") ON DELETE CASCADE,
  "trace_id" text NOT NULL REFERENCES "traces"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'pending',
  "assigned_to" text REFERENCES "users"("id") ON DELETE SET NULL,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "annotation_queue_items_queue_status_idx" ON "annotation_queue_items" ("queue_id", "status");
CREATE INDEX IF NOT EXISTS "annotation_queue_items_trace_id_idx" ON "annotation_queue_items" ("trace_id");
