import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  upsertAgentConfig,
  getAgentConfig,
  listAgentConfigs,
  deleteAgentConfig,
} from "@foxhound/db";
import { setCacheEntry, deleteCacheEntry } from "../lib/config-cache.js";
import { trackPendoEvent } from "../lib/pendo.js";
import { parseParams, AgentIdParamSchema } from "../lib/params.js";

const UpsertBudgetSchema = z.object({
  costBudgetUsd: z.number().positive(),
  costAlertThresholdPct: z.number().int().min(1).max(100).default(80),
  budgetPeriod: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
});

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export function budgetsRoutes(fastify: FastifyInstance): void {
  fastify.put("/v1/budgets/:agentId", async (request, reply) => {
    const params = parseParams(request, reply, AgentIdParamSchema);
    if (!params) return;
    const { agentId } = params;
    const result = UpsertBudgetSchema.safeParse(request.body);
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
      costBudgetUsd: String(result.data.costBudgetUsd),
      costAlertThresholdPct: result.data.costAlertThresholdPct,
      budgetPeriod: result.data.budgetPeriod,
      // Preserve existing SLA fields if they exist
      maxDurationMs: existing?.maxDurationMs,
      minSuccessRate: existing?.minSuccessRate,
      evaluationWindowMs: existing?.evaluationWindowMs,
      minSampleSize: existing?.minSampleSize,
    });

    setCacheEntry(orgId, agentId, {
      costBudgetUsd: Number(config.costBudgetUsd),
      costAlertThresholdPct: config.costAlertThresholdPct,
      budgetPeriod: config.budgetPeriod,
      maxDurationMs: config.maxDurationMs,
      minSuccessRate: config.minSuccessRate ? Number(config.minSuccessRate) : null,
      evaluationWindowMs: config.evaluationWindowMs,
    });

    trackPendoEvent({
      event: "budget_configured",
      visitorId: request.userId ?? "system",
      accountId: orgId,
      properties: {
        agentId,
        costBudgetUsd: result.data.costBudgetUsd,
        costAlertThresholdPct: result.data.costAlertThresholdPct,
        budgetPeriod: result.data.budgetPeriod,
        isCreate,
      },
    });

    return reply.code(isCreate ? 201 : 200).send(config);
  });

  fastify.get("/v1/budgets", async (request, reply) => {
    const result = ListQuerySchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }
    const configs = await listAgentConfigs(request.orgId, result.data.page, result.data.limit);
    const budgetConfigs = configs.filter((c) => c.costBudgetUsd !== null);
    return reply.code(200).send({
      data: budgetConfigs,
      pagination: { page: result.data.page, limit: result.data.limit, count: budgetConfigs.length },
    });
  });

  fastify.get("/v1/budgets/:agentId", async (request, reply) => {
    const params = parseParams(request, reply, AgentIdParamSchema);
    if (!params) return;
    const { agentId } = params;
    const config = await getAgentConfig(request.orgId, agentId);
    if (!config || config.costBudgetUsd === null) {
      return reply.code(404).send({ error: "No budget configured for this agent" });
    }
    return reply.code(200).send(config);
  });

  fastify.delete("/v1/budgets/:agentId", async (request, reply) => {
    const params = parseParams(request, reply, AgentIdParamSchema);
    if (!params) return;
    const { agentId } = params;
    const config = await getAgentConfig(request.orgId, agentId);
    if (config) {
      // If SLA fields exist, just null out budget fields; otherwise delete the row
      if (config.maxDurationMs !== null || config.minSuccessRate !== null) {
        await upsertAgentConfig({
          ...config,
          costBudgetUsd: null,
          costAlertThresholdPct: null,
          budgetPeriod: null,
        });
      } else {
        await deleteAgentConfig(request.orgId, agentId);
      }
    }
    deleteCacheEntry(request.orgId, agentId);
    return reply.code(204).send();
  });
}
