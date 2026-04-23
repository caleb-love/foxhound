/**
 * Drop-in `persist()` implementation for `@foxhound/worker`'s
 * `IngestPersistenceConsumer`. Turns an internal `Trace` into N `SpanRow`
 * values and batch-inserts them into ClickHouse.
 *
 * Wiring (apps/worker entry point, a future follow-up once ClickHouse is
 * live on the operator host):
 *
 *   import { createAnalyticsClient, runMigrations, makeClickHousePersist } from "@foxhound/db-analytics";
 *   import { IngestPersistenceConsumer } from "./consumers/ingest-persistence.js";
 *
 *   const analytics = createAnalyticsClient();
 *   await runMigrations(analytics);
 *   const consumer = new IngestPersistenceConsumer({
 *     log,
 *     persist: makeClickHousePersist(analytics),
 *     metrics: (opts) => ingestMetrics.setQueueConsumerLag(opts),
 *   });
 *   await consumer.start();
 */
import type { Trace } from "@foxhound/types";
import type { AnalyticsClient } from "./client.js";
import { batchInsert, rowFromInternalSpan, type RowFromSpanOpts } from "./queries/spans.js";
import type { SpanRow } from "./types.js";

export interface MakeClickHousePersistOpts {
  /**
   * Extract per-trace context (agent_id, etc.) so rows can be filtered
   * efficiently later. Called once per trace; null-returning callers get
   * `null` stamped into every row.
   */
  readonly extractTraceContext?: (trace: Trace) => {
    readonly agentId?: string;
  };

  /**
   * WP16: compute per-span cost at persistence time using the time-
   * series pricing table. Called once per span; the implementation
   * typically delegates to `lookupPricing(orgId, model, at)` against
   * the control-plane Postgres so the returned value reflects the
   * price effective at `span.startTimeMs`. A `null` result leaves
   * `cost_usd_micros` unset on the row and the reader's aggregation
   * ignores it. The hook is deliberately optional so tests and
   * non-cost-aware pipelines (replay, backfill-to-shadow) can skip
   * the control-plane round trip.
   */
  readonly computeSpanCost?: (opts: {
    readonly orgId: string;
    readonly trace: Trace;
    readonly span: Trace["spans"][number];
  }) => Promise<number | null> | number | null;
}

export type PersistFn = (log: unknown, trace: Trace, orgId: string) => Promise<void>;

export function makeClickHousePersist(
  client: AnalyticsClient,
  opts: MakeClickHousePersistOpts = {},
): PersistFn {
  const extract = opts.extractTraceContext ?? ((t: Trace) => ({ agentId: t.agentId || undefined }));
  const computeCost = opts.computeSpanCost;
  return async (_log, trace, orgId): Promise<void> => {
    const traceCtx = extract(trace);
    // Resolve per-span cost in parallel when a hook is provided. The
    // hook may be async (Postgres round trip) or sync (in-memory
    // lookup); `Promise.all` handles both. USD-micros conversion
    // happens here so the row builder stays pure.
    const costs: Array<number | null> = computeCost
      ? await Promise.all(
          trace.spans.map(async (span) => {
            const usd = await Promise.resolve(computeCost({ orgId, trace, span }));
            return usd === null ? null : Math.round(usd * 1_000_000);
          }),
        )
      : trace.spans.map(() => null);
    const rows: SpanRow[] = trace.spans.map((span, i) => {
      const costMicros = costs[i] ?? null;
      const rowOpts: RowFromSpanOpts = {
        orgId,
        ...(traceCtx.agentId !== undefined ? { agentId: traceCtx.agentId } : {}),
        // Per-span override still wins at the row builder; this stays
        // the ground-truth path for WP15 + WP16 row composition.
        ...(span.agentId !== undefined && span.agentId !== "" ? { agentId: span.agentId } : {}),
        ...(costMicros !== null ? { costUsdMicros: costMicros } : {}),
      };
      return rowFromInternalSpan(span, rowOpts);
    });
    await batchInsert(client, rows);
  };
}
