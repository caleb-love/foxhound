-- H4.4: Multi-agent coordination columns on traces
-- parent_agent_id links a delegated trace to the agent that spawned it.
-- correlation_id groups all traces belonging to the same multi-agent workflow.

ALTER TABLE "traces"
  ADD COLUMN IF NOT EXISTS "parent_agent_id" text,
  ADD COLUMN IF NOT EXISTS "correlation_id" text;

-- Composite index for correlation lookups scoped by org
CREATE INDEX IF NOT EXISTS "traces_correlation_id_idx"
  ON "traces" ("org_id", "correlation_id")
  WHERE "correlation_id" IS NOT NULL;

-- Composite index for agent + time range queries scoped by org
CREATE INDEX IF NOT EXISTS "traces_org_agent_start_idx"
  ON "traces" ("org_id", "agent_id", "start_time_ms");
