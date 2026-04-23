import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "./client.js";
import { evaluatorRuns, evaluators, scores } from "./schema.js";

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

function buildScoreConditions(filters: ScoreFilters) {
  const conditions = [eq(scores.orgId, filters.orgId)];
  if (filters.traceId) conditions.push(eq(scores.traceId, filters.traceId));
  if (filters.spanId) conditions.push(eq(scores.spanId, filters.spanId));
  if (filters.name) conditions.push(eq(scores.name, filters.name));
  if (filters.source)
    conditions.push(eq(scores.source, filters.source as CreateScoreInput["source"]));
  if (filters.minValue != null) conditions.push(gte(scores.value, filters.minValue));
  if (filters.maxValue != null) conditions.push(lte(scores.value, filters.maxValue));
  return conditions;
}

export async function queryScores(filters: ScoreFilters) {
  const { page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;
  const conditions = buildScoreConditions(filters);

  return db
    .select()
    .from(scores)
    .where(and(...conditions))
    .orderBy(desc(scores.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countScores(filters: ScoreFilters) {
  const conditions = buildScoreConditions(filters);
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(scores)
    .where(and(...conditions));

  return Number(row?.count ?? 0);
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

export interface EvaluatorListFilters {
  orgId: string;
  searchQuery?: string;
  evaluatorIds?: string[];
}

export async function listEvaluators(filters: EvaluatorListFilters) {
  const conditions = [eq(evaluators.orgId, filters.orgId)];

  if (filters.searchQuery) {
    conditions.push(
      sql`lower(${evaluators.name}) like ${`%${filters.searchQuery.toLowerCase()}%`}`,
    );
  }

  if (filters.evaluatorIds && filters.evaluatorIds.length > 0) {
    conditions.push(inArray(evaluators.id, filters.evaluatorIds));
  }

  return db
    .select()
    .from(evaluators)
    .where(and(...conditions))
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
