import { db } from "./client.js";
import {
  traces,
  spans,
  users,
  organizations,
  memberships,
  apiKeys,
  usageRecords,
  notificationChannels,
  alertRules,
  notificationLog,
  ssoConfigs,
  ssoSessions,
  waitlistSignups,
  scores,
  evaluators,
  evaluatorRuns,
  annotationQueues,
  annotationQueueItems,
  datasets,
  datasetItems,
  experiments,
  experimentRuns,
  agentConfigs,
  behaviorBaselines,
  modelPricingOverrides,
  adminAuditLog,
  prompts,
  promptVersions,
  promptLabels,
} from "./schema.js";
import {
  eq,
  and,
  gt,
  gte,
  lte,
  lt,
  desc,
  asc,
  isNull,
  isNotNull,
  or,
  sql,
  count,
  inArray,
} from "drizzle-orm";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { Trace, Span } from "@foxhound/types";

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
// Organization queries
// ──────────────────────────────────────────────────────────────────────────────

export async function getOrganizationById(id: string) {
  const rows = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getOrganizationBySlug(slug: string) {
  const rows = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getOrganizationByStripeCustomerId(stripeCustomerId: string) {
  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateOrgStripeCustomerId(orgId: string, stripeCustomerId: string) {
  const rows = await db
    .update(organizations)
    .set({ stripeCustomerId, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
    .returning();
  return rows[0] ?? null;
}

export async function updateOrgPlan(orgId: string, plan: "free" | "pro" | "team" | "enterprise") {
  const rows = await db
    .update(organizations)
    .set({ plan, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
    .returning();
  return rows[0] ?? null;
}

export async function isLlmEvaluationEnabled(orgId: string): Promise<boolean> {
  const rows = await db
    .select({ llmEvaluationEnabled: organizations.llmEvaluationEnabled })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return rows[0]?.llmEvaluationEnabled ?? false;
}

export async function getUsageForPeriod(orgId: string, period: string) {
  const rows = await db
    .select()
    .from(usageRecords)
    .where(and(eq(usageRecords.orgId, orgId), eq(usageRecords.period, period)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertUsageRecord(orgId: string, period: string, additionalSpans: number) {
  const rows = await db
    .insert(usageRecords)
    .values({ orgId, period, spanCount: additionalSpans })
    .onConflictDoUpdate({
      target: [usageRecords.orgId, usageRecords.period],
      set: {
        spanCount: sql`${usageRecords.spanCount} + ${additionalSpans}`,
        updatedAt: new Date(),
      },
    })
    .returning();
  return rows[0]!;
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

  // First: look up by hash only (no revoked/expiry filter) so we can distinguish rejection reasons
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

/**
 * Update the lastUsedAt timestamp for an API key (fire-and-forget, no await needed by caller).
 * Skips the write if lastUsedAt was updated within the last 60 seconds to avoid
 * unnecessary write load on high-traffic keys.
 */
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

// ──────────────────────────────────────────────────────────────────────────────
// Trace queries (orgId-scoped)
// ──────────────────────────────────────────────────────────────────────────────

export interface TraceFilters {
  orgId: string;
  agentId?: string;
  sessionId?: string;
  /** Unix milliseconds lower bound (inclusive) */
  from?: number;
  /** Unix milliseconds upper bound (inclusive) */
  to?: number;
  page?: number;
  limit?: number;
}

export async function insertTrace(trace: Trace, orgId: string): Promise<void> {
  await db
    .insert(traces)
    .values({
      id: trace.id,
      orgId,
      agentId: trace.agentId,
      sessionId: trace.sessionId ?? null,
      startTimeMs: trace.startTimeMs,
      endTimeMs: trace.endTimeMs ?? null,
      parentAgentId: trace.parentAgentId ?? null,
      correlationId: trace.correlationId ?? null,
      // JSONB column kept for backwards compat reads (resolveSpans fallback)
      // but no longer written — normalized spans table is the source of truth
      spans: [],
      metadata: trace.metadata as Record<string, unknown>,
    })
    .onConflictDoNothing();
}

export async function getTrace(id: string, orgId: string) {
  const rows = await db
    .select()
    .from(traces)
    .where(and(eq(traces.id, id), eq(traces.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get a trace with spans resolved from normalized table (JSONB fallback).
 */
export async function getTraceWithSpans(id: string, orgId: string) {
  const row = await getTrace(id, orgId);
  if (!row) return null;
  const resolvedSpans = await resolveSpans(id, orgId, row);
  return { ...row, spans: resolvedSpans };
}

export interface ReplayContext {
  traceId: string;
  spanId: string;
  targetSpan: Span;
  spansUpToPoint: Span[];
  llmCallHistory: Span[];
  toolCallHistory: Span[];
  agentStepHistory: Span[];
}

/**
 * Resolve spans for a trace: prefer normalized spans table, fallback to JSONB.
 */
async function resolveSpans(
  traceId: string,
  orgId: string,
  existingRow?: { spans: unknown },
): Promise<Span[]> {
  const normalized = await getSpansByTraceId(traceId, orgId);
  if (normalized.length > 0) return normalized;

  // Fallback: read from legacy JSONB column
  const row = existingRow ?? (await getTrace(traceId, orgId));
  if (!row) return [];
  return (row.spans as unknown as Span[]).slice().sort((a, b) => a.startTimeMs - b.startTimeMs);
}

export async function getReplayContext(
  traceId: string,
  spanId: string,
  orgId: string,
): Promise<ReplayContext | null> {
  const row = await getTrace(traceId, orgId);
  if (!row) return null;

  const allSpans = await resolveSpans(traceId, orgId, row);

  const target = allSpans.find((s) => s.spanId === spanId);
  if (!target) return null;

  const spansUpToPoint = allSpans.filter((s) => s.startTimeMs <= target.startTimeMs);

  return {
    traceId,
    spanId,
    targetSpan: target,
    spansUpToPoint,
    llmCallHistory: spansUpToPoint.filter((s) => s.kind === "llm_call"),
    toolCallHistory: spansUpToPoint.filter((s) => s.kind === "tool_call"),
    agentStepHistory: spansUpToPoint.filter((s) => s.kind === "agent_step"),
  };
}

export type DivergenceReason =
  | "status_changed"
  | "attributes_changed"
  | "span_added"
  | "span_removed"
  | "name_changed";

export interface SpanDiff {
  position: number;
  kind: "matched" | "added" | "removed";
  spanA?: Span;
  spanB?: Span;
  diverged: boolean;
  divergenceReasons: DivergenceReason[];
  explanation: string;
}

export interface RunDiffResult {
  traceIdA: string;
  traceIdB: string;
  totalSpansA: number;
  totalSpansB: number;
  alignedSpans: SpanDiff[];
  divergenceCount: number;
  summary: string;
}

function lcsAlign(spansA: Span[], spansB: Span[]): Array<[number, number]> {
  const m = spansA.length;
  const n = spansB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const a = spansA[i - 1]!;
      const b = spansB[j - 1]!;
      if (a.name === b.name && a.kind === b.kind) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  const pairs: Array<[number, number]> = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    const a = spansA[i - 1]!;
    const b = spansB[j - 1]!;
    if (a.name === b.name && a.kind === b.kind) {
      pairs.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }
  return pairs;
}

function diffAttributes(a: Span["attributes"], b: Span["attributes"]): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return true;
  for (const k of keysA) {
    if (a[k] !== b[k]) return true;
  }
  return false;
}

function buildExplanation(reasons: DivergenceReason[], spanA?: Span, spanB?: Span): string {
  if (reasons.length === 0) return "Identical";
  const parts: string[] = [];
  for (const r of reasons) {
    if (r === "status_changed") {
      parts.push(`status changed from "${spanA?.status}" to "${spanB?.status}"`);
    } else if (r === "attributes_changed") {
      parts.push("span attributes differ (different inputs or tool results)");
    } else if (r === "span_added") {
      parts.push(`span "${spanB?.name}" present only in run B`);
    } else if (r === "span_removed") {
      parts.push(`span "${spanA?.name}" present only in run A`);
    } else if (r === "name_changed") {
      parts.push(`name changed from "${spanA?.name}" to "${spanB?.name}"`);
    }
  }
  return parts.join("; ");
}

export async function diffTraces(
  traceIdA: string,
  traceIdB: string,
  orgId: string,
): Promise<RunDiffResult | null> {
  const [rowA, rowB] = await Promise.all([getTrace(traceIdA, orgId), getTrace(traceIdB, orgId)]);
  if (!rowA || !rowB) return null;

  const [spansA, spansB] = await Promise.all([
    resolveSpans(traceIdA, orgId),
    resolveSpans(traceIdB, orgId),
  ]);

  const matchedPairs = lcsAlign(spansA, spansB);
  const matchedA = new Set(matchedPairs.map(([i]) => i));
  const matchedB = new Set(matchedPairs.map(([, j]) => j));

  const aligned: SpanDiff[] = [];
  let position = 0;
  let pairIdx = 0;
  let ai = 0;
  let bi = 0;

  while (ai < spansA.length || bi < spansB.length) {
    const nextPair = matchedPairs[pairIdx];

    if (nextPair && ai === nextPair[0] && bi === nextPair[1]) {
      const spanA = spansA[ai]!;
      const spanB = spansB[bi]!;
      const reasons: DivergenceReason[] = [];
      if (spanA.status !== spanB.status) reasons.push("status_changed");
      if (diffAttributes(spanA.attributes, spanB.attributes)) reasons.push("attributes_changed");
      aligned.push({
        position: position++,
        kind: "matched",
        spanA,
        spanB,
        diverged: reasons.length > 0,
        divergenceReasons: reasons,
        explanation: buildExplanation(reasons, spanA, spanB),
      });
      ai++;
      bi++;
      pairIdx++;
    } else if (ai < spansA.length && !matchedA.has(ai)) {
      const spanA = spansA[ai]!;
      aligned.push({
        position: position++,
        kind: "removed",
        spanA,
        diverged: true,
        divergenceReasons: ["span_removed"],
        explanation: buildExplanation(["span_removed"], spanA, undefined),
      });
      ai++;
    } else if (bi < spansB.length && !matchedB.has(bi)) {
      const spanB = spansB[bi]!;
      aligned.push({
        position: position++,
        kind: "added",
        spanB,
        diverged: true,
        divergenceReasons: ["span_added"],
        explanation: buildExplanation(["span_added"], undefined, spanB),
      });
      bi++;
    } else {
      if (ai < spansA.length) ai++;
      else bi++;
    }
  }

  const divergenceCount = aligned.filter((d) => d.diverged).length;

  const summaryParts: string[] = [];
  const addedCount = aligned.filter((d) => d.kind === "added").length;
  const removedCount = aligned.filter((d) => d.kind === "removed").length;
  const attrChangedCount = aligned.filter(
    (d) => d.kind === "matched" && d.divergenceReasons.includes("attributes_changed"),
  ).length;
  const statusChangedCount = aligned.filter(
    (d) => d.kind === "matched" && d.divergenceReasons.includes("status_changed"),
  ).length;

  if (divergenceCount === 0) {
    summaryParts.push("Runs are identical.");
  } else {
    if (addedCount > 0) summaryParts.push(`${addedCount} span(s) added in run B`);
    if (removedCount > 0) summaryParts.push(`${removedCount} span(s) removed in run B`);
    if (attrChangedCount > 0)
      summaryParts.push(`${attrChangedCount} span(s) with differing inputs or tool results`);
    if (statusChangedCount > 0)
      summaryParts.push(`${statusChangedCount} span(s) with status changes`);
  }

  return {
    traceIdA,
    traceIdB,
    totalSpansA: spansA.length,
    totalSpansB: spansB.length,
    alignedSpans: aligned,
    divergenceCount,
    summary: summaryParts.join("; ") || "No divergence detected.",
  };
}

export async function queryTraces(filters: TraceFilters) {
  const { orgId, agentId, sessionId, from, to, page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [eq(traces.orgId, orgId)];
  if (agentId) conditions.push(eq(traces.agentId, agentId));
  if (sessionId) conditions.push(eq(traces.sessionId, sessionId));
  if (from != null) conditions.push(gte(traces.startTimeMs, from));
  if (to != null) conditions.push(lte(traces.startTimeMs, to));

  return db
    .select()
    .from(traces)
    .where(and(...conditions))
    .orderBy(desc(traces.createdAt))
    .limit(limit)
    .offset(offset);
}

// ──────────────────────────────────────────────────────────────────────────────
// Normalized span queries
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Batch-insert normalized spans into the spans table.
 * Uses onConflictDoNothing for idempotent writes.
 */
export async function insertSpans(traceId: string, orgId: string, spanList: Span[]): Promise<void> {
  if (spanList.length === 0) return;
  await db
    .insert(spans)
    .values(
      spanList.map((s) => ({
        id: s.spanId,
        traceId,
        orgId,
        parentSpanId: s.parentSpanId ?? null,
        name: s.name,
        kind: s.kind,
        status: s.status,
        startTimeMs: s.startTimeMs,
        endTimeMs: s.endTimeMs ?? null,
        attributes: s.attributes,
        events: s.events,
      })),
    )
    .onConflictDoNothing();
}

/**
 * Batch-update cost_usd for spans that had their cost computed post-ingestion.
 */
export async function updateSpanCosts(
  costs: Array<{ traceId: string; spanId: string; costUsd: number }>,
  orgId: string,
): Promise<void> {
  if (costs.length === 0) return;
  await Promise.all(
    costs.map((c) =>
      db
        .update(spans)
        .set({ costUsd: String(c.costUsd) })
        .where(and(eq(spans.traceId, c.traceId), eq(spans.id, c.spanId), eq(spans.orgId, orgId))),
    ),
  );
}

/**
 * Fetch all normalized spans for a trace, ordered by start time.
 */
async function getSpansByTraceId(traceId: string, orgId: string): Promise<Span[]> {
  const rows = await db
    .select()
    .from(spans)
    .where(and(eq(spans.traceId, traceId), eq(spans.orgId, orgId)))
    .orderBy(asc(spans.startTimeMs));

  return rows.map((r) => ({
    traceId: r.traceId,
    spanId: r.id,
    parentSpanId: r.parentSpanId ?? undefined,
    name: r.name,
    kind: r.kind as Span["kind"],
    startTimeMs: r.startTimeMs,
    endTimeMs: r.endTimeMs ?? undefined,
    status: r.status as Span["status"],
    attributes: r.attributes as Span["attributes"],
    events: r.events as Span["events"],
  }));
}

/**
 * Delete traces older than the org's retention cutoff.
 * CASCADE will also delete associated spans.
 */
export async function deleteExpiredTraces(orgId: string, retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .delete(traces)
    .where(and(eq(traces.orgId, orgId), lt(traces.createdAt, cutoff)))
    .returning({ id: traces.id });
  return rows.length;
}

/**
 * Fetch all orgs with their retention config for the cleanup job.
 */
export async function getOrgsWithRetention() {
  return db
    .select({
      id: organizations.id,
      retentionDays: organizations.retentionDays,
    })
    .from(organizations);
}

// ──────────────────────────────────────────────────────────────────────────────
// Notification channel queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateChannelInput {
  id: string;
  orgId: string;
  kind: "slack";
  name: string;
  config: Record<string, unknown>;
}

export async function createNotificationChannel(input: CreateChannelInput) {
  const rows = await db.insert(notificationChannels).values(input).returning();
  return rows[0]!;
}

export async function listNotificationChannels(orgId: string) {
  return db
    .select()
    .from(notificationChannels)
    .where(eq(notificationChannels.orgId, orgId))
    .orderBy(desc(notificationChannels.createdAt));
}

export async function getNotificationChannel(id: string, orgId: string) {
  const rows = await db
    .select()
    .from(notificationChannels)
    .where(and(eq(notificationChannels.id, id), eq(notificationChannels.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteNotificationChannel(id: string, orgId: string): Promise<boolean> {
  const rows = await db
    .delete(notificationChannels)
    .where(and(eq(notificationChannels.id, id), eq(notificationChannels.orgId, orgId)))
    .returning({ id: notificationChannels.id });
  return rows.length > 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Alert rule queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateAlertRuleInput {
  id: string;
  orgId: string;
  eventType: "agent_failure" | "anomaly_detected" | "cost_spike" | "compliance_violation";
  minSeverity: "critical" | "high" | "medium" | "low";
  channelId: string;
}

export async function createAlertRule(input: CreateAlertRuleInput) {
  const rows = await db.insert(alertRules).values(input).returning();
  return rows[0]!;
}

export async function listAlertRules(orgId: string) {
  return db
    .select()
    .from(alertRules)
    .where(eq(alertRules.orgId, orgId))
    .orderBy(desc(alertRules.createdAt));
}

export async function getAlertRulesForOrg(orgId: string) {
  return db
    .select()
    .from(alertRules)
    .where(and(eq(alertRules.orgId, orgId), eq(alertRules.enabled, true)));
}

export async function deleteAlertRule(id: string, orgId: string): Promise<boolean> {
  const rows = await db
    .delete(alertRules)
    .where(and(eq(alertRules.id, id), eq(alertRules.orgId, orgId)))
    .returning({ id: alertRules.id });
  return rows.length > 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Notification log queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateNotificationLogInput {
  id: string;
  orgId: string;
  ruleId?: string;
  channelId?: string;
  eventType: string;
  severity: string;
  agentId: string;
  traceId?: string;
  status: "sent" | "failed";
  error?: string;
}

export async function createNotificationLogEntry(input: CreateNotificationLogInput) {
  const rows = await db
    .insert(notificationLog)
    .values({
      id: input.id,
      orgId: input.orgId,
      ruleId: input.ruleId ?? null,
      channelId: input.channelId ?? null,
      eventType: input.eventType,
      severity: input.severity,
      agentId: input.agentId,
      traceId: input.traceId ?? null,
      status: input.status,
      error: input.error ?? null,
    })
    .returning();
  return rows[0]!;
}

// ──────────────────────────────────────────────────────────────────────────────
// SSO config queries
// ──────────────────────────────────────────────────────────────────────────────

export interface UpsertSsoConfigInput {
  id: string;
  orgId: string;
  provider: "saml" | "oidc";
  config: Record<string, unknown>;
  enforceSso?: boolean;
}

export async function getSsoConfigByOrg(orgId: string) {
  const rows = await db.select().from(ssoConfigs).where(eq(ssoConfigs.orgId, orgId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertSsoConfig(input: UpsertSsoConfigInput) {
  const rows = await db
    .insert(ssoConfigs)
    .values({
      id: input.id,
      orgId: input.orgId,
      provider: input.provider,
      config: input.config,
      enforceSso: input.enforceSso ?? false,
    })
    .onConflictDoUpdate({
      target: ssoConfigs.orgId,
      set: {
        provider: input.provider,
        config: input.config,
        enforceSso: input.enforceSso ?? false,
        updatedAt: new Date(),
      },
    })
    .returning();
  return rows[0]!;
}

export async function deleteSsoConfig(orgId: string): Promise<boolean> {
  const rows = await db
    .delete(ssoConfigs)
    .where(eq(ssoConfigs.orgId, orgId))
    .returning({ orgId: ssoConfigs.orgId });
  return rows.length > 0;
}

export async function updateSsoEnforcement(orgId: string, enforce: boolean) {
  const rows = await db
    .update(ssoConfigs)
    .set({ enforceSso: enforce, updatedAt: new Date() })
    .where(eq(ssoConfigs.orgId, orgId))
    .returning();
  return rows[0] ?? null;
}

// ──────────────────────────────────────────────────────────────────────────────
// SSO session queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateSsoSessionInput {
  id: string;
  userId: string;
  orgId: string;
  idpSessionId?: string;
  expiresAt: Date;
}

export async function createSsoSession(input: CreateSsoSessionInput) {
  const rows = await db
    .insert(ssoSessions)
    .values({
      id: input.id,
      userId: input.userId,
      orgId: input.orgId,
      idpSessionId: input.idpSessionId ?? null,
      expiresAt: input.expiresAt,
    })
    .returning();
  return rows[0]!;
}

export async function getSsoSession(sessionId: string) {
  const rows = await db.select().from(ssoSessions).where(eq(ssoSessions.id, sessionId)).limit(1);
  return rows[0] ?? null;
}

export async function deleteSsoSessionsByUser(userId: string, orgId: string) {
  await db
    .delete(ssoSessions)
    .where(and(eq(ssoSessions.userId, userId), eq(ssoSessions.orgId, orgId)));
}

export async function deleteSsoSessionByIdpSession(idpSessionId: string) {
  await db.delete(ssoSessions).where(eq(ssoSessions.idpSessionId, idpSessionId));
}

// ──────────────────────────────────────────────────────────────────────────────
// JIT user provisioning for SSO
// ──────────────────────────────────────────────────────────────────────────────

export interface JitProvisionInput {
  userId: string;
  email: string;
  name: string;
  orgId: string;
  role?: "admin" | "member";
}

export async function jitProvisionUser(input: JitProvisionInput) {
  return db.transaction(async (tx) => {
    // Check if user already exists by email
    const existingRows = await tx.select().from(users).where(eq(users.email, input.email)).limit(1);
    const existing = existingRows[0];

    if (existing) {
      // Ensure membership exists for this org
      const membershipRows = await tx
        .select()
        .from(memberships)
        .where(and(eq(memberships.userId, existing.id), eq(memberships.orgId, input.orgId)))
        .limit(1);

      if (membershipRows.length === 0) {
        await tx.insert(memberships).values({
          userId: existing.id,
          orgId: input.orgId,
          role: input.role ?? "member",
        });
      }

      return { user: existing, provisioned: false };
    }

    // Create new user with a placeholder password hash (SSO-only, no password login)
    const [user] = await tx
      .insert(users)
      .values({
        id: input.userId,
        email: input.email,
        passwordHash: "sso-only:no-password-login",
        name: input.name,
      })
      .returning();

    await tx.insert(memberships).values({
      userId: input.userId,
      orgId: input.orgId,
      role: input.role ?? "member",
    });

    return { user: user!, provisioned: true };
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Waitlist queries
// ──────────────────────────────────────────────────────────────────────────────

export async function insertWaitlistSignup(
  id: string,
  email: string,
): Promise<{ alreadyExists: boolean }> {
  const existing = await db
    .select({ id: waitlistSignups.id })
    .from(waitlistSignups)
    .where(eq(waitlistSignups.email, email.toLowerCase().trim()))
    .limit(1);

  if (existing.length > 0) return { alreadyExists: true };

  await db.insert(waitlistSignups).values({
    id,
    email: email.toLowerCase().trim(),
  });
  return { alreadyExists: false };
}

// ──────────────────────────────────────────────────────────────────────────────
// Score queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateScoreInput {
  id: string;
  orgId: string;
  traceId: string;
  spanId?: string;
  name: string;
  value?: number;
  label?: string;
  source: "manual" | "llm_judge" | "sdk" | "user_feedback";
  comment?: string;
  userId?: string;
}

export async function createScore(input: CreateScoreInput) {
  const rows = await db
    .insert(scores)
    .values({
      id: input.id,
      orgId: input.orgId,
      traceId: input.traceId,
      spanId: input.spanId ?? null,
      name: input.name,
      value: input.value ?? null,
      label: input.label ?? null,
      source: input.source,
      comment: input.comment ?? null,
      userId: input.userId ?? null,
    })
    .returning();
  return rows[0]!;
}

export interface ScoreFilters {
  orgId: string;
  traceId?: string;
  spanId?: string;
  name?: string;
  source?: string;
  minValue?: number;
  maxValue?: number;
  page?: number;
  limit?: number;
}

export async function queryScores(filters: ScoreFilters) {
  const {
    orgId,
    traceId,
    spanId,
    name,
    source,
    minValue,
    maxValue,
    page = 1,
    limit = 50,
  } = filters;
  const offset = (page - 1) * limit;

  const conditions = [eq(scores.orgId, orgId)];
  if (traceId) conditions.push(eq(scores.traceId, traceId));
  if (spanId) conditions.push(eq(scores.spanId, spanId));
  if (name) conditions.push(eq(scores.name, name));
  if (source) conditions.push(eq(scores.source, source as CreateScoreInput["source"]));
  if (minValue != null) conditions.push(gte(scores.value, minValue));
  if (maxValue != null) conditions.push(lte(scores.value, maxValue));

  return db
    .select()
    .from(scores)
    .where(and(...conditions))
    .orderBy(desc(scores.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getScoresByTraceId(traceId: string, orgId: string) {
  return db
    .select()
    .from(scores)
    .where(and(eq(scores.traceId, traceId), eq(scores.orgId, orgId)))
    .orderBy(desc(scores.createdAt));
}

export async function getScore(id: string, orgId: string) {
  const rows = await db
    .select()
    .from(scores)
    .where(and(eq(scores.id, id), eq(scores.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteScore(id: string, orgId: string): Promise<boolean> {
  const rows = await db
    .delete(scores)
    .where(and(eq(scores.id, id), eq(scores.orgId, orgId)))
    .returning({ id: scores.id });
  return rows.length > 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Evaluator queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateEvaluatorInput {
  id: string;
  orgId: string;
  name: string;
  promptTemplate: string;
  model: string;
  scoringType: "numeric" | "categorical";
  labels?: string[];
}

export async function createEvaluator(input: CreateEvaluatorInput) {
  const rows = await db
    .insert(evaluators)
    .values({
      id: input.id,
      orgId: input.orgId,
      name: input.name,
      promptTemplate: input.promptTemplate,
      model: input.model,
      scoringType: input.scoringType,
      labels: input.labels ?? [],
    })
    .returning();
  return rows[0]!;
}

export async function listEvaluators(orgId: string) {
  return db
    .select()
    .from(evaluators)
    .where(eq(evaluators.orgId, orgId))
    .orderBy(desc(evaluators.createdAt));
}

export async function getEvaluator(id: string, orgId: string) {
  const rows = await db
    .select()
    .from(evaluators)
    .where(and(eq(evaluators.id, id), eq(evaluators.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Fetch an evaluator by ID without org scoping.
 * ONLY for trusted internal code paths (worker jobs) — never expose to API routes.
 */
export async function getEvaluatorById(id: string) {
  const rows = await db.select().from(evaluators).where(eq(evaluators.id, id)).limit(1);
  return rows[0] ?? null;
}

export interface UpdateEvaluatorInput {
  name?: string;
  promptTemplate?: string;
  model?: string;
  scoringType?: "numeric" | "categorical";
  labels?: string[];
  enabled?: boolean;
}

export async function updateEvaluator(id: string, orgId: string, input: UpdateEvaluatorInput) {
  const set: Partial<typeof evaluators.$inferInsert> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.promptTemplate !== undefined) set.promptTemplate = input.promptTemplate;
  if (input.model !== undefined) set.model = input.model;
  if (input.scoringType !== undefined) set.scoringType = input.scoringType;
  if (input.labels !== undefined) set.labels = input.labels;
  if (input.enabled !== undefined) set.enabled = input.enabled;

  if (Object.keys(set).length === 0) return getEvaluator(id, orgId);

  const rows = await db
    .update(evaluators)
    .set(set)
    .where(and(eq(evaluators.id, id), eq(evaluators.orgId, orgId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteEvaluator(id: string, orgId: string): Promise<boolean> {
  const rows = await db
    .delete(evaluators)
    .where(and(eq(evaluators.id, id), eq(evaluators.orgId, orgId)))
    .returning({ id: evaluators.id });
  return rows.length > 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Evaluator run queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateEvaluatorRunInput {
  id: string;
  evaluatorId: string;
  traceId: string;
}

export async function createEvaluatorRun(input: CreateEvaluatorRunInput) {
  const rows = await db
    .insert(evaluatorRuns)
    .values({
      id: input.id,
      evaluatorId: input.evaluatorId,
      traceId: input.traceId,
      status: "pending",
    })
    .returning();
  return rows[0]!;
}

export async function createEvaluatorRuns(inputs: CreateEvaluatorRunInput[]) {
  if (inputs.length === 0) return [];
  const rows = await db
    .insert(evaluatorRuns)
    .values(
      inputs.map((input) => ({
        id: input.id,
        evaluatorId: input.evaluatorId,
        traceId: input.traceId,
        status: "pending" as const,
      })),
    )
    .returning();
  return rows;
}

export async function getEvaluatorRun(id: string) {
  const rows = await db.select().from(evaluatorRuns).where(eq(evaluatorRuns.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Org-scoped evaluator run lookup — joins through evaluators to verify tenant ownership. */
export async function getEvaluatorRunForOrg(id: string, orgId: string) {
  const rows = await db
    .select({
      id: evaluatorRuns.id,
      evaluatorId: evaluatorRuns.evaluatorId,
      traceId: evaluatorRuns.traceId,
      scoreId: evaluatorRuns.scoreId,
      status: evaluatorRuns.status,
      error: evaluatorRuns.error,
      createdAt: evaluatorRuns.createdAt,
      completedAt: evaluatorRuns.completedAt,
    })
    .from(evaluatorRuns)
    .innerJoin(evaluators, eq(evaluatorRuns.evaluatorId, evaluators.id))
    .where(and(eq(evaluatorRuns.id, id), eq(evaluators.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateEvaluatorRunStatus(
  id: string,
  orgId: string,
  status: "running" | "completed" | "failed",
  extra?: { scoreId?: string; error?: string },
) {
  const set: Partial<typeof evaluatorRuns.$inferInsert> = { status };
  if (extra?.scoreId !== undefined) set.scoreId = extra.scoreId;
  if (extra?.error !== undefined) set.error = extra.error;
  if (status === "completed" || status === "failed") set.completedAt = new Date();

  // Org-scoped update via subquery on parent evaluator
  const rows = await db
    .update(evaluatorRuns)
    .set(set)
    .where(
      and(
        eq(evaluatorRuns.id, id),
        sql`${evaluatorRuns.evaluatorId} IN (SELECT id FROM evaluators WHERE org_id = ${orgId})`,
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function getPendingEvaluatorRuns(limit = 100) {
  return db
    .select()
    .from(evaluatorRuns)
    .where(eq(evaluatorRuns.status, "pending"))
    .orderBy(asc(evaluatorRuns.createdAt))
    .limit(limit);
}

// ──────────────────────────────────────────────────────────────────────────────
// Annotation queue queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateAnnotationQueueInput {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  scoreConfigs?: Array<{ name: string; type: "numeric" | "categorical"; labels?: string[] }>;
}

export async function createAnnotationQueue(input: CreateAnnotationQueueInput) {
  const rows = await db
    .insert(annotationQueues)
    .values({
      id: input.id,
      orgId: input.orgId,
      name: input.name,
      description: input.description ?? null,
      scoreConfigs: input.scoreConfigs ?? [],
    })
    .returning();
  return rows[0]!;
}

export async function listAnnotationQueues(orgId: string) {
  return db
    .select()
    .from(annotationQueues)
    .where(eq(annotationQueues.orgId, orgId))
    .orderBy(desc(annotationQueues.createdAt));
}

export async function getAnnotationQueue(id: string, orgId: string) {
  const rows = await db
    .select()
    .from(annotationQueues)
    .where(and(eq(annotationQueues.id, id), eq(annotationQueues.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAnnotationQueueStats(queueId: string, orgId: string) {
  const rows = await db
    .select({
      status: annotationQueueItems.status,
      count: count(),
    })
    .from(annotationQueueItems)
    .innerJoin(annotationQueues, eq(annotationQueueItems.queueId, annotationQueues.id))
    .where(and(eq(annotationQueueItems.queueId, queueId), eq(annotationQueues.orgId, orgId)))
    .groupBy(annotationQueueItems.status);

  const stats = { pending: 0, completed: 0, skipped: 0, total: 0 };
  for (const row of rows) {
    const n = Number(row.count);
    if (row.status === "pending") stats.pending = n;
    else if (row.status === "completed") stats.completed = n;
    else if (row.status === "skipped") stats.skipped = n;
    stats.total += n;
  }
  return stats;
}

export async function deleteAnnotationQueue(id: string, orgId: string): Promise<boolean> {
  const rows = await db
    .delete(annotationQueues)
    .where(and(eq(annotationQueues.id, id), eq(annotationQueues.orgId, orgId)))
    .returning({ id: annotationQueues.id });
  return rows.length > 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Annotation queue item queries
// ──────────────────────────────────────────────────────────────────────────────

export interface AddAnnotationQueueItemsInput {
  queueId: string;
  traceIds: string[];
}

export async function addAnnotationQueueItems(
  input: AddAnnotationQueueItemsInput,
  idGenerator: () => string,
) {
  if (input.traceIds.length === 0) return [];
  const rows = await db
    .insert(annotationQueueItems)
    .values(
      input.traceIds.map((traceId) => ({
        id: idGenerator(),
        queueId: input.queueId,
        traceId,
        status: "pending" as const,
      })),
    )
    .onConflictDoNothing()
    .returning();
  return rows;
}

export async function claimAnnotationQueueItem(queueId: string, orgId: string, userId: string) {
  // Claim the oldest pending item — org-scoped via queue ownership
  const pending = await db
    .select({ id: annotationQueueItems.id })
    .from(annotationQueueItems)
    .innerJoin(annotationQueues, eq(annotationQueueItems.queueId, annotationQueues.id))
    .where(
      and(
        eq(annotationQueueItems.queueId, queueId),
        eq(annotationQueues.orgId, orgId),
        eq(annotationQueueItems.status, "pending"),
        isNull(annotationQueueItems.assignedTo),
      ),
    )
    .orderBy(asc(annotationQueueItems.createdAt))
    .limit(1);

  if (pending.length === 0) return null;

  const item = pending[0]!;
  const rows = await db
    .update(annotationQueueItems)
    .set({ assignedTo: userId })
    .where(and(eq(annotationQueueItems.id, item.id), isNull(annotationQueueItems.assignedTo)))
    .returning();

  return rows[0] ?? null;
}

export async function completeAnnotationQueueItem(itemId: string, orgId: string) {
  // Atomic org-scoped update via subquery — no TOCTOU race
  const rows = await db
    .update(annotationQueueItems)
    .set({ status: "completed", completedAt: new Date() })
    .where(
      and(
        eq(annotationQueueItems.id, itemId),
        sql`${annotationQueueItems.queueId} IN (SELECT id FROM annotation_queues WHERE org_id = ${orgId})`,
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function skipAnnotationQueueItem(itemId: string, orgId: string) {
  // Atomic org-scoped update via subquery — no TOCTOU race
  const rows = await db
    .update(annotationQueueItems)
    .set({ status: "skipped", completedAt: new Date() })
    .where(
      and(
        eq(annotationQueueItems.id, itemId),
        sql`${annotationQueueItems.queueId} IN (SELECT id FROM annotation_queues WHERE org_id = ${orgId})`,
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function getAnnotationQueueItem(itemId: string, orgId: string) {
  const rows = await db
    .select({
      id: annotationQueueItems.id,
      queueId: annotationQueueItems.queueId,
      traceId: annotationQueueItems.traceId,
      status: annotationQueueItems.status,
      assignedTo: annotationQueueItems.assignedTo,
      completedAt: annotationQueueItems.completedAt,
      createdAt: annotationQueueItems.createdAt,
    })
    .from(annotationQueueItems)
    .innerJoin(annotationQueues, eq(annotationQueueItems.queueId, annotationQueues.id))
    .where(and(eq(annotationQueueItems.id, itemId), eq(annotationQueues.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Dataset queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateDatasetInput {
  id: string;
  orgId: string;
  name: string;
  description?: string;
}

export async function createDataset(input: CreateDatasetInput) {
  const rows = await db
    .insert(datasets)
    .values({
      id: input.id,
      orgId: input.orgId,
      name: input.name,
      description: input.description ?? null,
    })
    .returning();
  return rows[0]!;
}

export async function listDatasets(orgId: string) {
  return db
    .select()
    .from(datasets)
    .where(eq(datasets.orgId, orgId))
    .orderBy(desc(datasets.createdAt));
}

export async function getDataset(id: string, orgId: string) {
  const rows = await db
    .select()
    .from(datasets)
    .where(and(eq(datasets.id, id), eq(datasets.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteDataset(id: string, orgId: string): Promise<boolean> {
  const rows = await db
    .delete(datasets)
    .where(and(eq(datasets.id, id), eq(datasets.orgId, orgId)))
    .returning({ id: datasets.id });
  return rows.length > 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Dataset item queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateDatasetItemInput {
  id: string;
  datasetId: string;
  input: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  sourceTraceId?: string;
}

export async function createDatasetItem(input: CreateDatasetItemInput) {
  const rows = await db
    .insert(datasetItems)
    .values({
      id: input.id,
      datasetId: input.datasetId,
      input: input.input,
      expectedOutput: input.expectedOutput ?? null,
      metadata: input.metadata ?? {},
      sourceTraceId: input.sourceTraceId ?? null,
    })
    .returning();
  return rows[0]!;
}

export async function createDatasetItems(inputs: CreateDatasetItemInput[]) {
  if (inputs.length === 0) return [];
  const rows = await db
    .insert(datasetItems)
    .values(
      inputs.map((input) => ({
        id: input.id,
        datasetId: input.datasetId,
        input: input.input,
        expectedOutput: input.expectedOutput ?? null,
        metadata: input.metadata ?? {},
        sourceTraceId: input.sourceTraceId ?? null,
      })),
    )
    .returning();
  return rows;
}

export interface DatasetItemFilters {
  datasetId: string;
  orgId: string;
  page?: number;
  limit?: number;
}

export async function listDatasetItems(filters: DatasetItemFilters) {
  const { datasetId, orgId, page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;
  return db
    .select({
      id: datasetItems.id,
      datasetId: datasetItems.datasetId,
      input: datasetItems.input,
      expectedOutput: datasetItems.expectedOutput,
      metadata: datasetItems.metadata,
      sourceTraceId: datasetItems.sourceTraceId,
      createdAt: datasetItems.createdAt,
    })
    .from(datasetItems)
    .innerJoin(datasets, eq(datasetItems.datasetId, datasets.id))
    .where(and(eq(datasetItems.datasetId, datasetId), eq(datasets.orgId, orgId)))
    .orderBy(desc(datasetItems.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getDatasetItem(id: string, orgId: string) {
  const rows = await db
    .select({
      id: datasetItems.id,
      datasetId: datasetItems.datasetId,
      input: datasetItems.input,
      expectedOutput: datasetItems.expectedOutput,
      metadata: datasetItems.metadata,
      sourceTraceId: datasetItems.sourceTraceId,
      createdAt: datasetItems.createdAt,
    })
    .from(datasetItems)
    .innerJoin(datasets, eq(datasetItems.datasetId, datasets.id))
    .where(and(eq(datasetItems.id, id), eq(datasets.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteDatasetItem(id: string, orgId: string): Promise<boolean> {
  // Atomic org-scoped delete via subquery — no TOCTOU race
  const rows = await db
    .delete(datasetItems)
    .where(
      and(
        eq(datasetItems.id, id),
        sql`${datasetItems.datasetId} IN (SELECT id FROM datasets WHERE org_id = ${orgId})`,
      ),
    )
    .returning({ id: datasetItems.id });
  return rows.length > 0;
}

export async function countDatasetItems(datasetId: string, orgId: string): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(datasetItems)
    .innerJoin(datasets, eq(datasetItems.datasetId, datasets.id))
    .where(and(eq(datasetItems.datasetId, datasetId), eq(datasets.orgId, orgId)));
  return Number(rows[0]?.count ?? 0);
}

/**
 * Auto-curate dataset items from production traces filtered by score.
 * This is the "killer feature" — traces matching score filters become test cases.
 */
export async function getTracesForDatasetCuration(filters: {
  orgId: string;
  scoreName: string;
  scoreOperator: "lt" | "gt" | "lte" | "gte";
  scoreThreshold: number;
  since?: Date;
  limit?: number;
}) {
  const {
    orgId,
    scoreName,
    scoreOperator,
    scoreThreshold,
    since,
    limit: maxResults = 100,
  } = filters;

  const conditions = [eq(scores.orgId, orgId), eq(scores.name, scoreName)];

  if (scoreOperator === "lt") conditions.push(lt(scores.value, scoreThreshold));
  else if (scoreOperator === "gt") conditions.push(gt(scores.value, scoreThreshold));
  else if (scoreOperator === "lte") conditions.push(lte(scores.value, scoreThreshold));
  else if (scoreOperator === "gte") conditions.push(gte(scores.value, scoreThreshold));

  if (since) conditions.push(gte(scores.createdAt, since));

  const matchingScores = await db
    .select({ traceId: scores.traceId })
    .from(scores)
    .where(and(...conditions))
    .groupBy(scores.traceId)
    .limit(maxResults);

  if (matchingScores.length === 0) return [];

  const traceIds = matchingScores.map((s) => s.traceId);

  const results = [];
  for (const traceId of traceIds) {
    const trace = await db
      .select()
      .from(traces)
      .where(and(eq(traces.id, traceId), eq(traces.orgId, orgId)))
      .limit(1);

    if (trace[0]) {
      const traceSpans = await db
        .select()
        .from(spans)
        .where(and(eq(spans.traceId, traceId), eq(spans.orgId, orgId)))
        .orderBy(asc(spans.startTimeMs));

      results.push({ trace: trace[0], spans: traceSpans });
    }
  }

  return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// Experiment queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateExperimentInput {
  id: string;
  orgId: string;
  datasetId: string;
  name: string;
  config: Record<string, unknown>;
}

export async function createExperiment(input: CreateExperimentInput) {
  const rows = await db
    .insert(experiments)
    .values({
      id: input.id,
      orgId: input.orgId,
      datasetId: input.datasetId,
      name: input.name,
      config: input.config,
      status: "pending",
    })
    .returning();
  return rows[0]!;
}

export async function listExperiments(orgId: string, datasetId?: string) {
  const conditions = [eq(experiments.orgId, orgId)];
  if (datasetId) conditions.push(eq(experiments.datasetId, datasetId));

  return db
    .select()
    .from(experiments)
    .where(and(...conditions))
    .orderBy(desc(experiments.createdAt));
}

export async function getExperiment(id: string, orgId: string) {
  const rows = await db
    .select()
    .from(experiments)
    .where(and(eq(experiments.id, id), eq(experiments.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateExperimentStatus(
  id: string,
  orgId: string,
  status: "running" | "completed" | "failed",
) {
  const set: Partial<typeof experiments.$inferInsert> = { status };
  if (status === "completed" || status === "failed") set.completedAt = new Date();

  const rows = await db
    .update(experiments)
    .set(set)
    .where(and(eq(experiments.id, id), eq(experiments.orgId, orgId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteExperiment(id: string, orgId: string): Promise<boolean> {
  const rows = await db
    .delete(experiments)
    .where(and(eq(experiments.id, id), eq(experiments.orgId, orgId)))
    .returning({ id: experiments.id });
  return rows.length > 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Experiment run queries
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateExperimentRunInput {
  id: string;
  experimentId: string;
  datasetItemId: string;
}

export async function createExperimentRun(input: CreateExperimentRunInput) {
  const rows = await db
    .insert(experimentRuns)
    .values({
      id: input.id,
      experimentId: input.experimentId,
      datasetItemId: input.datasetItemId,
    })
    .returning();
  return rows[0]!;
}

export async function createExperimentRuns(inputs: CreateExperimentRunInput[]) {
  if (inputs.length === 0) return [];
  const rows = await db
    .insert(experimentRuns)
    .values(
      inputs.map((input) => ({
        id: input.id,
        experimentId: input.experimentId,
        datasetItemId: input.datasetItemId,
      })),
    )
    .returning();
  return rows;
}

export async function getExperimentRun(id: string, orgId: string) {
  const rows = await db
    .select({
      id: experimentRuns.id,
      experimentId: experimentRuns.experimentId,
      datasetItemId: experimentRuns.datasetItemId,
      output: experimentRuns.output,
      latencyMs: experimentRuns.latencyMs,
      tokenCount: experimentRuns.tokenCount,
      cost: experimentRuns.cost,
      createdAt: experimentRuns.createdAt,
    })
    .from(experimentRuns)
    .innerJoin(experiments, eq(experimentRuns.experimentId, experiments.id))
    .where(and(eq(experimentRuns.id, id), eq(experiments.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export interface UpdateExperimentRunInput {
  output?: Record<string, unknown>;
  latencyMs?: number;
  tokenCount?: number;
  cost?: number;
}

export async function updateExperimentRun(
  id: string,
  orgId: string,
  input: UpdateExperimentRunInput,
) {
  // Atomic org-scoped update via subquery — no TOCTOU race
  const rows = await db
    .update(experimentRuns)
    .set({
      output: input.output ?? null,
      latencyMs: input.latencyMs ?? null,
      tokenCount: input.tokenCount ?? null,
      cost: input.cost ?? null,
    })
    .where(
      and(
        eq(experimentRuns.id, id),
        sql`${experimentRuns.experimentId} IN (SELECT id FROM experiments WHERE org_id = ${orgId})`,
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function listExperimentRuns(experimentId: string, orgId: string) {
  return db
    .select({
      id: experimentRuns.id,
      experimentId: experimentRuns.experimentId,
      datasetItemId: experimentRuns.datasetItemId,
      output: experimentRuns.output,
      latencyMs: experimentRuns.latencyMs,
      tokenCount: experimentRuns.tokenCount,
      cost: experimentRuns.cost,
      createdAt: experimentRuns.createdAt,
    })
    .from(experimentRuns)
    .innerJoin(experiments, eq(experimentRuns.experimentId, experiments.id))
    .where(and(eq(experimentRuns.experimentId, experimentId), eq(experiments.orgId, orgId)))
    .orderBy(asc(experimentRuns.createdAt));
}

/**
 * Get side-by-side comparison data for multiple experiments.
 * Returns experiment runs grouped by dataset item for easy comparison.
 */
export async function getExperimentComparison(experimentIds: string[], orgId: string) {
  if (experimentIds.length === 0) return null;

  // Verify all experiments belong to this org
  const exps = await db
    .select()
    .from(experiments)
    .where(and(eq(experiments.orgId, orgId), inArray(experiments.id, experimentIds)));

  if (exps.length !== experimentIds.length) return null;

  // Fetch all runs for these org-verified experiments (scoped via JOIN)
  const runRows = await db
    .select({ run: experimentRuns })
    .from(experimentRuns)
    .innerJoin(experiments, eq(experimentRuns.experimentId, experiments.id))
    .where(and(inArray(experimentRuns.experimentId, experimentIds), eq(experiments.orgId, orgId)))
    .orderBy(asc(experimentRuns.datasetItemId));

  const runs = runRows.map((r) => r.run);

  // Fetch the dataset items referenced by these runs (org-scoped via datasets JOIN)
  const itemIds = [...new Set(runs.map((r) => r.datasetItemId))];
  const items =
    itemIds.length > 0
      ? await db
          .select({ item: datasetItems })
          .from(datasetItems)
          .innerJoin(datasets, eq(datasetItems.datasetId, datasets.id))
          .where(and(inArray(datasetItems.id, itemIds), eq(datasets.orgId, orgId)))
          .then((rows) => rows.map((r) => r.item))
      : [];

  // Fetch scores for experiment runs (org-scoped)
  const runIds = runs.map((r) => r.id);
  const runScores =
    runIds.length > 0
      ? await db
          .select()
          .from(scores)
          .where(and(inArray(scores.comment, runIds), eq(scores.orgId, orgId)))
      : [];

  return { experiments: exps, runs, items, scores: runScores };
}

// ──────────────────────────────────────────────────────────────────────────────
// Agent Config queries (Phase 4)
// ──────────────────────────────────────────────────────────────────────────────

export async function upsertAgentConfig(
  data: typeof agentConfigs.$inferInsert,
): Promise<typeof agentConfigs.$inferSelect> {
  const [row] = await db
    .insert(agentConfigs)
    .values(data)
    .onConflictDoUpdate({
      target: [agentConfigs.orgId, agentConfigs.agentId],
      set: {
        costBudgetUsd: data.costBudgetUsd,
        costAlertThresholdPct: data.costAlertThresholdPct,
        budgetPeriod: data.budgetPeriod,
        maxDurationMs: data.maxDurationMs,
        minSuccessRate: data.minSuccessRate,
        evaluationWindowMs: data.evaluationWindowMs,
        minSampleSize: data.minSampleSize,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

export async function getAgentConfig(
  orgId: string,
  agentId: string,
): Promise<typeof agentConfigs.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(agentConfigs)
    .where(and(eq(agentConfigs.orgId, orgId), eq(agentConfigs.agentId, agentId)));
  return row;
}

export async function listAgentConfigs(
  orgId: string,
  page = 1,
  limit = 50,
): Promise<Array<typeof agentConfigs.$inferSelect>> {
  return db
    .select()
    .from(agentConfigs)
    .where(eq(agentConfigs.orgId, orgId))
    .orderBy(agentConfigs.createdAt)
    .limit(limit)
    .offset((page - 1) * limit);
}

export async function deleteAgentConfig(orgId: string, agentId: string): Promise<boolean> {
  const rows = await db
    .delete(agentConfigs)
    .where(and(eq(agentConfigs.orgId, orgId), eq(agentConfigs.agentId, agentId)))
    .returning({ agentId: agentConfigs.agentId });
  return rows.length > 0;
}

export async function updateAgentConfigStatus(
  orgId: string,
  agentId: string,
  costStatus: Record<string, unknown> | null,
  slaStatus: Record<string, unknown> | null,
): Promise<void> {
  await db
    .update(agentConfigs)
    .set({
      ...(costStatus !== null ? { lastCostStatus: costStatus } : {}),
      ...(slaStatus !== null ? { lastSlaStatus: slaStatus } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(agentConfigs.orgId, orgId), eq(agentConfigs.agentId, agentId)));
}

export async function getAllAgentConfigs(): Promise<Array<typeof agentConfigs.$inferSelect>> {
  return db
    .select()
    .from(agentConfigs)
    .where(
      or(
        isNotNull(agentConfigs.maxDurationMs),
        isNotNull(agentConfigs.minSuccessRate),
        isNotNull(agentConfigs.costBudgetUsd),
      ),
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Behavior Baseline queries (Phase 4)
// ──────────────────────────────────────────────────────────────────────────────

export async function upsertBaseline(
  data: typeof behaviorBaselines.$inferInsert,
): Promise<typeof behaviorBaselines.$inferSelect> {
  const [row] = await db
    .insert(behaviorBaselines)
    .values(data)
    .onConflictDoUpdate({
      target: [behaviorBaselines.orgId, behaviorBaselines.agentId, behaviorBaselines.agentVersion],
      set: {
        sampleSize: data.sampleSize,
        spanStructure: data.spanStructure,
      },
    })
    .returning();
  return row!;
}

export async function getBaseline(
  orgId: string,
  agentId: string,
  agentVersion: string,
): Promise<typeof behaviorBaselines.$inferSelect | undefined> {
  const [row] = await db
    .select()
    .from(behaviorBaselines)
    .where(
      and(
        eq(behaviorBaselines.orgId, orgId),
        eq(behaviorBaselines.agentId, agentId),
        eq(behaviorBaselines.agentVersion, agentVersion),
      ),
    );
  return row;
}

export async function getRecentBaselines(
  orgId: string,
  agentId: string,
  limit = 10,
): Promise<Array<typeof behaviorBaselines.$inferSelect>> {
  return db
    .select()
    .from(behaviorBaselines)
    .where(and(eq(behaviorBaselines.orgId, orgId), eq(behaviorBaselines.agentId, agentId)))
    .orderBy(desc(behaviorBaselines.createdAt))
    .limit(limit);
}

export async function deleteBaseline(
  orgId: string,
  agentId: string,
  agentVersion: string,
): Promise<boolean> {
  const rows = await db
    .delete(behaviorBaselines)
    .where(
      and(
        eq(behaviorBaselines.orgId, orgId),
        eq(behaviorBaselines.agentId, agentId),
        eq(behaviorBaselines.agentVersion, agentVersion),
      ),
    )
    .returning({ agentId: behaviorBaselines.agentId });
  return rows.length > 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Model Pricing Override queries (Phase 4)
// ──────────────────────────────────────────────────────────────────────────────

export async function getModelPricingOverrides(): Promise<
  Array<typeof modelPricingOverrides.$inferSelect>
> {
  return db.select().from(modelPricingOverrides);
}

// ──────────────────────────────────────────────────────────────────────────────
// Cost aggregation queries (Phase 4)
// ──────────────────────────────────────────────────────────────────────────────

export async function sumSpanCosts(
  orgId: string,
  agentId: string,
  fromMs: number,
  toMs: number,
): Promise<{ totalCost: number; totalSpans: number; unknownCostSpans: number }> {
  const rows = await db
    .select({
      totalCost: sql<string>`COALESCE(SUM(${spans.costUsd}), 0)`,
      totalSpans: sql<number>`COUNT(*) FILTER (WHERE ${spans.kind} = 'llm_call')`,
      unknownCostSpans: sql<number>`COUNT(*) FILTER (WHERE ${spans.kind} = 'llm_call' AND ${spans.costUsd} IS NULL)`,
    })
    .from(spans)
    .innerJoin(traces, eq(spans.traceId, traces.id))
    .where(
      and(
        eq(spans.orgId, orgId),
        eq(traces.agentId, agentId),
        gte(traces.startTimeMs, fromMs),
        lt(traces.startTimeMs, toMs),
        eq(spans.kind, "llm_call"),
      ),
    );
  const row = rows[0]!;
  return {
    totalCost: Number(row.totalCost),
    totalSpans: row.totalSpans,
    unknownCostSpans: row.unknownCostSpans,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Span structure queries for regression detection (Phase 4)
// ──────────────────────────────────────────────────────────────────────────────

export async function countTracesForVersion(
  orgId: string,
  agentId: string,
  agentVersion: string,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(traces)
    .where(
      and(
        eq(traces.orgId, orgId),
        eq(traces.agentId, agentId),
        sql`${traces.metadata}->>'agent_version' = ${agentVersion}`,
      ),
    );
  return rows[0]?.count ?? 0;
}

export async function getSpanStructureForVersion(
  orgId: string,
  agentId: string,
  agentVersion: string,
  limit = 100,
): Promise<Record<string, number>> {
  // Get span (kind, name) frequency across recent traces for this version
  const rows = await db
    .select({
      kind: spans.kind,
      name: spans.name,
      traceCount: sql<number>`COUNT(DISTINCT ${spans.traceId})`,
    })
    .from(spans)
    .innerJoin(traces, eq(spans.traceId, traces.id))
    .where(
      and(
        eq(spans.orgId, orgId),
        eq(traces.agentId, agentId),
        sql`${traces.metadata}->>'agent_version' = ${agentVersion}`,
      ),
    )
    .groupBy(spans.kind, spans.name);

  // Count total traces for this version
  const totalTraces = await countTracesForVersion(orgId, agentId, agentVersion);
  if (totalTraces === 0) return {};

  const structure: Record<string, number> = {};
  for (const row of rows) {
    const key = `${row.kind}:${row.name}`;
    // Use totalTraces as denominator — the span query scans all traces,
    // not a limited subset, so frequency should be relative to the full population.
    structure[key] = row.traceCount / totalTraces;
  }
  return structure;
}

// ──────────────────────────────────────────────────────────────────────────────
// Prompt Management queries (Phase 6)
// ──────────────────────────────────────────────────────────────────────────────

interface CreatePromptInput {
  id: string;
  orgId: string;
  name: string;
}

export async function createPrompt(input: CreatePromptInput) {
  const [row] = await db.insert(prompts).values(input).returning();
  return row;
}

export async function listPrompts(orgId: string, page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  return db
    .select()
    .from(prompts)
    .where(eq(prompts.orgId, orgId))
    .orderBy(desc(prompts.updatedAt))
    .limit(limit)
    .offset(offset);
}

export async function getPrompt(id: string, orgId: string) {
  const [row] = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.id, id), eq(prompts.orgId, orgId)));
  return row ?? null;
}

export async function getPromptByName(name: string, orgId: string) {
  const [row] = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.name, name), eq(prompts.orgId, orgId)));
  return row ?? null;
}

export async function deletePrompt(id: string, orgId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(prompts)
    .where(and(eq(prompts.id, id), eq(prompts.orgId, orgId)))
    .returning({ id: prompts.id });
  return !!deleted;
}

interface CreatePromptVersionInput {
  id: string;
  promptId: string;
  orgId: string;
  content: string;
  model?: string;
  config?: Record<string, unknown>;
  createdBy?: string | null;
}

/**
 * Atomically creates a new prompt version with auto-incremented version number.
 * Uses a transaction to prevent TOCTOU race conditions on the version counter.
 */
export async function createPromptVersion(input: CreatePromptVersionInput) {
  return db.transaction(async (tx) => {
    // Read latest version inside the transaction for atomicity
    const [latest] = await tx
      .select({ version: promptVersions.version })
      .from(promptVersions)
      .where(eq(promptVersions.promptId, input.promptId))
      .orderBy(desc(promptVersions.version))
      .limit(1);

    const nextVersion = (latest?.version ?? 0) + 1;

    const [row] = await tx
      .insert(promptVersions)
      .values({
        id: input.id,
        promptId: input.promptId,
        version: nextVersion,
        content: input.content,
        model: input.model,
        config: input.config ?? {},
        createdBy: input.createdBy,
      })
      .returning();

    // Touch parent prompt's updatedAt — scoped by orgId
    await tx
      .update(prompts)
      .set({ updatedAt: new Date() })
      .where(and(eq(prompts.id, input.promptId), eq(prompts.orgId, input.orgId)));

    return row;
  });
}

export async function getLatestPromptVersion(promptId: string, orgId: string) {
  const [row] = await db
    .select({ version: promptVersions })
    .from(promptVersions)
    .innerJoin(prompts, eq(promptVersions.promptId, prompts.id))
    .where(and(eq(promptVersions.promptId, promptId), eq(prompts.orgId, orgId)))
    .orderBy(desc(promptVersions.version))
    .limit(1);
  return row?.version ?? null;
}

export async function listPromptVersions(promptId: string, orgId: string) {
  const rows = await db
    .select({ version: promptVersions })
    .from(promptVersions)
    .innerJoin(prompts, eq(promptVersions.promptId, prompts.id))
    .where(and(eq(promptVersions.promptId, promptId), eq(prompts.orgId, orgId)))
    .orderBy(desc(promptVersions.version));
  return rows.map((r) => r.version);
}

export async function getPromptVersionByNumber(promptId: string, orgId: string, version: number) {
  const [row] = await db
    .select({ version: promptVersions })
    .from(promptVersions)
    .innerJoin(prompts, eq(promptVersions.promptId, prompts.id))
    .where(
      and(
        eq(promptVersions.promptId, promptId),
        eq(prompts.orgId, orgId),
        eq(promptVersions.version, version),
      ),
    );
  return row?.version ?? null;
}

/**
 * Resolve a prompt by name + label. Used by SDKs: `fox.prompts.get(name, label)`.
 * Returns the prompt version with the matching label, or null if not found.
 */
export async function getPromptVersionByLabel(orgId: string, promptName: string, label: string) {
  const rows = await db
    .select({
      version: promptVersions,
      label: promptLabels.label,
    })
    .from(promptLabels)
    .innerJoin(promptVersions, eq(promptLabels.promptVersionId, promptVersions.id))
    .innerJoin(prompts, eq(promptVersions.promptId, prompts.id))
    .where(
      and(eq(prompts.orgId, orgId), eq(prompts.name, promptName), eq(promptLabels.label, label)),
    )
    .limit(1);

  return rows[0]?.version ?? null;
}

interface SetPromptLabelInput {
  id: string;
  promptVersionId: string;
  promptId: string;
  label: string;
}

/**
 * Atomically set a label on a prompt version. Moves the label if it already exists
 * on another version of the same prompt. Uses a transaction to prevent race conditions.
 */
export async function setPromptLabel(input: SetPromptLabelInput) {
  return db.transaction(async (tx) => {
    // Remove this label from any other version of the same prompt
    const existingLabels = await tx
      .select({ id: promptLabels.id })
      .from(promptLabels)
      .innerJoin(promptVersions, eq(promptLabels.promptVersionId, promptVersions.id))
      .where(and(eq(promptVersions.promptId, input.promptId), eq(promptLabels.label, input.label)));

    if (existingLabels.length > 0) {
      await tx.delete(promptLabels).where(
        inArray(
          promptLabels.id,
          existingLabels.map((l) => l.id),
        ),
      );
    }

    // Create the new label assignment
    const [row] = await tx
      .insert(promptLabels)
      .values({
        id: input.id,
        promptVersionId: input.promptVersionId,
        label: input.label,
      })
      .returning();
    return row;
  });
}

export async function getLabelsForVersion(promptVersionId: string) {
  return db.select().from(promptLabels).where(eq(promptLabels.promptVersionId, promptVersionId));
}

/** Batch fetch labels for multiple version IDs in a single query. */
export async function getLabelsForVersions(promptVersionIds: string[]) {
  if (promptVersionIds.length === 0) return [];
  return db
    .select()
    .from(promptLabels)
    .where(inArray(promptLabels.promptVersionId, promptVersionIds));
}

export async function deletePromptLabel(promptVersionId: string, label: string): Promise<boolean> {
  const [deleted] = await db
    .delete(promptLabels)
    .where(and(eq(promptLabels.promptVersionId, promptVersionId), eq(promptLabels.label, label)))
    .returning({ id: promptLabels.id });
  return !!deleted;
}
