/**
 * `@foxhound/db-analytics` — ClickHouse-backed telemetry store (WP09).
 *
 * Layering:
 *   - `@foxhound/db` (Postgres, Drizzle) stays the **control plane**: orgs,
 *     users, API keys, plans, alerts config, pricing history.
 *   - `@foxhound/db-analytics` (ClickHouse) is the **telemetry store**:
 *     spans today; rollups in WP11; agent aggregates in WP15.
 *
 * Tenant scoping is enforced by `ScopedOrg` in `guard.ts`. Every read
 * takes a `ScopedOrg`, which can only be produced by `scope(orgId)`.
 */
export { createAnalyticsClient, pingAnalytics } from "./client.js";
export type { AnalyticsClient, AnalyticsClientOptions } from "./client.js";
export { runMigrations, listMigrations, readMigration, splitStatements } from "./migrate.js";
export type { MigrationRecord } from "./migrate.js";
export { scope, assertScoped } from "./guard.js";
export type { ScopedOrg } from "./guard.js";
export {
  batchInsert,
  countSpans,
  getSpanById,
  rowFromInternalSpan,
  msToClickHouseDateTime64,
} from "./queries/spans.js";
export type { GetSpanByIdOpts, CountSpansOpts, RowFromSpanOpts } from "./queries/spans.js";
export {
  getTraceTree,
  listTraces,
  parseCursor,
  __buildListTracesSqlForTest,
} from "./queries/traces.js";
export type {
  GetTraceTreeOpts,
  ListTracesOpts,
  ListTracesResult,
} from "./queries/traces.js";
export {
  aggregateTrace,
  getConversation,
  getHourlyRollup,
  listConversations,
  upsertConversationRow,
  upsertConversationRows,
  PREVIEW_MAX_CHARS,
  __buildListConversationsSqlForTest,
} from "./queries/aggregates.js";
export type {
  ConversationRow,
  HourlyRollupPoint,
  GetConversationOpts,
  ListConversationsOpts,
  ListConversationsResult,
  GetHourlyRollupOpts,
  AggregateTraceOpts,
} from "./queries/aggregates.js";
export { makeClickHousePersist } from "./persistence.js";
export type { MakeClickHousePersistOpts, PersistFn } from "./persistence.js";
export type { SpanRow, TraceSummaryRow, QueryTracesFilter, GetTraceTreeFilter, InternalSpan } from "./types.js";
