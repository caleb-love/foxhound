import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./client.js";
import { annotationQueueItems, annotationQueues } from "./schema.js";

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
