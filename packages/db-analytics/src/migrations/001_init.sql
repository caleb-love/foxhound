-- 001_init.sql — initial ClickHouse schema for Foxhound telemetry (WP09).
--
-- Design notes (see RFC-009 for full rationale):
--
-- PARTITION BY toYYYYMMDD(start_time):
--   Daily partitions give us cheap retention drops (WP17) and a natural
--   unit of parallelism. Querying a single day at 35k RPS is ~3 B rows
--   per partition; MergeTree handles that well with the ORDER BY below.
--
-- ORDER BY (org_id, trace_id, start_time):
--   Tenant is always the first dimension of any Foxhound query. Then
--   trace_id co-locates spans of the same trace so the trace-tree fetch
--   is a tight range scan. start_time within a trace preserves causal
--   order at read time.
--
-- LowCardinality(String) for `kind` and `status`:
--   A few distinct values; LowCardinality cuts column bytes ~20x and
--   accelerates GROUP BY / WHERE on those columns.
--
-- Nullable fields (agent_id, cost_usd, input_uri, output_uri, …):
--   Reserved for WP10 (blob URIs), WP15 (agent_id promotion), WP16 (cost).
--   Landing them nullable now means later WPs are additive schema changes,
--   not migrations.
--
-- TTL toDateTime(start_time) + INTERVAL 90 DAY:
--   Default retention. WP17 replaces this with a per-org plan-driven TTL
--   via a row policy / view. Until then, 90d keeps the default demo
--   footprint bounded.

CREATE TABLE IF NOT EXISTS spans (
    -- Tenancy (always first in ORDER BY; never nullable).
    org_id            String,

    -- Identifiers.
    trace_id          String,
    span_id           String,
    parent_span_id    Nullable(String),

    -- Naming + classification.
    name              String,
    kind              LowCardinality(String)  DEFAULT 'custom',
    agent_id          Nullable(String),       -- reserved for WP15

    -- Timing (nanosecond precision via DateTime64(9)).
    start_time        DateTime64(9),
    end_time          DateTime64(9),
    duration_ms       UInt32  MATERIALIZED toUInt32(greatest(0, (end_time - start_time) * 1000)),

    -- Outcome.
    status            LowCardinality(String)  DEFAULT 'unset',
    status_message    Nullable(String),

    -- LLM-specific promoted columns.
    model             Nullable(String),
    prompt_tokens     Nullable(UInt32),
    completion_tokens Nullable(UInt32),
    cost_usd_micros   Nullable(Int64),        -- populated by WP16

    -- Blob pointers (WP10).
    input_uri         Nullable(String),
    output_uri        Nullable(String),

    -- Flat attribute map. Cast everything to String on the wire; type
    -- information lives inside Foxhound's Protobuf schema (v1.AttributeValue).
    attributes        Map(String, String),

    -- Ingest bookkeeping.
    schema_version    LowCardinality(String) DEFAULT 'v1',
    ingested_at       DateTime                DEFAULT now()
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(start_time)
ORDER BY (org_id, trace_id, start_time)
TTL toDateTime(start_time) + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Index skip file for per-span lookup by span_id within a tenant. MergeTree
-- `ORDER BY` is primarily tenant + trace; a span_id probe without a
-- trace_id hint would otherwise scan the full partition.
ALTER TABLE spans
    ADD INDEX IF NOT EXISTS idx_span_id span_id TYPE bloom_filter(0.01) GRANULARITY 4;

-- Index to accelerate agent-scoped queries once WP15 populates `agent_id`.
ALTER TABLE spans
    ADD INDEX IF NOT EXISTS idx_agent_id agent_id TYPE bloom_filter(0.01) GRANULARITY 4;
