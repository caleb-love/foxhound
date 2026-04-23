import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  createScore,
  queryScores,
  countScores,
  getScoresByTraceId,
  deleteScore,
  getTrace,
} from "@foxhound/db";
import { trackPendoEvent } from "../lib/pendo.js";
import { parseParams, IdParamSchema } from "../lib/params.js";
import { paginatedResponse } from "../lib/pagination.js";

const CreateScoreSchema = z.object({
  traceId: z.string().min(1),
  spanId: z.string().optional(),
  name: z.string().min(1).max(100),
  value: z.number().min(0).max(1).optional(),
  label: z.string().max(100).optional(),
  source: z.enum(["manual", "llm_judge", "sdk", "user_feedback"]),
  comment: z.string().max(2000).optional(),
});

const QueryScoresSchema = z.object({
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  name: z.string().optional(),
  source: z.string().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export function scoresRoutes(fastify: FastifyInstance): void {
  /**
   * POST /v1/scores
   * Create a score attached to a trace (and optionally a span).
   */
  fastify.post("/v1/scores", async (request, reply) => {
    const result = CreateScoreSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const { traceId, spanId, name, value, label, source, comment } = result.data;
    const orgId = request.orgId;

    // Verify trace belongs to this org
    const trace = await getTrace(traceId, orgId);
    if (!trace) {
      return reply.code(404).send({ error: "Trace not found" });
    }

    // At least one of value or label must be provided
    if (value === undefined && label === undefined) {
      return reply.code(400).send({ error: "At least one of 'value' or 'label' is required" });
    }

    const score = await createScore({
      id: `scr_${randomUUID()}`,
      orgId,
      traceId,
      spanId,
      name,
      value,
      label,
      source,
      comment,
      userId: request.userId,
    });

    trackPendoEvent({
      event: "score_created",
      visitorId: request.userId ?? "system",
      accountId: orgId,
      properties: {
        traceId,
        spanId: spanId ?? null,
        scoreName: name,
        source,
        hasValue: value !== undefined,
        hasLabel: label !== undefined,
        hasComment: !!comment,
      },
    });

    return reply.code(201).send(score);
  });

  /**
   * GET /v1/scores
   * Query scores with filters — scoped to the authenticated org.
   */
  fastify.get("/v1/scores", async (request, reply) => {
    const result = QueryScoresSchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const filters = {
      orgId: request.orgId,
      ...result.data,
    };

    const [rows, totalCount] = await Promise.all([queryScores(filters), countScores(filters)]);

    return reply
      .code(200)
      .send(paginatedResponse(rows, result.data.page, result.data.limit, totalCount));
  });

  /**
   * GET /v1/traces/:id/scores
   * Get all scores for a specific trace.
   */
  fastify.get("/v1/traces/:id/scores", async (request, reply) => {
    const params = parseParams(request, reply, IdParamSchema);
    if (!params) return;
    const rows = await getScoresByTraceId(params.id, request.orgId);
    return reply.code(200).send({ data: rows });
  });

  /**
   * DELETE /v1/scores/:id
   * Delete a score by ID — scoped to the authenticated org.
   */
  fastify.delete("/v1/scores/:id", async (request, reply) => {
    const params = parseParams(request, reply, IdParamSchema);
    if (!params) return;
    const deleted = await deleteScore(params.id, request.orgId);
    if (!deleted) {
      return reply.code(404).send({ error: "Not Found", message: "Score not found" });
    }
    return reply.code(204).send();
  });
}
