import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";

function isUniqueViolation(error: unknown, constraintName?: string): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? error.code : undefined;
  const constraint = "constraint" in error ? error.constraint : undefined;
  return code === "23505" && (!constraintName || constraint === constraintName);
}
import {
  createPrompt,
  listPrompts,
  countPrompts,
  getPrompt,
  getPromptByName,
  deletePrompt,
  createPromptVersion,
  listPromptVersions,
  getPromptVersionByNumber,
  getPromptVersionByLabel,
  diffPromptVersions,
  setPromptLabel,
  getLabelsForVersions,
  deletePromptLabel,
  writeAuditLog,
} from "@foxhound/db";
import { requireEntitlement } from "../middleware/entitlements.js";
import { trackPendoEvent } from "../lib/pendo.js";
import { parseParams, IdParamSchema, IdLabelParamSchema } from "../lib/params.js";
import { paginatedResponse } from "../lib/pagination.js";

const CreatePromptSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, "Name must be alphanumeric with hyphens/underscores"),
});

const CreateVersionSchema = z.object({
  content: z.string().min(1).max(100000),
  model: z.string().max(100).optional(),
  config: z.record(z.unknown()).optional(),
});

const SetLabelSchema = z.object({
  label: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, "Label must be alphanumeric with hyphens/underscores"),
  versionNumber: z.number().int().positive(),
});

const ListPromptsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  q: z.string().optional(),
  promptId: z.union([z.string(), z.array(z.string())]).optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  status: z.enum(["all", "success", "error"]).optional(),
  severity: z.enum(["all", "healthy", "warning", "critical"]).optional(),
});

const PromptDiffQuerySchema = z.object({
  versionA: z.coerce.number().int().positive(),
  versionB: z.coerce.number().int().positive(),
});

const RESOLVE_CACHE_TTL_MS = 30_000;
const resolvePromptCache = new Map<
  string,
  {
    expiresAt: number;
    payload: {
      name: string;
      label: string;
      version: number;
      content: string;
      model: string | null;
      config: Record<string, unknown>;
    };
  }
>();

