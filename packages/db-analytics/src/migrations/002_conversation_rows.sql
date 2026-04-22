-- 002_conversation_rows.sql — ConversationRow aggregate (WP11).
--
-- One row per logical conversation (today: one per trace). Landed as a
-- `ReplacingMergeTree(updated_at)` so the rollup consumer's idempotent
-- upsert semantics are correct: when the same trace is re-seen (replay,
-- late span, restart), the latest `updated_at` wins after merge. Queries
-- that need the current row use `FINAL` or `argMax(col, updated_at)`.
--
-- Partition daily by `started_at` to match the `spans` retention boundary
-- (WP17). Order by `(org_id, trace_id)` so (a) tenant scope is always
-- the primary prefix, (b) per-trace upserts touch one granule only.

CREATE TABLE IF NOT EXISTS conversation_rows (
    -- Tenancy.
    org_id                String,

    -- Identity.
    trace_id              String,
    agent_id              Nullable(String),        -- WP15 populates

    -- Timing.
    started_at            DateTime64(9),
    ended_at              DateTime64(9),
    duration_ms           UInt32,

    -- Counts.
    total_spans           UInt32,
    total_tool_calls      UInt32,
    total_llm_calls       UInt32,
    total_subagent_calls  UInt32  DEFAULT 0,       -- WP15 populates
    error_count           UInt32,

    -- Cost + tokens.
    input_tokens          UInt64  DEFAULT 0,
    output_tokens         UInt64  DEFAULT 0,
    cost_usd_micros       Int64   DEFAULT 0,       -- WP16 populates

    -- Outcome summary.
    status                LowCardinality(String),  -- ok | error | unset

    -- Human-readable previews. Truncated at ingest time to 200 chars
    -- each to bound row width under high-cardinality workloads.
    user_input_preview    String,
    agent_output_preview  String,

    -- Bookkeeping (ReplacingMergeTree's deduplicating column).
    schema_version        LowCardinality(String) DEFAULT 'v1',
    updated_at            DateTime64(3)  DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMMDD(started_at)
ORDER BY (org_id, trace_id)
TTL toDateTime(started_at) + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

ALTER TABLE conversation_rows
    ADD INDEX IF NOT EXISTS idx_agent_id agent_id TYPE bloom_filter(0.01) GRANULARITY 4;
