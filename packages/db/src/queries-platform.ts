import { and, desc, eq, gt, gte, isNotNull, lt, or, sql } from "drizzle-orm";
import { db } from "./client.js";
import {
  agentConfigs,
  behaviorBaselines,
  memberships,
  modelPricingOverrides,
  organizations,
  spans,
  ssoConfigs,
  ssoSessions,
  traces,
  usageRecords,
  users,
  waitlistSignups,
} from "./schema.js";

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

export interface JitProvisionInput {
  userId: string;
  email: string;
  name: string;
  orgId: string;
  role?: "admin" | "member";
}

export async function jitProvisionUser(input: JitProvisionInput) {
  return db.transaction(async (tx) => {
    const existingRows = await tx.select().from(users).where(eq(users.email, input.email)).limit(1);
    const existing = existingRows[0];

    if (existing) {
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

export async function getModelPricingOverrides(): Promise<
  Array<typeof modelPricingOverrides.$inferSelect>
> {
  return db.select().from(modelPricingOverrides);
}

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

  const totalTraces = await countTracesForVersion(orgId, agentId, agentVersion);
  if (totalTraces === 0) return {};

  const structure: Record<string, number> = {};
  for (const row of rows) {
    const key = `${row.kind}:${row.name}`;
    structure[key] = row.traceCount / totalTraces;
  }
  return structure;
}