export function promptsRoutes(fastify: FastifyInstance): void {
  // ── Prompts CRUD ────────────────────────────────────────────────────────

  /**
   * POST /v1/prompts
   * Create a new prompt (container for versions).
   */
  fastify.post(
    "/v1/prompts",
    {
      preHandler: [requireEntitlement("canManagePrompts")],
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const result = CreatePromptSchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const orgId = request.orgId;
      const { name } = result.data;

      // Check for duplicate name within org
      const existing = await getPromptByName(name, orgId);
      if (existing) {
        return reply
          .code(409)
          .send({ error: "Conflict", message: `Prompt "${name}" already exists` });
      }

      let prompt;
      try {
        prompt = await createPrompt({
          id: `pmt_${randomUUID()}`,
          orgId,
          name,
        });
      } catch (error) {
        if (isUniqueViolation(error, "prompts_org_name_unique")) {
          return reply
            .code(409)
            .send({ error: "Conflict", message: `Prompt "${name}" already exists` });
        }
        throw error;
      }

      if (!prompt) {
        return reply
          .code(500)
          .send({ error: "Internal Server Error", message: "Failed to create prompt" });
      }

      trackPendoEvent({
        event: "prompt_created",
        visitorId: request.userId ?? "system",
        accountId: orgId,
        properties: {
          promptId: prompt.id,
          name,
        },
      });

      writeAuditLog({
        orgId,
        action: "prompt.create",
        targetType: "prompt",
        targetId: prompt.id,
        metadata: { name },
        ipAddress: request.ip,
      }).catch((err) => {
        request.log.error({ err, action: "prompt.create" }, "Audit log write failed");
      });

      return reply.code(201).send(prompt);
    },
  );

  /**
   * GET /v1/prompts
   * List all prompts for the authenticated org.
   */
  fastify.get(
    "/v1/prompts",
    { preHandler: [requireEntitlement("canManagePrompts")] },
    async (request, reply) => {
      const query = ListPromptsQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send({ error: "Bad Request", issues: query.error.issues });
      }

      const { page, limit, q, promptId } = query.data;
      const promptIds = typeof promptId === "string" ? [promptId] : promptId;
      const filters = {
        orgId: request.orgId,
        page,
        limit,
        searchQuery: q,
        promptIds,
      };
      const [rows, totalCount] = await Promise.all([
        listPrompts(filters),
        countPrompts(filters),
      ]);
      return reply.code(200).send(paginatedResponse(rows, page, limit, totalCount));
    },
  );

  /**
   * GET /v1/prompts/:id
   * Get a single prompt by ID.
   */
  fastify.get(
    "/v1/prompts/:id",
    { preHandler: [requireEntitlement("canManagePrompts")] },
    async (request, reply) => {
      const p = parseParams(request, reply, IdParamSchema);
      if (!p) return;
      const { id } = p;
      const prompt = await getPrompt(id, request.orgId);
      if (!prompt) {
        return reply.code(404).send({ error: "Not Found", message: "Prompt not found" });
      }
      return reply.code(200).send(prompt);
    },
  );

  /**
   * DELETE /v1/prompts/:id
   * Delete a prompt and all its versions/labels (cascade).
   */
  fastify.delete(
    "/v1/prompts/:id",
    { preHandler: [requireEntitlement("canManagePrompts")] },
    async (request, reply) => {
      const p = parseParams(request, reply, IdParamSchema);
      if (!p) return;
      const { id } = p;
      const deleted = await deletePrompt(id, request.orgId);
      if (!deleted) {
        return reply.code(404).send({ error: "Not Found", message: "Prompt not found" });
      }

      writeAuditLog({
        orgId: request.orgId,
        action: "prompt.delete",
        targetType: "prompt",
        targetId: id,
        ipAddress: request.ip,
      }).catch((err) => {
        request.log.error({ err, action: "prompt.delete" }, "Audit log write failed");
      });

      return reply.code(204).send();
    },
  );

  // ── Versions ────────────────────────────────────────────────────────────

  /**
   * POST /v1/prompts/:id/versions
   * Create a new version for a prompt. Auto-increments version number.
   */
  fastify.post(
    "/v1/prompts/:id/versions",
    {
      preHandler: [requireEntitlement("canManagePrompts")],
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const p = parseParams(request, reply, IdParamSchema);
      if (!p) return;
      const { id } = p;
      const result = CreateVersionSchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const prompt = await getPrompt(id, request.orgId);
      if (!prompt) {
        return reply.code(404).send({ error: "Not Found", message: "Prompt not found" });
      }

      // Version number auto-incremented atomically inside createPromptVersion
      const version = await createPromptVersion({
        id: `pmv_${randomUUID()}`,
        promptId: id,
        orgId: request.orgId,
        content: result.data.content,
        model: result.data.model,
        config: result.data.config,
        createdBy: request.userId,
      });

      if (!version) {
        return reply
          .code(500)
          .send({ error: "Internal Server Error", message: "Failed to create version" });
      }

      trackPendoEvent({
        event: "prompt_version_created",
        visitorId: request.userId ?? "system",
        accountId: request.orgId,
        properties: {
          promptId: id,
          versionId: version.id,
          versionNumber: version.version,
          model: result.data.model ?? null,
          contentLength: result.data.content.length,
        },
      });

      writeAuditLog({
        orgId: request.orgId,
        action: "prompt_version.create",
        targetType: "prompt_version",
        targetId: version.id,
        metadata: { promptId: id, version: version.version },
        ipAddress: request.ip,
      }).catch((err) => {
        request.log.error({ err, action: "prompt_version.create" }, "Audit log write failed");
      });

      return reply.code(201).send(version);
    },
  );

  /**
   * GET /v1/prompts/:id/versions
   * List all versions for a prompt.
   */
  fastify.get(
    "/v1/prompts/:id/versions",
    {
      preHandler: [requireEntitlement("canManagePrompts")],
      config: { rateLimit: { max: 600, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const p = parseParams(request, reply, IdParamSchema);
      if (!p) return;
      const { id } = p;
      const prompt = await getPrompt(id, request.orgId);
      if (!prompt) {
        return reply.code(404).send({ error: "Not Found", message: "Prompt not found" });
      }

      const versions = await listPromptVersions(id, request.orgId);

      // Batch-fetch labels in a single query instead of N+1
      const allLabels = await getLabelsForVersions(versions.map((v) => v.id));
      const labelsByVersionId = new Map<string, string[]>();
      for (const l of allLabels) {
        const arr = labelsByVersionId.get(l.promptVersionId) ?? [];
        arr.push(l.label);
        labelsByVersionId.set(l.promptVersionId, arr);
      }

      const versionsWithLabels = versions.map((v) => ({
        ...v,
        labels: labelsByVersionId.get(v.id) ?? [],
      }));

      return reply.code(200).send({ data: versionsWithLabels });
    },
  );

  /**
   * GET /v1/prompts/:id/diff?versionA=<number>&versionB=<number>
   * Compare two versions of the same prompt.
   */
  fastify.get(
    "/v1/prompts/:id/diff",
    {
      preHandler: [requireEntitlement("canManagePrompts")],
      config: { rateLimit: { max: 300, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const p = parseParams(request, reply, IdParamSchema);
      if (!p) return;
      const { id } = p;
      const query = PromptDiffQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send({ error: "Bad Request", issues: query.error.issues });
      }

      const prompt = await getPrompt(id, request.orgId);
      if (!prompt) {
        return reply.code(404).send({ error: "Not Found", message: "Prompt not found" });
      }

      const { versionA, versionB } = query.data;
      const diff = await diffPromptVersions(id, request.orgId, versionA, versionB);
      if (!diff) {
        return reply.code(404).send({
          error: "Not Found",
          message: "One or both prompt versions were not found",
        });
      }

      return reply.code(200).send({
        ...diff,
        promptName: prompt.name,
      });
    },
  );

  // ── Labels ──────────────────────────────────────────────────────────────

  /**
   * POST /v1/prompts/:id/labels
   * Set a label (e.g. "production", "staging") on a specific version number.
   * Moves the label if it already exists on another version.
   */
  fastify.post(
    "/v1/prompts/:id/labels",
    {
      preHandler: [requireEntitlement("canManagePrompts")],
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const p = parseParams(request, reply, IdParamSchema);
      if (!p) return;
      const { id } = p;
      const result = SetLabelSchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const prompt = await getPrompt(id, request.orgId);
      if (!prompt) {
        return reply.code(404).send({ error: "Not Found", message: "Prompt not found" });
      }

      const { label, versionNumber } = result.data;
      const version = await getPromptVersionByNumber(id, request.orgId, versionNumber);
      if (!version) {
        return reply.code(404).send({
          error: "Not Found",
          message: `Version ${versionNumber} not found`,
        });
      }

      const labelRow = await setPromptLabel({
        id: `pml_${randomUUID()}`,
        promptVersionId: version.id,
        promptId: id,
        label,
      });

      trackPendoEvent({
        event: "prompt_label_set",
        visitorId: request.userId ?? "system",
        accountId: request.orgId,
        properties: {
          promptId: id,
          versionNumber,
          label,
        },
      });

      writeAuditLog({
        orgId: request.orgId,
        action: "prompt_label.set",
        targetType: "prompt_label",
        targetId: labelRow?.id ?? "",
        metadata: { promptId: id, version: versionNumber, label },
        ipAddress: request.ip,
      }).catch((err) => {
        request.log.error({ err, action: "prompt_label.set" }, "Audit log write failed");
      });

      return reply.code(200).send({ message: `Label "${label}" set on version ${versionNumber}` });
    },
  );

  /**
   * DELETE /v1/prompts/:id/labels/:label
   * Remove a label from whichever version currently owns it for this prompt.
   */
  fastify.delete(
    "/v1/prompts/:id/labels/:label",
    {
      preHandler: [requireEntitlement("canManagePrompts")],
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const p = parseParams(request, reply, IdLabelParamSchema);
      if (!p) return;
      const { id, label } = p;

      const prompt = await getPrompt(id, request.orgId);
      if (!prompt) {
        return reply.code(404).send({ error: "Not Found", message: "Prompt not found" });
      }

      const version = await getPromptVersionByLabel(request.orgId, prompt.name, label);
      if (!version || version.promptId !== id) {
        return reply.code(404).send({
          error: "Not Found",
          message: `Label "${label}" not found`,
        });
      }

      const deleted = await deletePromptLabel(version.id, label);
      if (!deleted) {
        return reply.code(404).send({
          error: "Not Found",
          message: `Label "${label}" not found`,
        });
      }

      trackPendoEvent({
        event: "prompt_label_deleted",
        visitorId: request.userId ?? "system",
        accountId: request.orgId,
        properties: {
          promptId: id,
          versionNumber: version.version,
          label,
        },
      });

      writeAuditLog({
        orgId: request.orgId,
        action: "prompt_label.delete",
        targetType: "prompt_label",
        targetId: version.id,
        metadata: { promptId: id, version: version.version, label },
        ipAddress: request.ip,
      }).catch((err) => {
        request.log.error({ err, action: "prompt_label.delete" }, "Audit log write failed");
      });

      return reply.code(204).send();
    },
  );

  // ── SDK Resolution Endpoint ─────────────────────────────────────────────

  /**
   * GET /v1/prompts/resolve?name=<name>&label=<label>
   * Resolve a prompt by name + label. Used by SDKs for `fox.prompts.get()`.
   * Returns the full prompt version content, model, and config.
   * No entitlement gate — available to all plans for SDK consumption.
   */
  fastify.get(
    "/v1/prompts/resolve",
    { config: { rateLimit: { max: 600, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { name, label } = request.query as { name?: string; label?: string };

      if (!name) {
        return reply
          .code(400)
          .send({ error: "Bad Request", message: "name query param is required" });
      }

      const resolvedLabel = label ?? "production";
      const cacheKey = `${request.orgId}:${name}:${resolvedLabel}`;
      const cached = resolvePromptCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return reply.code(200).send(cached.payload);
      }

      const version = await getPromptVersionByLabel(request.orgId, name, resolvedLabel);
      if (!version) {
        return reply.code(404).send({
          error: "Not Found",
          message: `No prompt "${name}" with label "${resolvedLabel}" found`,
        });
      }

      trackPendoEvent({
        event: "prompt_resolved",
        visitorId: request.userId ?? "system",
        accountId: request.orgId,
        properties: {
          promptName: name,
          label: resolvedLabel,
          versionNumber: version.version,
        },
      });

      writeAuditLog({
        orgId: request.orgId,
        action: "prompt.resolve",
        targetType: "prompt_version",
        targetId: version.id,
        metadata: {
          name,
          label: resolvedLabel,
          version: version.version,
        },
        ipAddress: request.ip,
      }).catch((err) => {
        request.log.error({ err, action: "prompt.resolve" }, "Audit log write failed");
      });

      const payload = {
        name,
        label: resolvedLabel,
        version: version.version,
        content: version.content,
        model: version.model,
        config: version.config,
      };

      resolvePromptCache.set(cacheKey, {
        expiresAt: Date.now() + RESOLVE_CACHE_TTL_MS,
        payload,
      });

      return reply.code(200).send(payload);
    },
  );
}
