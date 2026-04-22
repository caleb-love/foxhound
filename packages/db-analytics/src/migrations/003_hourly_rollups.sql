-- 003_hourly_rollups.sql — HourlyRollup materialised view (WP11).
--
-- Aggregates `spans` into per-`(org_id, agent_id, hour)` rows using
-- SummingMergeTree so repeated inserts of the same key correctly sum.
-- `quantileState(0.95)` preserves the p95 as an AggregateState column
-- that the read side finalises with `quantileMerge`.
--
-- Landed as a TARGET table + MATERIALIZED VIEW pair so existing data in
-- `spans` can be back-filled with a one-shot `INSERT SELECT` without
-- depending on `POPULATE` behaviour (which is inconsistent on some
-- ClickHouse versions under writes).

CREATE TABLE IF NOT EXISTS hourly_rollups (
    org_id                  String,
    agent_id                String,                 -- 'unknown' when null
    hour                    DateTime,

    span_count              UInt64,
    prompt_tokens           UInt64,
    completion_tokens       UInt64,
    cost_usd_micros         Int64,
    error_count             UInt64,

    -- AggregateFunction(quantile, UInt32) state — finalise on read via
    -- `quantileMerge(p95_duration_state)`. Reads should use a SELECT
    -- that aggregates across the hour's parts (SummingMergeTree + AF
    -- columns requires `GROUP BY` at read time for correctness).
    p95_duration_state      AggregateFunction(quantile(0.95), UInt32)
)
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(hour)
ORDER BY (org_id, agent_id, hour)
TTL hour + INTERVAL 400 DAY
SETTINGS index_granularity = 8192;

CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_rollups_mv TO hourly_rollups AS
SELECT
    org_id,
    coalesce(agent_id, 'unknown')     AS agent_id,
    toStartOfHour(start_time)         AS hour,
    toUInt64(count())                 AS span_count,
    toUInt64(sum(coalesce(prompt_tokens, 0)))     AS prompt_tokens,
    toUInt64(sum(coalesce(completion_tokens, 0))) AS completion_tokens,
    toInt64(sum(coalesce(cost_usd_micros, 0)))    AS cost_usd_micros,
    toUInt64(countIf(status = 'error'))           AS error_count,
    quantileState(0.95)(toUInt32(if(end_time > start_time, (end_time - start_time) * 1000, 0))) AS p95_duration_state
FROM spans
GROUP BY org_id, agent_id, hour;
