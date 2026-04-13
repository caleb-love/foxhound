-- H1.1: Add cost_usd column to spans table
-- The column is defined in schema.ts but was never created via migration.
-- Phase 4 cost worker writes to spans.cost_usd — without this column, INSERT/UPDATE will fail.

ALTER TABLE "spans"
  ADD COLUMN IF NOT EXISTS "cost_usd" numeric(12, 6);
