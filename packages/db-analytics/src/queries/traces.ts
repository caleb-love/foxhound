/**
 * Trace-tree + trace-list queries.
 *
 * Every query is tenant-scoped via `ScopedOrg` from `guard.ts`. The SQL
 * shapes are deliberately simple so a reader can see what the ORDER BY
 * and partition pruning will look like at scale.
 */
import type { AnalyticsClient } from "../client.js";
import { type ScopedOrg, assertScoped } from "../guard.js";
import type { QueryTracesFilter, SpanRow, TraceSummaryRow } from "../types.js";

export interface GetTraceTreeOpts {
  readonly org: ScopedOrg;
  readonly traceId: string;
  /** Limit spans returned; defaults to 10,000 (ample for any realistic trace). */
  readonly limit?: number;
}

/**
 * Fetch all spans of a trace. Ordered by `start_time` so the caller can
 * reconstruct the span tree from `parent_span_id`. The ORDER BY in the
 * schema is `(org_id, trace_id, start_time)`, so this is a tight range
 * scan: one partition touched per day the trace spans.
 */
export async function getTraceTree(
  client: AnalyticsClient,
  opts: GetTraceTreeOpts,
): Promise<SpanRow[]> {
  assertScoped(opts.org);
  const result = await client.raw.query({
    query: `
      SELECT *
      FROM spans
      WHERE org_id = {orgId:String}
        AND trace_id = {traceId:String}
      ORDER BY start_time ASC, span_id ASC
      LIMIT {limit:UInt32}
      FORMAT JSONEachRow
    `,
    query_params: {
      orgId: opts.org.orgId,
      traceId: opts.traceId,
      limit: opts.limit ?? 10_000,
    },
    format: "JSONEachRow",
  });
  return (await result.json()) as SpanRow[];
}

export interface ListTracesOpts {
  readonly org: ScopedOrg;
  readonly from: Date;
  readonly to: Date;
  readonly agentId?: string;
  readonly status?: "ok" | "error" | "unset";
  readonly nameContains?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface ListTracesResult {
  readonly rows: readonly TraceSummaryRow[];
  readonly nextCursor?: string;
}

/**
 * List trace summaries in a time window. Each row aggregates across the
 * spans of a trace (span_count, error_count, duration). Filters use
 * `PREWHERE` on `org_id` implicitly via MergeTree's ORDER BY.
 *
 * Cursor is a stringified `start_time,trace_id` pair (both required for
 * unique ordering). Callers pass the last row's cursor on the next call.
 */
export async function listTraces(
  client: AnalyticsClient,
  opts: ListTracesOpts,
): Promise<ListTracesResult> {
  assertScoped(opts.org);
  const limit = opts.limit ?? 50;
  const { cursorStart, cursorTraceId } = parseCursor(opts.cursor);
  const hasCursor = cursorStart !== null && cursorTraceId !== null;

  const filters: string[] = [
    "org_id = {orgId:String}",
    "start_time >= {from:DateTime64(9)}",
    "start_time < {to:DateTime64(9)}",
  ];
  if (opts.agentId) filters.push("agent_id = {agentId:String}");
  if (opts.status) filters.push("status = {status:String}");
  if (opts.nameContains) filters.push("positionCaseInsensitive(name, {nameContains:String}) > 0");
  if (hasCursor) {
    filters.push("(start_time, trace_id) < ({cursorStart:DateTime64(9)}, {cursorTraceId:String})");
  }

  const params: Record<string, unknown> = {
    orgId: opts.org.orgId,
    from: toCHTs(opts.from),
    to: toCHTs(opts.to),
    limit,
  };
  if (opts.agentId) params["agentId"] = opts.agentId;
  if (opts.status) params["status"] = opts.status;
  if (opts.nameContains) params["nameContains"] = opts.nameContains;
  if (hasCursor) {
    params["cursorStart"] = cursorStart;
    params["cursorTraceId"] = cursorTraceId;
  }

  const result = await client.raw.query({
    query: `
      SELECT
        org_id,
        trace_id,
        min(start_time) AS start_time,
        max(end_time)   AS end_time,
        toUInt32(greatest(0, (max(end_time) - min(start_time)) * 1000)) AS duration_ms,
        toUInt32(count()) AS span_count,
        toUInt32(countIf(status = 'error')) AS error_count
      FROM spans
      WHERE ${filters.join(" AND ")}
      GROUP BY org_id, trace_id
      ORDER BY start_time DESC, trace_id DESC
      LIMIT {limit:UInt32}
      FORMAT JSONEachRow
    `,
    query_params: params,
    format: "JSONEachRow",
  });
  const rows = (await result.json()) as TraceSummaryRow[];

  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length >= limit && last ? makeCursor(last.start_time, last.trace_id) : undefined;

  return { rows, ...(nextCursor !== undefined ? { nextCursor } : {}) };
}

// ---------------------------------------------------------------------------
// Cursor encoding (start_time,trace_id). Base64 to keep URLs clean.
// ---------------------------------------------------------------------------

function makeCursor(startTime: string, traceId: string): string {
  return Buffer.from(`${startTime}|${traceId}`, "utf8").toString("base64url");
}

export function parseCursor(cursor: string | undefined): {
  cursorStart: string | null;
  cursorTraceId: string | null;
} {
  if (!cursor) return { cursorStart: null, cursorTraceId: null };
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const [start, trace] = decoded.split("|");
    if (!start || !trace) return { cursorStart: null, cursorTraceId: null };
    return { cursorStart: start, cursorTraceId: trace };
  } catch {
    return { cursorStart: null, cursorTraceId: null };
  }
}

function toCHTs(d: Date): string {
  return d.toISOString().replace("T", " ").replace("Z", "");
}

// ---------------------------------------------------------------------------
// Helper: expose the compiled filter shape for tests without running SQL.
// Used by the unit suite to assert that `org_id` is ALWAYS the first
// predicate emitted and that an unscoped call is a type error / runtime
// throw.
// ---------------------------------------------------------------------------

export function __buildListTracesSqlForTest(opts: QueryTracesFilter): {
  sql: string;
  params: Record<string, unknown>;
} {
  // Test helper: mirrors the filter assembly inside `listTraces()` without
  // hitting ClickHouse AND without requiring a real `ScopedOrg`. The
  // tenant-guardrail test exercises `assertScoped` / `scope()` directly.
  // hitting ClickHouse. Returns the SQL fragment the query would compile to
  // for inspection by tests.
  const filters: string[] = [
    "org_id = {orgId:String}",
    "start_time >= {from:DateTime64(9)}",
    "start_time < {to:DateTime64(9)}",
  ];
  if (opts.agentId) filters.push("agent_id = {agentId:String}");
  if (opts.status) filters.push("status = {status:String}");
  if (opts.nameContains) filters.push("positionCaseInsensitive(name, {nameContains:String}) > 0");
  return {
    sql: `WHERE ${filters.join(" AND ")}`,
    params: {
      orgId: opts.orgId,
      from: toCHTs(opts.window.from),
      to: toCHTs(opts.window.to),
      ...(opts.agentId ? { agentId: opts.agentId } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.nameContains ? { nameContains: opts.nameContains } : {}),
    },
  };
}
