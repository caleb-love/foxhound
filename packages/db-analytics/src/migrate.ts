/**
 * Migration runner for the analytics store.
 *
 * Simple monotonic-filename runner: reads `src/migrations/NNN_*.sql` in
 * order, records applied names in a bookkeeping table
 * `_foxhound_analytics_migrations`, and skips already-applied files.
 *
 * Not a replacement for Drizzle or similar; just enough to keep the
 * ClickHouse schema version-controlled in source.
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnalyticsClient } from "./client.js";

const MIGRATIONS_TABLE = "_foxhound_analytics_migrations";

async function resolveMigrationsDir(): Promise<string> {
  // In dev, `.ts` files live under `src/migrations/`. In built form we
  // copy to `dist/migrations/`. Both layouts resolve relative to this
  // file's directory.
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "migrations");
}

export interface MigrationRecord {
  readonly id: string;
  readonly appliedAt: string;
}

export async function listMigrations(): Promise<string[]> {
  const dir = await resolveMigrationsDir();
  const entries = await readdir(dir);
  return entries
    .filter((e) => e.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b, "en"));
}

export async function readMigration(name: string): Promise<string> {
  const dir = await resolveMigrationsDir();
  return readFile(resolve(dir, name), "utf8");
}

async function ensureBookkeeping(client: AnalyticsClient): Promise<void> {
  await client.raw.command({
    query: `
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id           String,
        applied_at   DateTime DEFAULT now()
      ) ENGINE = MergeTree ORDER BY id
    `,
  });
}

async function alreadyApplied(client: AnalyticsClient): Promise<Set<string>> {
  const result = await client.raw.query({
    query: `SELECT id FROM ${MIGRATIONS_TABLE}`,
    format: "JSONEachRow",
  });
  const rows = (await result.json()) as Array<{ id: string }>;
  return new Set(rows.map((r) => r.id));
}

/**
 * Apply any pending migrations. Idempotent: safe to run on every boot.
 * Returns the list of migrations newly applied this call (empty = nothing
 * to do).
 */
export async function runMigrations(client: AnalyticsClient): Promise<string[]> {
  await ensureBookkeeping(client);
  const applied = await alreadyApplied(client);
  const all = await listMigrations();
  const applied_now: string[] = [];
  for (const name of all) {
    if (applied.has(name)) continue;
    const sql = await readMigration(name);
    // CH "command" supports one statement at a time; split on `;` while
    // preserving comments-as-whole-statements-are-ignored. A simple splitter
    // suffices because our migrations are hand-written (no ambiguous `;`
    // inside string literals).
    for (const statement of splitStatements(sql)) {
      if (!statement.trim()) continue;
      await client.raw.command({ query: statement });
    }
    await client.raw.insert({
      table: MIGRATIONS_TABLE,
      values: [{ id: name }],
      format: "JSONEachRow",
    });
    applied_now.push(name);
  }
  return applied_now;
}

export function splitStatements(sql: string): string[] {
  // Conservative splitter: strip `--` line comments, then split on `;`.
  const stripped = sql
    .split("\n")
    .map((l) => {
      const commentAt = l.indexOf("--");
      return commentAt >= 0 ? l.slice(0, commentAt) : l;
    })
    .join("\n");
  return stripped
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
