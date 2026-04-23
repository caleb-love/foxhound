/**
 * Span insert + per-span query helpers.
 *
 * Insert path: `rowFromInternalSpan()` converts an internal `FxSpan`
 * (millisecond timestamps, typed attribute values) to the wire `SpanRow`
 * shape (ISO-nano timestamps, stringly-flattened attributes). `batchInsert()`
 * writes N rows in one CH `INSERT INTO spans` call.
 *
 * All read paths go through `ScopedOrg` (`guard.ts`) so a caller cannot
 * accidentally issue a cross-tenant query.
 */
import type { AnalyticsClient } from "../client.js";
import { type ScopedOrg, assertScoped } from "../guard.js";
import type { InternalSpan, SpanRow } from "../types.js";

// ---------------------------------------------------------------------------
// Internal → wire mapping.
// ---------------------------------------------------------------------------

/** Convert a JS millisecond timestamp to CH DateTime64(9) ISO format. */
export function msToClickHouseDateTime64(ms: number): string {
  // DateTime64(9) accepts `"YYYY-MM-DD HH:MM:SS.fffffffff"`. We emit up to
  // millisecond precision since the internal shape is ms-based; lower
  // 6 digits stay zero. The insert tolerates this and indexes identically.
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

function attrsToStrMap(
  attrs: Record<string, string | number | boolean | null>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    out[k] = typeof v === "string" ? v : String(v);
  }
  return out;
}

export interface RowFromSpanOpts {
  readonly orgId: string;
  /** Extracted from the parent trace; passed in by the caller. */
  readonly agentId?: string;
  /** Extracted from span attributes by the caller (`gen_ai.request.model`). */
  readonly model?: string;
  /** Extracted from span attributes (`gen_ai.usage.input_tokens`). */
  readonly promptTokens?: number;
  /** Extracted from span attributes (`gen_ai.usage.output_tokens`). */
  readonly completionTokens?: number;
  /** WP16 will populate via the pricing table. */
  readonly costUsdMicros?: number;
  /** WP10 will populate by offloading to blob store. */
  readonly inputUri?: string;
  readonly outputUri?: string;
}

export function rowFromInternalSpan(span: InternalSpan, opts: RowFromSpanOpts): SpanRow {
  const attrs = attrsToStrMap(span.attributes);
  const agentId = opts.agentId ?? null;
  const model = opts.model ?? extractModelFromAttrs(span.attributes) ?? null;
  const promptTokens = opts.promptTokens ?? extractTokenCount(span.attributes, "input") ?? null;
  const completionTokens =
    opts.completionTokens ?? extractTokenCount(span.attributes, "output") ?? null;

  return {
    org_id: opts.orgId,
    trace_id: span.traceId,
    span_id: span.spanId,
    parent_span_id: span.parentSpanId ?? null,
    name: span.name,
    kind: span.kind,
    agent_id: agentId,
    start_time: msToClickHouseDateTime64(span.startTimeMs),
    end_time: msToClickHouseDateTime64(span.endTimeMs ?? span.startTimeMs),
    status: span.status,
    status_message: null,
    model,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    cost_usd_micros: opts.costUsdMicros ?? null,
    input_uri: opts.inputUri ?? null,
    output_uri: opts.outputUri ?? null,
    attributes: attrs,
    schema_version: "v1",
  };
}

function extractModelFromAttrs(
  attrs: Record<string, string | number | boolean | null>,
): string | undefined {
  const v = attrs["gen_ai.request.model"] ?? attrs["model"];
  return typeof v === "string" ? v : undefined;
}

function extractTokenCount(
  attrs: Record<string, string | number | boolean | null>,
  which: "input" | "output",
): number | undefined {
  const key = which === "input" ? "gen_ai.usage.input_tokens" : "gen_ai.usage.output_tokens";
  const v = attrs[key];
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  return undefined;
}

// ---------------------------------------------------------------------------
// Writes.
// ---------------------------------------------------------------------------

export async function batchInsert(
  client: AnalyticsClient,
  rows: readonly SpanRow[],
): Promise<void> {
  if (rows.length === 0) return;
  await client.raw.insert({
    table: "spans",
    values: rows as SpanRow[],
    format: "JSONEachRow",
  });
}

// ---------------------------------------------------------------------------
// Reads.
// ---------------------------------------------------------------------------

export interface GetSpanByIdOpts {
  readonly org: ScopedOrg;
  readonly spanId: string;
}

export async function getSpanById(
  client: AnalyticsClient,
  opts: GetSpanByIdOpts,
): Promise<SpanRow | null> {
  assertScoped(opts.org);
  const result = await client.raw.query({
    query: `
      SELECT *
      FROM spans
      WHERE org_id = {orgId:String}
        AND span_id = {spanId:String}
      LIMIT 1
      FORMAT JSONEachRow
    `,
    query_params: {
      orgId: opts.org.orgId,
      spanId: opts.spanId,
    },
    format: "JSONEachRow",
  });
  const rows = (await result.json()) as SpanRow[];
  return rows[0] ?? null;
}

export interface CountSpansOpts {
  readonly org: ScopedOrg;
  readonly from: Date;
  readonly to: Date;
}

export async function countSpans(client: AnalyticsClient, opts: CountSpansOpts): Promise<number> {
  assertScoped(opts.org);
  const result = await client.raw.query({
    query: `
      SELECT count() AS n
      FROM spans
      WHERE org_id = {orgId:String}
        AND start_time >= {from:DateTime64(9)}
        AND start_time < {to:DateTime64(9)}
      FORMAT JSONEachRow
    `,
    query_params: {
      orgId: opts.org.orgId,
      from: opts.from.toISOString().replace("T", " ").replace("Z", ""),
      to: opts.to.toISOString().replace("T", " ").replace("Z", ""),
    },
    format: "JSONEachRow",
  });
  const rows = (await result.json()) as Array<{ n: string | number }>;
  const n = rows[0]?.n;
  return typeof n === "string" ? Number(n) : (n ?? 0);
}
