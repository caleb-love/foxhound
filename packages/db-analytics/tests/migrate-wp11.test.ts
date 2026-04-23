import { describe, it, expect } from "vitest";
import { listMigrations, readMigration } from "../src/migrate.js";

describe("db-analytics · WP11 migrations landed", () => {
  it("lists 002 + 003 after the initial migration", async () => {
    const names = await listMigrations();
    expect(names).toContain("001_init.sql");
    expect(names).toContain("002_conversation_rows.sql");
    expect(names).toContain("003_hourly_rollups.sql");
    // Monotonic order.
    const i1 = names.indexOf("001_init.sql");
    const i2 = names.indexOf("002_conversation_rows.sql");
    const i3 = names.indexOf("003_hourly_rollups.sql");
    expect(i1).toBeLessThan(i2);
    expect(i2).toBeLessThan(i3);
  });

  it("002_conversation_rows.sql uses ReplacingMergeTree(updated_at)", async () => {
    const sql = await readMigration("002_conversation_rows.sql");
    expect(sql).toMatch(/ENGINE\s*=\s*ReplacingMergeTree\(updated_at\)/);
    expect(sql).toMatch(/ORDER BY\s*\(org_id,\s*trace_id\)/);
    expect(sql).toMatch(/PARTITION BY\s+toYYYYMMDD\(started_at\)/);
  });

  it("002 reserves nullable WP15 + WP16 fields", async () => {
    const sql = await readMigration("002_conversation_rows.sql");
    // total_subagent_calls exists with DEFAULT 0 (WP15 populates).
    expect(sql).toMatch(/total_subagent_calls\s+UInt32\s+DEFAULT\s+0/);
    // cost_usd_micros exists with DEFAULT 0 (WP16 populates).
    expect(sql).toMatch(/cost_usd_micros\s+Int64\s+DEFAULT\s+0/);
    // agent_id stays nullable until WP15 promotes it.
    expect(sql).toMatch(/agent_id\s+Nullable\(String\)/);
  });

  it("003_hourly_rollups.sql declares a target table + MATERIALIZED VIEW pair", async () => {
    const sql = await readMigration("003_hourly_rollups.sql");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS hourly_rollups/);
    expect(sql).toMatch(/ENGINE\s*=\s*SummingMergeTree/);
    expect(sql).toMatch(
      /CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_rollups_mv TO hourly_rollups AS/,
    );
    expect(sql).toMatch(/ORDER BY\s*\(org_id,\s*agent_id,\s*hour\)/);
    expect(sql).toMatch(/quantileState\(0\.95\)/);
  });

  it("003 uses coalesce to replace null agent_id with the sentinel 'unknown'", async () => {
    const sql = await readMigration("003_hourly_rollups.sql");
    expect(sql).toMatch(/coalesce\(agent_id,\s*'unknown'\)/);
  });
});
