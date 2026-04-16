import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "./client.js";
import { alertRules, notificationChannels, notificationLog } from "./schema.js";

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

export interface NotificationChannelListFilters {
  orgId: string;
  searchQuery?: string;
  channelIds?: string[];
}

export async function listNotificationChannels(filters: NotificationChannelListFilters) {
  const conditions = [eq(notificationChannels.orgId, filters.orgId)];

  if (filters.searchQuery) {
    const q = `%${filters.searchQuery}%`;
    conditions.push(ilike(notificationChannels.name, q));
  }

  if (filters.channelIds && filters.channelIds.length > 0) {
    conditions.push(inArray(notificationChannels.id, filters.channelIds));
  }

  return db
    .select()
    .from(notificationChannels)
    .where(and(...conditions))
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
  dedupeKey?: string;
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
      dedupeKey: input.dedupeKey ?? null,
    })
    .onConflictDoNothing({ target: notificationLog.dedupeKey })
    .returning();
  return rows[0] ?? null;
}
