/**
 * ClickHouse client wrapper.
 *
 * Single-entry-point for creating and sharing a `ClickHouseClient` across
 * the package. Consumers:
 *   - `apps/worker/` wiring — creates one client at startup, injects into
 *     `makeClickHousePersist()` and into the migrator.
 *   - `apps/api/` read-path (future WP09-follow-up) — creates one client
 *     at startup and injects into query helpers.
 *   - Tests that have `CLICKHOUSE_URL` set run the integration suite.
 *
 * Env:
 *   CLICKHOUSE_URL       "http://localhost:8123" (default)
 *   CLICKHOUSE_DATABASE  "foxhound"             (default)
 *   CLICKHOUSE_USERNAME  "default"              (default)
 *   CLICKHOUSE_PASSWORD  ""                      (default)
 *
 * All timeouts + request settings have sane defaults; override via the
 * options bag if you need a tighter budget.
 */
import { createClient, type ClickHouseClient } from "@clickhouse/client";

export interface AnalyticsClientOptions {
  readonly url?: string;
  readonly database?: string;
  readonly username?: string;
  readonly password?: string;
  /** Max number of rows buffered before flushing an insert. Default 10,000. */
  readonly insertBatchRows?: number;
  /** Max ms a row sits in the insert buffer before auto-flush. Default 100 ms. */
  readonly insertBatchMs?: number;
}

export interface AnalyticsClient {
  readonly raw: ClickHouseClient;
  readonly database: string;
  readonly options: Required<Omit<AnalyticsClientOptions, "password">> & { readonly password: string };
  close(): Promise<void>;
}

export function createAnalyticsClient(
  opts: AnalyticsClientOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): AnalyticsClient {
  const url = opts.url ?? env["CLICKHOUSE_URL"] ?? "http://localhost:8123";
  const database = opts.database ?? env["CLICKHOUSE_DATABASE"] ?? "foxhound";
  const username = opts.username ?? env["CLICKHOUSE_USERNAME"] ?? "default";
  const password = opts.password ?? env["CLICKHOUSE_PASSWORD"] ?? "";
  const insertBatchRows = opts.insertBatchRows ?? 10_000;
  const insertBatchMs = opts.insertBatchMs ?? 100;

  const raw = createClient({
    url,
    database,
    username,
    password,
    // Conservative client-side limits; tighter than CH server defaults so a
    // rogue query can't wedge the process.
    request_timeout: 30_000,
    max_open_connections: 20,
    compression: { request: true, response: true },
    // Performance toggles for fast insert + trusted-source data.
    clickhouse_settings: {
      async_insert: 1,
      wait_for_async_insert: 1,
      async_insert_max_data_size: String(1_000_000),
      async_insert_busy_timeout_ms: insertBatchMs,
    },
  });

  return {
    raw,
    database,
    options: { url, database, username, password, insertBatchRows, insertBatchMs },
    async close(): Promise<void> {
      await raw.close().catch(() => {});
    },
  };
}

/**
 * Probe whether the ClickHouse server is reachable.
 * Returns `null` on success, or the error string on failure. Used by the
 * integration test suite to decide whether to run end-to-end cases.
 */
export async function pingAnalytics(client: AnalyticsClient): Promise<string | null> {
  try {
    const result = await client.raw.ping();
    if (result.success) return null;
    return "ping returned success=false";
  } catch (err) {
    return (err as Error).message ?? "unknown";
  }
}
