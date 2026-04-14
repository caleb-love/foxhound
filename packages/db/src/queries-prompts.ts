import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./client.js";
import { promptLabels, prompts, promptVersions } from "./schema.js";

export interface CreatePromptInput {
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

export interface CreatePromptVersionInput {
  id: string;
  promptId: string;
  orgId: string;
  content: string;
  model?: string;
  config?: Record<string, unknown>;
  createdBy?: string | null;
}

export async function createPromptVersion(input: CreatePromptVersionInput) {
  return db.transaction(async (tx) => {
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

export async function getPromptVersionByLabel(orgId: string, promptName: string, label: string) {
  const rows = await db
    .select({
      version: promptVersions,
      label: promptLabels.label,
    })
    .from(promptLabels)
    .innerJoin(promptVersions, eq(promptLabels.promptVersionId, promptVersions.id))
    .innerJoin(prompts, eq(promptVersions.promptId, prompts.id))
    .where(and(eq(prompts.orgId, orgId), eq(prompts.name, promptName), eq(promptLabels.label, label)))
    .limit(1);

  return rows[0]?.version ?? null;
}

export interface PromptVersionDiffEntry {
  field: "content" | "model" | "config";
  before: unknown;
  after: unknown;
}

export interface PromptVersionDiffResult {
  promptId: string;
  versionA: number;
  versionB: number;
  changes: PromptVersionDiffEntry[];
  hasChanges: boolean;
}

export async function diffPromptVersions(
  promptId: string,
  orgId: string,
  versionANumber: number,
  versionBNumber: number,
): Promise<PromptVersionDiffResult | null> {
  const [versionA, versionB] = await Promise.all([
    getPromptVersionByNumber(promptId, orgId, versionANumber),
    getPromptVersionByNumber(promptId, orgId, versionBNumber),
  ]);

  if (!versionA || !versionB) return null;

  const changes: PromptVersionDiffEntry[] = [];

  if (versionA.content !== versionB.content) {
    changes.push({ field: "content", before: versionA.content, after: versionB.content });
  }

  if (versionA.model !== versionB.model) {
    changes.push({ field: "model", before: versionA.model, after: versionB.model });
  }

  if (JSON.stringify(versionA.config ?? {}) !== JSON.stringify(versionB.config ?? {})) {
    changes.push({ field: "config", before: versionA.config ?? {}, after: versionB.config ?? {} });
  }

  return {
    promptId,
    versionA: versionA.version,
    versionB: versionB.version,
    changes,
    hasChanges: changes.length > 0,
  };
}

export interface SetPromptLabelInput {
  id: string;
  promptVersionId: string;
  promptId: string;
  label: string;
}

export async function setPromptLabel(input: SetPromptLabelInput) {
  return db.transaction(async (tx) => {
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

export async function getLabelsForVersions(promptVersionIds: string[]) {
  if (promptVersionIds.length === 0) return [];
  return db.select().from(promptLabels).where(inArray(promptLabels.promptVersionId, promptVersionIds));
}

export async function deletePromptLabel(promptVersionId: string, label: string): Promise<boolean> {
  const [deleted] = await db
    .delete(promptLabels)
    .where(and(eq(promptLabels.promptVersionId, promptVersionId), eq(promptLabels.label, label)))
    .returning({ id: promptLabels.id });
  return !!deleted;
}
