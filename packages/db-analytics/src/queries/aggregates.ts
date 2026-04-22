/**
 * Aggregate queries and in-process trace aggregator (WP11).
 *
 * Two concerns live here:
 *
 *   1. A pure `aggregateTrace(trace, orgId)` that folds internal spans
 *      into a `ConversationRow`. Pure, deterministic, unit-testable
 *      without ClickHouse. Used by the rollup consumer.
 *
 *   2. Typed read/write helpers for `conversation_rows` and
 *      `hourly_rollups`, all taking `ScopedOrg` so tenant scope is
 *      enforced at the type level.
 */
import type { Trace, Span } from "@foxhound/types";
import type { AnalyticsClient } from "../client.js";
import { type ScopedOrg, assertScoped } from "../guard.js";

// ---------------------------------------------------------------------------
// Row shapes (wire-shaped, ClickHouse-native).
// ---------------------------------------------------------------------------

export interface ConversationRow {
  readonly org_id: string;
  readonly trace_id: string;
  readonly agent_id: string | null;
  /** ClickHouse DateTime64(9) ISO: `"YYYY-MM-DD HH:MM:SS.fffffffff"`. */
  readonly started_at: string;
  readonly ended_at: string;
  readonly duration_ms: number;
  readonly total_spans: number;
  readonly total_tool_calls: number;
  readonly total_llm_calls: number;
  readonly total_subagent_calls: number;
  readonly error_count: number;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cost_usd_micros: number;
  readonly status: "ok" | "error" | "unset";
  readonly user_input_preview: string;
  readonly agent_output_preview: string;
  readonly schema_version: string;
  readonly updated_at: string;
}

export interface HourlyRollupPoint {
  readonly org_id: string;
  readonly agent_id: string;
  readonly hour: string;
  readonly span_count: number;
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  readonly cost_usd_micros: number;
  readonly error_count: number;
  readonly p95_duration_ms: number;
}

// ---------------------------------------------------------------------------
// Preview extraction. Heuristic: the first span that looks like a user
// message gives `user_input_preview`; the last successful LLM-call span
// with a non-empty output-ish attribute gives `agent_output_preview`.
// Both are truncated to `PREVIEW_MAX_CHARS` to bound row width.
// ---------------------------------------------------------------------------

export const PREVIEW_MAX_CHARS = 200;

const INPUT_ATTR_CANDIDATES = [
  "gen_ai.prompt",
  "llm.prompt",
  "input.user",
  "user.message",
  "prompt",
  "input",
];
const OUTPUT_ATTR_CANDIDATES = [
  "gen_ai.completion",
  "llm.completion",
  "output.assistant",
  "agent.response",
  "completion",
  "output",
];

