import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "./client.js";
import { adminAuditLog, apiKeys, memberships, organizations, users } from "./schema.js";

// ──────────────────────────────────────────────────────────────────────────────
// Crypto helpers
// ──────────────────────────────────────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const derived = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuf, derived);
}

export function generateApiKey(): { key: string; prefix: string; keyHash: string } {
  const raw = randomBytes(32).toString("hex");
  const key = `sk-${raw}`;
  const prefix = key.slice(0, 10);
  const keyHash = createHash("sha256").update(key).digest("hex");
  return { key, prefix, keyHash };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// ──────────────────────────────────────────────────────────────────────────────
// User queries
// ──────────────────────────────────────────────────────────────────────────────

export async function getUserByEmail(email: string) {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function getUserById(id: string) {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export interface CreateUserInput {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
}

export async function createUser(input: CreateUserInput) {
  const rows = await db.insert(users).values(input).returning();
  return rows[0]!;
}

// ──────────────────────────────────────────────────────────────────────────────
// Membership queries
// ──────────────────────────────────────────────────────────────────────────────

export async function getMembershipsByUser(userId: string) {
  return db
    .select({
      org: organizations,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(eq(memberships.userId, userId));
}

// ──────────────────────────────────────────────────────────────────────────────
// Sign-up: create org + user + owner membership atomically
// ──────────────────────────────────────────────────────────────────────────────

export interface SignupInput {
  userId: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  email: string;
  passwordHash: string;
  name: string;
}

export async function signup(input: SignupInput) {
  return db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({ id: input.orgId, name: input.orgName, slug: input.orgSlug })
      .returning();

    const [user] = await tx
      .insert(users)
      .values({
        id: input.userId,
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
      })
      .returning();

    await tx.insert(memberships).values({
      userId: input.userId,
      orgId: input.orgId,
      role: "owner",
    });

    return { org: org!, user: user! };
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// API key queries
// ──────────────────────────────────────────────────────────────────────────────

export type ApiKeyRejection =
  | { rejected: "expired" }
  | { rejected: "revoked" }
  | { rejected: "not_found" };
export type ResolvedApiKey = {
  apiKey: typeof apiKeys.$inferSelect;
  org: typeof organizations.$inferSelect;
};

export async function resolveApiKey(key: string): Promise<ResolvedApiKey | ApiKeyRejection> {
  const keyHash = hashApiKey(key);

  const rows = await db
    .select({
      apiKey: apiKeys,
      org: organizations,
    })
    .from(apiKeys)
    .innerJoin(organizations, eq(apiKeys.orgId, organizations.id))
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);
  const row = rows[0] ?? null;
  if (!row) return { rejected: "not_found" };

  if (row.apiKey.revokedAt) return { rejected: "revoked" };

  if (row.apiKey.expiresAt && row.apiKey.expiresAt < new Date()) {
    return { rejected: "expired" };
  }

  return row;
}

export async function touchApiKeyLastUsed(keyId: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, keyId),
        sql`(${apiKeys.lastUsedAt} IS NULL OR ${apiKeys.lastUsedAt} < now() - interval '60 seconds')`,
      ),
    );
}

export interface CreateApiKeyInput {
  id: string;
  orgId: string;
  keyHash: string;
  prefix: string;
  name: string;
  createdByUserId: string;
  expiresAt?: Date | null;
  scopes?: string | null;
}

export async function createApiKey(input: CreateApiKeyInput) {
  const rows = await db.insert(apiKeys).values(input).returning();
  return rows[0]!;
}

export async function listApiKeys(orgId: string) {
  const rows = await db
    .select({
      id: apiKeys.id,
      orgId: apiKeys.orgId,
      prefix: apiKeys.prefix,
      name: apiKeys.name,
      createdByUserId: apiKeys.createdByUserId,
      expiresAt: apiKeys.expiresAt,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.orgId, orgId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));

  const now = new Date();
  return rows.map((k) => ({
    ...k,
    isExpired: k.expiresAt != null && k.expiresAt < now,
  }));
}

export async function revokeApiKey(id: string, orgId: string): Promise<boolean> {
  const rows = await db
    .update(apiKeys)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.orgId, orgId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  return rows.length > 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Admin audit log
// ──────────────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  orgId: string;
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const id = `aud_${randomBytes(16).toString("hex")}`;
  await db.insert(adminAuditLog).values({
    id,
    orgId: entry.orgId,
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? {},
    ipAddress: entry.ipAddress ?? null,
  });
}

export async function getAuditLog(orgId: string, options?: { limit?: number; offset?: number }) {
  const limit = Math.min(options?.limit ?? 50, 500);
  const offset = options?.offset ?? 0;
  return db
    .select()
    .from(adminAuditLog)
    .where(eq(adminAuditLog.orgId, orgId))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit)
    .offset(offset);
}
