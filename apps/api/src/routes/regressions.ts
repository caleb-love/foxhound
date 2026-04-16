import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getRecentBaselines,
  deleteBaseline,
  getBaseline,
  getSpanStructureForVersion,
} from "@foxhound/db";
import { trackPendoEvent } from "../lib/pendo.js";
import { parseParams, AgentIdParamSchema } from "../lib/params.js";

const CompareSchema = z.object({
  versionA: z.string().min(1),
  versionB: z.string().min(1),
});

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

function detectStructuralDrift(
  baselineA: Record<string, number>,
  baselineB: Record<string, number>,
): Array<{
  type: "missing" | "new";
  span: string;
  previousFrequency?: number;
  newFrequency?: number;
}> {
  const regressions: Array<{
    type: "missing" | "new";
    span: string;
    previousFrequency?: number;
    newFrequency?: number;
  }> = [];
  const THRESHOLD = 0.1; // 10% frequency threshold

  // Missing spans: existed in A but not in B
  for (const [span, freq] of Object.entries(baselineA)) {
    if (freq >= THRESHOLD && (baselineB[span] === undefined || baselineB[span] < THRESHOLD)) {
      regressions.push({ type: "missing", span, previousFrequency: freq });
    }
  }

  // New spans: exist in B but not in A
  for (const [span, freq] of Object.entries(baselineB)) {
    if (freq >= THRESHOLD && (baselineA[span] === undefined || baselineA[span] < THRESHOLD)) {
      regressions.push({ type: "new", span, newFrequency: freq });
    }
  }

  return regressions;
}

export function regressionsRoutes(fastify: FastifyInstance): void {
  // GET latest regression report for an agent
  fastify.get("/v1/regressions/:agentId", async (request, reply) => {
    const params = parseParams(request, reply, AgentIdParamSchema);
      if (!params) return;
      const { agentId } = params;
    const baselines = await getRecentBaselines(request.orgId, agentId, 2);

    if (baselines.length < 2) {
      return reply
        .code(200)
        .send({ agentId, regressions: [], message: "Insufficient baselines for comparison" });
    }

    const [newer, older] = baselines;
    const regressions = detectStructuralDrift(older!.spanStructure, newer!.spanStructure);

    return reply.code(200).send({
      agentId,
      previousVersion: older!.agentVersion,
      newVersion: newer!.agentVersion,
      regressions,
      sampleSize: { before: older!.sampleSize, after: newer!.sampleSize },
    });
  });

  // On-demand comparison
  fastify.post(
    "/v1/regressions/:agentId/compare",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const params = parseParams(request, reply, AgentIdParamSchema);
      if (!params) return;
      const { agentId } = params;
      const result = CompareSchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const { versionA, versionB } = result.data;
      const orgId = request.orgId;

      const [baselineA, baselineB] = await Promise.all([
        getBaseline(orgId, agentId, versionA),
        getBaseline(orgId, agentId, versionB),
      ]);

      // If baselines don't exist, compute on the fly
      const structA =
        (baselineA?.spanStructure as Record<string, number>) ??
        (await getSpanStructureForVersion(orgId, agentId, versionA));
      const structB =
        (baselineB?.spanStructure as Record<string, number>) ??
        (await getSpanStructureForVersion(orgId, agentId, versionB));

      const regressions = detectStructuralDrift(structA, structB);

      trackPendoEvent({
        event: "regression_comparison_executed",
        visitorId: request.userId ?? "system",
        accountId: orgId,
        properties: {
          agentId,
          versionA,
          versionB,
          regressionCount: regressions.length,
        },
      });

      return reply.code(200).send({
        agentId,
        previousVersion: versionA,
        newVersion: versionB,
        regressions,
        sampleSize: {
          before: baselineA?.sampleSize ?? 0,
          after: baselineB?.sampleSize ?? 0,
        },
      });
    },
  );

  // List baselines
  fastify.get("/v1/regressions/:agentId/baselines", async (request, reply) => {
    const params = parseParams(request, reply, AgentIdParamSchema);
      if (!params) return;
      const { agentId } = params;
    const query = ListQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Bad Request", issues: query.error.issues });
    }
    const baselines = await getRecentBaselines(request.orgId, agentId, query.data.limit);
    return reply.code(200).send({ data: baselines });
  });

  // Delete baseline
  fastify.delete("/v1/regressions/:agentId/baselines", async (request, reply) => {
    const params = parseParams(request, reply, AgentIdParamSchema);
      if (!params) return;
      const { agentId } = params;
    const { version } = request.query as { version?: string };
    if (!version) {
      return reply.code(400).send({ error: "version query parameter is required" });
    }
    await deleteBaseline(request.orgId, agentId, version);
    return reply.code(204).send();
  });
}
