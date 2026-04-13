/**
 * Integration test setup for @foxhound/db.
 *
 * Connects to a real PostgreSQL instance, runs all migrations,
 * and provides factory helpers for creating test data.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema.js";
import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash, randomBytes } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "../drizzle");

// ──────────────────────────────────────────────────────────────────────────────
// Test database connection
// ──────────────────────────────────────────────────────────────────────────────

const TEST_DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgres://foxhound:foxhound@localhost:5432/foxhound_dev";

/** Whether a test database is configured and available. */
export const hasDatabase = !!process.env["DATABASE_URL"];

const client = postgres(TEST_DATABASE_URL, { max: 5 });
export const testDb = drizzle(client, { schema });

// ──────────────────────────────────────────────────────────────────────────────
// Migration runner
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Read all numbered SQL migration files and execute them in order.
 * Migrations are idempotent (CREATE TABLE IF NOT EXISTS patterns in Drizzle output).
 */
export async function runMigrations(): Promise<void> {
  const files = await readdir(MIGRATIONS_DIR);
  const sqlFiles = files
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  for (const file of sqlFiles) {
    const content = await readFile(join(MIGRATIONS_DIR, file), "utf-8");
    // Split on the Drizzle statement breakpoint marker so each statement runs individually
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await client.unsafe(stmt);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Cleanup — truncate all tables between tests
// ──────────────────────────────────────────────────────────────────────────────

const ALL_TABLES = [
  "experiment_runs",
  "experiments",
  "dataset_items",
  "datasets",
  "annotation_queue_items",
  "annotation_queues",
  "evaluator_runs",
  "evaluators",
  "scores",
  "sso_sessions",
  "sso_configs",
  "notification_log",
  "alert_rules",
  "notification_channels",
  "admin_audit_log",
  "usage_records",
  "behavior_baselines",
  "model_pricing_overrides",
  "agent_configs",
  "spans",
  "audit_events",
  "traces",
  "api_keys",
  "memberships",
  "waitlist_signups",
  "users",
  "organizations",
] as const;

export async function truncateAll(): Promise<void> {
  // Use TRUNCATE CASCADE on all tables in a single statement for speed
  const tableList = ALL_TABLES.join(", ");
  await client.unsafe(`TRUNCATE TABLE ${tableList} CASCADE`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Close connection
// ──────────────────────────────────────────────────────────────────────────────

export async function closeConnection(): Promise<void> {
  await client.end();
}

// ──────────────────────────────────────────────────────────────────────────────
// ID generator
// ──────────────────────────────────────────────────────────────────────────────

let idCounter = 0;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_test_${idCounter}_${randomBytes(4).toString("hex")}`;
}

/** Reset the counter between test files if needed. */
export function resetIdCounter(): void {
  idCounter = 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Factory helpers
// ──────────────────────────────────────────────────────────────────────────────

export interface TestOrgResult {
  id: string;
  name: string;
  slug: string;
}

export async function createTestOrg(
  overrides: Partial<typeof schema.organizations.$inferInsert> = {},
): Promise<TestOrgResult> {
  const id = overrides.id ?? nextId("org");
  const name = overrides.name ?? `Test Org ${id}`;
  const slug = overrides.slug ?? `test-org-${id}`;

  const [row] = await testDb
    .insert(schema.organizations)
    .values({
      id,
      name,
      slug,
      plan: overrides.plan ?? "free",
      llmEvaluationEnabled: overrides.llmEvaluationEnabled ?? false,
      retentionDays: overrides.retentionDays ?? 90,
      samplingRate: overrides.samplingRate ?? 1.0,
      ...overrides,
    })
    .returning();

  return { id: row!.id, name: row!.name, slug: row!.slug };
}

export interface TestUserResult {
  id: string;
  email: string;
  name: string;
}

export async function createTestUser(
  overrides: Partial<typeof schema.users.$inferInsert> = {},
): Promise<TestUserResult> {
  const id = overrides.id ?? nextId("usr");
  const email = overrides.email ?? `${id}@test.foxhound.dev`;
  const name = overrides.name ?? `Test User ${id}`;

  const [row] = await testDb
    .insert(schema.users)
    .values({
      id,
      email,
      passwordHash: overrides.passwordHash ?? "placeholder:hash",
      name,
      ...overrides,
    })
    .returning();

  return { id: row!.id, email: row!.email, name: row!.name };
}

export async function createTestMembership(
  userId: string,
  orgId: string,
  role: "owner" | "admin" | "member" = "member",
): Promise<void> {
  await testDb.insert(schema.memberships).values({ userId, orgId, role });
}

export interface TestApiKeyResult {
  id: string;
  orgId: string;
  rawKey: string;
  keyHash: string;
  prefix: string;
}

export async function createTestApiKey(
  orgId: string,
  createdByUserId: string,
  overrides: Partial<typeof schema.apiKeys.$inferInsert> = {},
): Promise<TestApiKeyResult> {
  const id = overrides.id ?? nextId("key");
  const rawKey = `sk-${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const prefix = rawKey.slice(0, 10);

  await testDb.insert(schema.apiKeys).values({
    ...overrides,
    id,
    orgId,
    keyHash,
    prefix,
    name: overrides.name ?? `Test Key ${id}`,
    createdByUserId,
    expiresAt: overrides.expiresAt ?? null,
    scopes: overrides.scopes ?? null,
    revokedAt: overrides.revokedAt ?? null,
  });

  return { id, orgId, rawKey, keyHash, prefix };
}

export interface TestTraceResult {
  id: string;
  orgId: string;
  agentId: string;
}

export async function createTestTrace(
  orgId: string,
  overrides: Partial<typeof schema.traces.$inferInsert> = {},
): Promise<TestTraceResult> {
  const id = overrides.id ?? nextId("trc");
  const agentId = overrides.agentId ?? "test-agent";

  const [row] = await testDb
    .insert(schema.traces)
    .values({
      id,
      orgId,
      agentId,
      sessionId: overrides.sessionId ?? null,
      startTimeMs: overrides.startTimeMs ?? Date.now(),
      endTimeMs: overrides.endTimeMs ?? null,
      spans: overrides.spans ?? [],
      metadata: overrides.metadata ?? {},
      parentAgentId: overrides.parentAgentId ?? null,
      correlationId: overrides.correlationId ?? null,
      ...overrides,
    })
    .returning();

  return { id: row!.id, orgId: row!.orgId, agentId: row!.agentId };
}

export async function createTestEvaluator(
  orgId: string,
  overrides: Partial<typeof schema.evaluators.$inferInsert> = {},
) {
  const id = overrides.id ?? nextId("eval");

  const [row] = await testDb
    .insert(schema.evaluators)
    .values({
      id,
      orgId,
      name: overrides.name ?? `Test Evaluator ${id}`,
      promptTemplate: overrides.promptTemplate ?? "Rate the {{output}} for helpfulness",
      model: overrides.model ?? "gpt-4o",
      scoringType: overrides.scoringType ?? "numeric",
      labels: overrides.labels ?? [],
      enabled: overrides.enabled ?? true,
      ...overrides,
    })
    .returning();

  return row!;
}

export async function createTestDataset(
  orgId: string,
  overrides: Partial<typeof schema.datasets.$inferInsert> = {},
) {
  const id = overrides.id ?? nextId("ds");

  const [row] = await testDb
    .insert(schema.datasets)
    .values({
      id,
      orgId,
      name: overrides.name ?? `Test Dataset ${id}`,
      description: overrides.description ?? null,
      ...overrides,
    })
    .returning();

  return row!;
}

export async function createTestScore(
  orgId: string,
  traceId: string,
  overrides: Partial<typeof schema.scores.$inferInsert> = {},
) {
  const id = overrides.id ?? nextId("scr");

  const [row] = await testDb
    .insert(schema.scores)
    .values({
      id,
      orgId,
      traceId,
      name: overrides.name ?? "helpfulness",
      value: overrides.value ?? 0.8,
      source: overrides.source ?? "sdk",
      label: overrides.label ?? null,
      comment: overrides.comment ?? null,
      userId: overrides.userId ?? null,
      spanId: overrides.spanId ?? null,
      ...overrides,
    })
    .returning();

  return row!;
}

export async function createTestAuditLogEntry(
  orgId: string,
  overrides: Partial<typeof schema.adminAuditLog.$inferInsert> = {},
) {
  const id = overrides.id ?? nextId("aud");

  const [row] = await testDb
    .insert(schema.adminAuditLog)
    .values({
      id,
      orgId,
      action: overrides.action ?? "api_key.create",
      targetType: overrides.targetType ?? "api_key",
      targetId: overrides.targetId ?? null,
      actorUserId: overrides.actorUserId ?? null,
      metadata: overrides.metadata ?? {},
      ipAddress: overrides.ipAddress ?? null,
      ...overrides,
    })
    .returning();

  return row!;
}
