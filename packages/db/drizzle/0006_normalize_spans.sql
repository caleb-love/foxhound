-- Phase 0: Normalize spans out of JSONB into first-class table
-- Also adds retention & sampling columns to organizations

-- 0.1 — Add retention and sampling config to organizations (idempotent)
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "retention_days" integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS "sampling_rate" real NOT NULL DEFAULT 1.0;

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_retention_days_check"
  CHECK ("retention_days" > 0) NOT VALID;

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_sampling_rate_check"
  CHECK ("sampling_rate" >= 0.0 AND "sampling_rate" <= 1.0) NOT VALID;

-- 0.2 — Create normalized spans table with composite PK (trace_id, id)
-- Span IDs are only unique within a trace, not globally.
CREATE TABLE IF NOT EXISTS "spans" (
  "id" text NOT NULL,
  "trace_id" text NOT NULL REFERENCES "traces"("id") ON DELETE CASCADE,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "parent_span_id" text,
  "name" text NOT NULL,
  "kind" text NOT NULL DEFAULT 'custom',
  "status" text NOT NULL DEFAULT 'ok',
  "start_time_ms" bigint NOT NULL,
  "end_time_ms" bigint,
  "attributes" jsonb NOT NULL DEFAULT '{}',
  "events" jsonb NOT NULL DEFAULT '[]',
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("trace_id", "id")
);

-- 0.3 — Indexes
CREATE INDEX IF NOT EXISTS "spans_trace_id_idx" ON "spans" ("trace_id");
CREATE INDEX IF NOT EXISTS "traces_org_id_created_at_idx" ON "traces" ("org_id", "created_at");

-- 0.4 — Backfill: extract JSONB spans into the new table.
-- Guards: skip NULL org_id rows and non-array spans. ON CONFLICT safe for re-runs.
-- NOTE: For large datasets (>50K traces), run this as a batched script instead.
INSERT INTO "spans" ("id", "trace_id", "org_id", "parent_span_id", "name", "kind", "status", "start_time_ms", "end_time_ms", "attributes", "events", "created_at")
SELECT
  s->>'spanId',
  t."id",
  t."org_id",
  NULLIF(s->>'parentSpanId', ''),
  s->>'name',
  COALESCE(s->>'kind', 'custom'),
  COALESCE(s->>'status', 'ok'),
  (s->>'startTimeMs')::bigint,
  CASE WHEN s->>'endTimeMs' IS NOT NULL THEN (s->>'endTimeMs')::bigint ELSE NULL END,
  COALESCE(s->'attributes', '{}'),
  COALESCE(s->'events', '[]'),
  t."created_at"
FROM "traces" t,
     jsonb_array_elements(t."spans") AS s
WHERE t."org_id" IS NOT NULL
  AND jsonb_typeof(t."spans") = 'array'
  AND jsonb_array_length(t."spans") > 0
ON CONFLICT ("trace_id", "id") DO NOTHING;
