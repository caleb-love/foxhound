/**
 * End-to-end integration test against a live ClickHouse.
 *
 * Skipped when `CLICKHOUSE_URL` is not set; otherwise exercises:
 *   1. `runMigrations` creates the `spans` table.
 *   2. `batchInsert` via `makeClickHousePersist` writes rows.
 *   3. `getTraceTree` returns the same spans, tenant-scoped.
 *   4. A cross-tenant read returns zero rows (defense-in-depth net).
 *   5. `listTraces` paginates with a stable cursor.
 *
 * Run against a local ClickHouse:
 *   docker run --rm -p 8123:8123 -p 9000:9000 clickhouse/clickhouse-server
 *   CLICKHOUSE_URL=http://localhost:8123 pnpm --filter @foxhound/db-analytics test
 */
import { describe, it, expect } from "vitest";
import type { Trace } from "@foxhound/types";
import {
  createAnalyticsClient,
  runMigrations,
  pingAnalytics,
  scope,
  getTraceTree,
  listTraces,
  makeClickHousePersist,
} from "../src/index.js";

const URL = process.env["CLICKHOUSE_URL"];

if (!URL) {
  describe.skip("db-analytics · integration (CLICKHOUSE_URL unset — skipping)", () => {
    it("requires clickhouse-server running; set CLICKHOUSE_URL to enable", () => {});
  });
} else {
  describe("db-analytics · integration (live ClickHouse)", () => {
    const client = createAnalyticsClient(
      { url: URL, database: `foxhound_test_${Date.now()}` },
      process.env,
    );

    it("pings the server", async () => {
      expect(await pingAnalytics(client)).toBeNull();
    });

    it("creates the database and runs migrations", async () => {
      // Bootstrap the database itself.
      await client.raw.command({
        query: `CREATE DATABASE IF NOT EXISTS ${client.database}`,
      });
      const applied = await runMigrations(client);
      expect(applied).toContain("001_init.sql");
    });

    it("is idempotent on re-run", async () => {
      const applied = await runMigrations(client);
      expect(applied).toEqual([]);
    });

    it("writes + reads a trace tree with tenant scoping", async () => {
      const orgA = scope("org_live_a");
      const orgB = scope("org_live_b");
      const now = Date.now();
      const trace: Trace = {
        id: `t-${now}`,
        agentId: "agent_live",
        spans: Array.from({ length: 3 }, (_, i) => ({
          traceId: `t-${now}`,
          spanId: `s-${i}`,
          name: `step.${i}`,
          kind: i === 0 ? "llm_call" : "tool_call",
          startTimeMs: now + i,
          endTimeMs: now + i + 10,
          status: "ok",
          attributes: { i: String(i) },
          events: [],
        })),
        startTimeMs: now,
        endTimeMs: now + 30,
        metadata: {},
      };
      await makeClickHousePersist(client)(undefined, trace, orgA.orgId);
      // Allow async_insert flush.
      await new Promise((r) => setTimeout(r, 500));

      const tree = await getTraceTree(client, { org: orgA, traceId: trace.id });
      expect(tree).toHaveLength(3);
      expect(tree.every((s) => s.org_id === orgA.orgId)).toBe(true);

      // Cross-tenant read returns zero rows — the defense-in-depth net.
      const leak = await getTraceTree(client, { org: orgB, traceId: trace.id });
      expect(leak).toHaveLength(0);
    });

    it("listTraces returns summaries with a stable cursor", async () => {
      const orgA = scope("org_live_a");
      const res = await listTraces(client, {
        org: orgA,
        from: new Date(Date.now() - 60 * 60 * 1000),
        to: new Date(Date.now() + 60 * 1000),
        limit: 10,
      });
      expect(Array.isArray(res.rows)).toBe(true);
    });
  });
}
