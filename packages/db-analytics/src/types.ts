/**
 * Row and filter types for the analytics store.
 *
 * The wire format between producer (worker consumer) and store is
 * deliberately NOT the same shape as `@foxhound/types`'s `Span`: ClickHouse
 * wants flat-string attribute values and nanosecond timestamps encoded as
 * ISO strings (DateTime64). `rowFromInternalSpan()` in `queries/spans.ts`
 * performs that conversion once, at the write boundary.
 */
import type { Span as FxSpan } from "@foxhound/types";

/** Shape of a single row on the wire to ClickHouse. */
export interface SpanRow {
  readonly org_id: string;
  readonly trace_id: string;
  readonly span_id: string;
  readonly parent_span_id: string | null;
  readonly name: string;
  readonly kind: string;
  readonly agent_id: string | null;
  /** ISO-8601 with nanosecond precision: `"2026-04-20T12:34:56.789012345"`. */
  readonly start_time: string;
  readonly end_time: string;
  readonly status: "ok" | "error" | "unset";
  readonly status_message: string | null;
  readonly model: string | null;
  readonly prompt_tokens: number | null;
  readonly completion_tokens: number | null;
  readonly cost_usd_micros: number | null;
  readonly input_uri: string | null;
  readonly output_uri: string | null;
  readonly attributes: Record<string, string>;
  readonly schema_version: string;
}

/** Filter shape for tenant-scoped reads. `orgId` is required by type. */
export interface QueryTracesFilter {
  readonly orgId: string;
  readonly window: { readonly from: Date; readonly to: Date };
  /** Optional agent scope (WP15). */
  readonly agentId?: string;
  /** Optional status scope. */
  readonly status?: "ok" | "error" | "unset";
  /** Optional text search across span `name`. */
  readonly nameContains?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface GetTraceTreeFilter {
  readonly orgId: string;
  readonly traceId: string;
}

/** The sort of row an API endpoint wants back for a trace list. */
export interface TraceSummaryRow {
  readonly org_id: string;
  readonly trace_id: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly duration_ms: number;
  readonly span_count: number;
  readonly error_count: number;
}

/** Internal-to-wire adapter (exported for tests + for the worker). */
export type InternalSpan = FxSpan;
