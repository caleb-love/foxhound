-- H1.2: Add missing span indexes
-- Without these, queries filtering by kind, time range, or parent span do sequential scans.
--
-- NOTE: Not using CONCURRENTLY because Drizzle's migrator runs each file
-- inside a transaction, and CREATE INDEX CONCURRENTLY cannot run in a transaction.
-- For large tables in production, consider running these manually outside the migrator.

-- Filter spans by type within an org (e.g., "show all llm_call spans")
CREATE INDEX IF NOT EXISTS "spans_org_id_kind_idx"
  ON "spans" ("org_id", "kind");

-- Time-range queries within an org (e.g., "spans in the last hour")
CREATE INDEX IF NOT EXISTS "spans_org_id_start_time_ms_idx"
  ON "spans" ("org_id", "start_time_ms");

-- Tree traversal: find child spans of a given parent
CREATE INDEX IF NOT EXISTS "spans_parent_span_id_idx"
  ON "spans" ("parent_span_id");
