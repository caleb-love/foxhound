import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  upsertAgentConfig,
  getAgentConfig,
  listSlaConfigs,
  countSlaConfigs,
  deleteAgentConfig,
} from "@foxhound/db";
import { setCacheEntry, deleteCacheEntry } from "../lib/config-cache.js";
import { trackPendoEvent } from "../lib/pendo.js";
import { parseParams, AgentIdParamSchema } from "../lib/params.js";
import { paginatedResponse } from "../lib/pagination.js";

const UpsertSLASchema = z
  .object({
    maxDurationMs: z.number().int().positive().optional(),
    minSuccessRate: z.number().min(0).max(1).optional(),
    evaluationWindowMs: z.number().int().positive().max(604_800_000).default(86400000),
    minSampleSize: z.number().int().positive().default(10),
  })
  .refine((data) => data.maxDurationMs !== undefined || data.minSuccessRate !== undefined, {
    message: "At least one of maxDurationMs or minSuccessRate is required",
  });

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  q: z.string().optional(),
  agentId: z.union([z.string(), z.array(z.string())]).optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  status: z.enum(["all", "success", "error"]).optional(),
  severity: z.enum(["all", "healthy", "warning", "critical"]).optional(),
});

export function slasRoutes(fastify: FastifyInstance): void {
  fastify.put("/v1/slas/:agentId", async (request, reply) => {
    const params = parseParams(request, reply, AgentIdParamSchema);
    if (!params) return;
    const { agentId } = params;
    const result = UpsertSLASchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const orgId = request.orgId;
    const existing = await getAgentConfig(orgId, agentId);
    const isCreate = !existing;

    const config = await upsertAgentConfig({
      id: existing?.id ?? `ac_${randomUUID()}`,
      orgId,
      agentId,
      maxDurationMs: result.data.maxDurationMs ?? null,
      minSuccessRate:
        result.data.minSuccessRate !== undefined ? String(result.data.minSuccessRate) : null,
      evaluationWindowMs: result.data.evaluationWindowMs,
      minSampleSize: result.data.minSampleSize,
      // Preserve existing budget fields
      costBudgetUsd: existing?.costBudgetUsd,
      costAlertThresholdPct: existing?.costAlertThresholdPct,
      budgetPeriod: existing?.budgetPeriod,
    });

    setCacheEntry(orgId, agentId, {
      costBudgetUsd: config.costBudgetUsd ? Number(config.costBudgetUsd) : null,
      costAlertThresholdPct: config.costAlertThresholdPct,
      budgetPeriod: config.budgetPeriod,
      maxDurationMs: config.maxDurationMs,
      minSuccessRate: config.minSuccessRate ? Number(config.minSuccessRate) : null,
      evaluationWindowMs: config.evaluationWindowMs,
    });

    trackPendoEvent({
      event: "sla_configured",
      visitorId: request.userId ?? "system",
      accountId: orgId,
      properties: {
        agentId,
        maxDurationMs: result.data.maxDurationMs ?? null,
        minSuccessRate: result.data.minSuccessRate ?? null,
        evaluationWindowMs: result.data.evaluationWindowMs,
        minSampleSize: result.data.minSampleSize,
        isCreate,
      },
    });

    return reply.code(isCreate ? 201 : 200).send(config);
  });

  fastify.get("/v1/slas", async (request, reply) => {
    const result = ListQuerySchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const agentIds =
      typeof result.data.agentId === "string" ? [result.data.agentId] : result.data.agentId;

    const filters = {
      orgId: request.orgId,
      page: result.data.page,
      limit: result.data.limit,
      searchQuery: result.data.q,
      agentIds,
    };

    const [slaConfigs, totalCount] = await Promise.all([
      listSlaConfigs(filters),
      countSlaConfigs(filters),
    ]);
    return reply
      .code(200)
      .send(paginatedResponse(slaConfigs, result.data.page, result.data.limit, totalCount));
  });

  fastify.get("/v1/slas/:agentId", async (request, reply) => {
    const params = parseParams(request, reply, AgentIdParamSchema);
    if (!params) return;
    const { agentId } = params;
    const config = await getAgentConfig(request.orgId, agentId);
    if (!config || (config.maxDurationMs === null && config.minSuccessRate === null)) {
      return reply.code(404).send({ error: "No SLA configured for this agent" });
    }
    return reply.code(200).send(config);
  });

  fastify.delete("/v1/slas/:agentId", async (request, reply) => {
    const params = parseParams(request, reply, AgentIdParamSchema);
    if (!params) return;
    const { agentId } = params;
    const config = await getAgentConfig(request.orgId, agentId);
    if (config) {
      if (config.costBudgetUsd !== null) {
        await upsertAgentConfig({
          ...config,
          maxDurationMs: null,
          minSuccessRate: null,
          evaluationWindowMs: null,
          minSampleSize: null,
        });
      } else {
        await deleteAgentConfig(request.orgId, agentId);
      }
    }
    deleteCacheEntry(request.orgId, agentId);
    return reply.code(204).send();
  });
}
