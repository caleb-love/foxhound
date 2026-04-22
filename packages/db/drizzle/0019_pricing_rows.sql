-- WP16 — Versioned pricing table (time-series cost model).
--
-- Semantics:
--   `pricing_rows` is append-only. A price change inserts a new row with
--   `effective_from = now()` and closes the predecessor row by setting
--   `effective_to = now()` in the same transaction. Span cost compute
--   looks up the row whose half-open `[effective_from, effective_to)`
--   window contains the span's start timestamp, so a retroactive
--   backfill reproduces pre-change prices exactly.
--
-- Immutability contract:
--   `effective_from` and the price columns are NEVER mutated after
--   insert; corrections happen by appending a new row. The application-
--   layer `addPriceRow` helper enforces this, and the lack of any
--   `updatePriceRow` export keeps a future agent from reintroducing the
--   anti-pattern by accident. See RFC-016 for rationale.

CREATE TABLE IF NOT EXISTS "pricing_rows" (
    "id"                        text PRIMARY KEY,
    "model"                     text NOT NULL,
    "provider"                  text NOT NULL,
    "input_price_per_1k"        numeric(14, 10) NOT NULL,
    "output_price_per_1k"       numeric(14, 10) NOT NULL,
    "cache_hit_price_per_1k"    numeric(14, 10),
    "effective_from"            timestamptz NOT NULL,
    "effective_to"              timestamptz,
    "created_at"                timestamptz NOT NULL DEFAULT now(),
    "created_by"                text NOT NULL
);

-- Time-window lookup index. Hot path: consumer queries
-- `model = ? AND provider = ? AND effective_from <= span_start
--  AND (effective_to IS NULL OR effective_to > span_start)`
-- This composite index lets PostgreSQL locate the matching row in
-- O(log n) without scanning unrelated models.
CREATE INDEX IF NOT EXISTS "pricing_rows_lookup_idx"
    ON "pricing_rows" ("model", "provider", "effective_from");

-- Admin query acceleration. "What is the current price for X?"
-- matches `effective_to IS NULL`.
CREATE INDEX IF NOT EXISTS "pricing_rows_active_idx"
    ON "pricing_rows" ("model", "provider", "effective_to");

-- A single model can have at most one active (effective_to IS NULL) row
-- per provider at any time. This partial unique index is the
-- database-level enforcement of the application-level invariant.
CREATE UNIQUE INDEX IF NOT EXISTS "pricing_rows_single_active"
    ON "pricing_rows" ("model", "provider")
    WHERE "effective_to" IS NULL;
