import { and, asc, count, desc, eq, gt, gte, inArray, lte, lt, sql } from "drizzle-orm";
import { db } from "./client.js";
import {
  datasetItems,
  datasets,
  experimentRuns,
  experiments,
  scores,
  spans,
  traces,
} from "./schema.js";

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

export async function getExperimentComparison(experimentIds: string[], orgId: string) {
  if (experimentIds.length === 0) return null;

  const exps = await db
    .select()
    .from(experiments)
    .where(and(eq(experiments.orgId, orgId), inArray(experiments.id, experimentIds)));

  if (exps.length !== experimentIds.length) return null;

  const runRows = await db
    .select({ run: experimentRuns })
    .from(experimentRuns)
    .innerJoin(experiments, eq(experimentRuns.experimentId, experiments.id))
    .where(and(inArray(experimentRuns.experimentId, experimentIds), eq(experiments.orgId, orgId)))
    .orderBy(asc(experimentRuns.datasetItemId));

  const runs = runRows.map((r) => r.run);

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