function firstStringFromAttrs(
  attrs: Record<string, string | number | boolean | null>,
  keys: readonly string[],
): string | undefined {
  for (const k of keys) {
    const v = attrs[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function extractInputPreview(spans: readonly Span[]): string {
  for (const s of spans) {
    if (s.kind !== "llm_call" && s.kind !== "agent_step") continue;
    const v = firstStringFromAttrs(s.attributes, INPUT_ATTR_CANDIDATES);
    if (v) return truncate(v, PREVIEW_MAX_CHARS);
  }
  return "";
}

function extractOutputPreview(spans: readonly Span[]): string {
  // Walk in reverse so we pick the latest successful LLM-call output.
  for (let i = spans.length - 1; i >= 0; i--) {
    const s = spans[i]!;
    if (s.kind !== "llm_call") continue;
    if (s.status === "error") continue;
    const v = firstStringFromAttrs(s.attributes, OUTPUT_ATTR_CANDIDATES);
    if (v) return truncate(v, PREVIEW_MAX_CHARS);
  }
  return "";
}

// ---------------------------------------------------------------------------
// Timestamp formatter (mirrors queries/spans.ts msToClickHouseDateTime64).
// ---------------------------------------------------------------------------

function msToCHDateTime64(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  const msPart = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}.${msPart}000000`;
}

function msToCHDateTime64_3(ms: number): string {
  // DateTime64(3) — ClickHouse expects precision-3 subseconds.
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  const msPart = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}.${msPart}`;
}

// ---------------------------------------------------------------------------
// Pure aggregator: Trace → ConversationRow.
// ---------------------------------------------------------------------------

export interface AggregateTraceOpts {
  /** Override preview extraction (e.g. for customers with custom schemas). */
  readonly extractInputPreview?: (spans: readonly Span[]) => string;
  readonly extractOutputPreview?: (spans: readonly Span[]) => string;
  /** Override `updated_at`; defaults to Date.now(). */
  readonly nowMs?: number;
}

function tokenCountFromAttrs(
  attrs: Record<string, string | number | boolean | null>,
  key: string,
): number {
  const v = attrs[key];
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 0;
}

export function aggregateTrace(
  trace: Trace,
  orgId: string,
  opts: AggregateTraceOpts = {},
): ConversationRow {
  const spans = trace.spans;
  const startedMs = trace.startTimeMs;
  const endedMs =
    trace.endTimeMs ??
    (spans.length > 0 ? Math.max(...spans.map((s) => s.endTimeMs ?? s.startTimeMs)) : startedMs);
  const durationMs = Math.max(0, endedMs - startedMs);

  let totalToolCalls = 0;
  let totalLlmCalls = 0;
  let errorCount = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const s of spans) {
    if (s.kind === "tool_call") totalToolCalls += 1;
    if (s.kind === "llm_call") totalLlmCalls += 1;
    if (s.status === "error") errorCount += 1;
    inputTokens += tokenCountFromAttrs(s.attributes, "gen_ai.usage.input_tokens");
    outputTokens += tokenCountFromAttrs(s.attributes, "gen_ai.usage.output_tokens");
  }

  const status: "ok" | "error" | "unset" =
    errorCount > 0 ? "error" : totalLlmCalls + totalToolCalls > 0 ? "ok" : "unset";

  const inputFn = opts.extractInputPreview ?? extractInputPreview;
  const outputFn = opts.extractOutputPreview ?? extractOutputPreview;

  const now = opts.nowMs ?? Date.now();

  const row: ConversationRow = {
    org_id: orgId,
    trace_id: trace.id,
    agent_id: trace.agentId || null,
    started_at: msToCHDateTime64(startedMs),
    ended_at: msToCHDateTime64(endedMs),
    duration_ms: Math.floor(durationMs),
    total_spans: spans.length,
    total_tool_calls: totalToolCalls,
    total_llm_calls: totalLlmCalls,
    total_subagent_calls: 0, // WP15
    error_count: errorCount,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd_micros: 0, // WP16
    status,
    user_input_preview: inputFn(spans),
    agent_output_preview: outputFn(spans),
    schema_version: "v1",
    updated_at: msToCHDateTime64_3(now),
  };
  return row;
}

// ---------------------------------------------------------------------------
// Writes.
// ---------------------------------------------------------------------------

export async function upsertConversationRow(
  client: AnalyticsClient,
  row: ConversationRow,
): Promise<void> {
  // ReplacingMergeTree dedupes on ORDER BY (`(org_id, trace_id)`) using
  // `updated_at` as the version column. Inserting is the upsert.
  await client.raw.insert({
    table: "conversation_rows",
    values: [row],
    format: "JSONEachRow",
  });
}

export async function upsertConversationRows(
  client: AnalyticsClient,
  rows: readonly ConversationRow[],
): Promise<void> {
  if (rows.length === 0) return;
  await client.raw.insert({
    table: "conversation_rows",
    values: rows as ConversationRow[],
    format: "JSONEachRow",
  });
}

// ---------------------------------------------------------------------------
// Reads.
// ---------------------------------------------------------------------------

export interface GetConversationOpts {
  readonly org: ScopedOrg;
  readonly traceId: string;
}

export async function getConversation(
  client: AnalyticsClient,
  opts: GetConversationOpts,
): Promise<ConversationRow | null> {
  assertScoped(opts.org);
  // `FINAL` collapses ReplacingMergeTree duplicates for a single-row read.
  const result = await client.raw.query({
    query: `
      SELECT *
      FROM conversation_rows FINAL
      WHERE org_id = {orgId:String}
        AND trace_id = {traceId:String}
      LIMIT 1
      FORMAT JSONEachRow
    `,
    query_params: { orgId: opts.org.orgId, traceId: opts.traceId },
    format: "JSONEachRow",
  });
  const rows = (await result.json()) as ConversationRow[];
  return rows[0] ?? null;
}

export interface ListConversationsOpts {
  readonly org: ScopedOrg;
  readonly from: Date;
  readonly to: Date;
  readonly agentId?: string;
  readonly status?: "ok" | "error" | "unset";
  readonly limit?: number;
  readonly cursor?: string;
}

export interface ListConversationsResult {
  readonly rows: readonly ConversationRow[];
  readonly nextCursor?: string;
}

export async function listConversations(
  client: AnalyticsClient,
  opts: ListConversationsOpts,
): Promise<ListConversationsResult> {
  assertScoped(opts.org);
  const limit = opts.limit ?? 50;
  const { cursorStart, cursorTraceId } = parseCursor(opts.cursor);
  const hasCursor = cursorStart !== null && cursorTraceId !== null;

  const filters: string[] = [
    "org_id = {orgId:String}",
    "started_at >= {from:DateTime64(9)}",
    "started_at < {to:DateTime64(9)}",
  ];
  if (opts.agentId) filters.push("agent_id = {agentId:String}");
  if (opts.status) filters.push("status = {status:String}");
  if (hasCursor) {
    filters.push("(started_at, trace_id) < ({cursorStart:DateTime64(9)}, {cursorTraceId:String})");
  }

  const params: Record<string, unknown> = {
    orgId: opts.org.orgId,
    from: toCHTs(opts.from),
    to: toCHTs(opts.to),
    limit,
  };
  if (opts.agentId) params["agentId"] = opts.agentId;
  if (opts.status) params["status"] = opts.status;
  if (hasCursor) {
    params["cursorStart"] = cursorStart;
    params["cursorTraceId"] = cursorTraceId;
  }

  const result = await client.raw.query({
    query: `
      SELECT *
      FROM conversation_rows FINAL
      WHERE ${filters.join(" AND ")}
      ORDER BY started_at DESC, trace_id DESC
      LIMIT {limit:UInt32}
      FORMAT JSONEachRow
    `,
    query_params: params,
    format: "JSONEachRow",
  });
  const rows = (await result.json()) as ConversationRow[];

  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length >= limit && last ? makeCursor(last.started_at, last.trace_id) : undefined;
  return { rows, ...(nextCursor !== undefined ? { nextCursor } : {}) };
}

export interface GetHourlyRollupOpts {
  readonly org: ScopedOrg;
  readonly from: Date;
  readonly to: Date;
  readonly agentId?: string;
}

export async function getHourlyRollup(
  client: AnalyticsClient,
  opts: GetHourlyRollupOpts,
): Promise<HourlyRollupPoint[]> {
  assertScoped(opts.org);
  const filters: string[] = [
    "org_id = {orgId:String}",
    "hour >= {from:DateTime}",
    "hour < {to:DateTime}",
  ];
  const params: Record<string, unknown> = {
    orgId: opts.org.orgId,
    from: toCHDateTime(opts.from),
    to: toCHDateTime(opts.to),
  };
  if (opts.agentId) {
    filters.push("agent_id = {agentId:String}");
    params["agentId"] = opts.agentId;
  }

  // SummingMergeTree may hold multiple parts per key; always aggregate at read.
  const result = await client.raw.query({
    query: `
      SELECT
        org_id,
        agent_id,
        hour,
        sum(span_count)          AS span_count,
        sum(prompt_tokens)       AS prompt_tokens,
        sum(completion_tokens)   AS completion_tokens,
        sum(cost_usd_micros)     AS cost_usd_micros,
        sum(error_count)         AS error_count,
        toUInt32(quantileMerge(0.95)(p95_duration_state)) AS p95_duration_ms
      FROM hourly_rollups
      WHERE ${filters.join(" AND ")}
      GROUP BY org_id, agent_id, hour
      ORDER BY hour ASC
      FORMAT JSONEachRow
    `,
    query_params: params,
    format: "JSONEachRow",
  });
  return (await result.json()) as HourlyRollupPoint[];
}

// ---------------------------------------------------------------------------
// Cursor + timestamp helpers.
// ---------------------------------------------------------------------------

function makeCursor(startedAt: string, traceId: string): string {
  return Buffer.from(`${startedAt}|${traceId}`, "utf8").toString("base64url");
}

export function parseCursor(
  cursor: string | undefined,
): { cursorStart: string | null; cursorTraceId: string | null } {
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

function toCHDateTime(d: Date): string {
  // DateTime (second-precision) format: "YYYY-MM-DD HH:MM:SS"
  return d.toISOString().replace("T", " ").replace(/\..+$/, "");
}

// ---------------------------------------------------------------------------
// Test hook: returns the compiled WHERE fragment for listConversations.
// ---------------------------------------------------------------------------

export function __buildListConversationsSqlForTest(
  opts: Omit<ListConversationsOpts, "org"> & { orgId: string },
): { sql: string; params: Record<string, unknown> } {
  const filters: string[] = [
    "org_id = {orgId:String}",
    "started_at >= {from:DateTime64(9)}",
    "started_at < {to:DateTime64(9)}",
  ];
  if (opts.agentId) filters.push("agent_id = {agentId:String}");
  if (opts.status) filters.push("status = {status:String}");
  return {
    sql: `WHERE ${filters.join(" AND ")}`,
    params: {
      orgId: opts.orgId,
      from: toCHTs(opts.from),
      to: toCHTs(opts.to),
      ...(opts.agentId ? { agentId: opts.agentId } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    },
  };
}
