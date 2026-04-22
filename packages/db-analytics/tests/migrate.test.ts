import { describe, it, expect } from "vitest";
import { listMigrations, readMigration, splitStatements } from "../src/migrate.js";

describe("db-analytics · migrate · listMigrations", () => {
  it("returns all SQL files in sorted order", async () => {
    const names = await listMigrations();
    expect(names.length).toBeGreaterThan(0);
    expect(names[0]).toMatch(/^001_.+\.sql$/);
    // Sorted alphabetically.
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it("can read the contents of the initial migration", async () => {
    const content = await readMigration("001_init.sql");
    expect(content).toContain("CREATE TABLE IF NOT EXISTS spans");
    expect(content).toContain("ORDER BY (org_id, trace_id, start_time)");
    expect(content).toContain("PARTITION BY toYYYYMMDD(start_time)");
  });
});

describe("db-analytics · migrate · splitStatements", () => {
  it("splits on `;` and drops comments", () => {
    const sql = `
      -- header comment
      CREATE TABLE a (x String) ENGINE=Memory;
      CREATE TABLE b (y String) ENGINE=Memory;
      -- trailing comment
    `;
    const stmts = splitStatements(sql);
    expect(stmts).toHaveLength(2);
    expect(stmts[0]).toContain("CREATE TABLE a");
    expect(stmts[1]).toContain("CREATE TABLE b");
  });

  it("ignores inline `--` comments but preserves code on the same line", () => {
    const sql = "CREATE TABLE a (x String) ENGINE=Memory; -- inline";
    const [stmt] = splitStatements(sql);
    expect(stmt).toContain("CREATE TABLE a");
    expect(stmt).not.toContain("inline");
  });

  it("returns an empty array for whitespace-only input", () => {
    expect(splitStatements("   ")).toEqual([]);
    expect(splitStatements("-- only a comment\n")).toEqual([]);
  });
});

describe("db-analytics · migrate · 001_init.sql schema sanity", () => {
  it("declares all reserved-for-later columns (nullable)", async () => {
    const sql = await readMigration("001_init.sql");
    // Reserved for WP15 (agent_id).
    expect(sql).toMatch(/agent_id\s+Nullable\(String\)/);
    // Reserved for WP16 (cost).
    expect(sql).toMatch(/cost_usd_micros\s+Nullable\(Int64\)/);
    // Reserved for WP10 (blob URIs).
    expect(sql).toMatch(/input_uri\s+Nullable\(String\)/);
    expect(sql).toMatch(/output_uri\s+Nullable\(String\)/);
  });

  it("uses LowCardinality for string enums", async () => {
    const sql = await readMigration("001_init.sql");
    expect(sql).toMatch(/kind\s+LowCardinality\(String\)/);
    expect(sql).toMatch(/status\s+LowCardinality\(String\)/);
  });

  it("sets TTL at 90 days so WP17 has a default to replace", async () => {
    const sql = await readMigration("001_init.sql");
    expect(sql).toMatch(/TTL .+ INTERVAL 90 DAY/);
  });
});
