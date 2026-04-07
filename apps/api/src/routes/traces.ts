import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { insertTrace, queryTraces, getTrace, getReplayContext, diffTraces } from "@foxhound/db";

const SpanEventSchema = z.object({
  timeMs: z.number(),
  name: z.string(),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

const SpanSchema = z.object({
  traceId: z.string(),
  spanId: z.string(),
  parentSpanId: z.string().optional(),
  name: z.string(),
  kind: z.enum(["tool_call", "llm_call", "agent_step", "workflow", "custom"]),
  startTimeMs: z.number(),
  endTimeMs: z.number().optional(),
  status: z.enum(["ok", "error", "unset"]),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  events: z.array(SpanEventSchema),
});

const IngestTraceSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  sessionId: z.string().optional(),
  spans: z.array(SpanSchema),
  startTimeMs: z.number(),
  endTimeMs: z.number().optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

const DiffQuerySchema = z.object({
  runA: z.string().min(1),
  runB: z.string().min(1),
});

const QueryTracesSchema = z.object({
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export async function tracesRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/traces
   * Accept a trace payload from the SDK and persist it asynchronously.
   * Returns 202 immediately to avoid blocking the caller's hot path.
   * Scoped to the authenticated org (from API key middleware).
   */
  fastify.post("/v1/traces", async (request, reply) => {
    const result = IngestTraceSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const trace = result.data;
    const orgId = request.orgId;

    reply.code(202).send({ accepted: true, id: trace.id });

    setImmediate(() => {
      insertTrace(trace, orgId).catch((err: unknown) => {
        fastify.log.error({ err, traceId: trace.id }, "Failed to persist trace");
      });
    });
  });

  /**
   * GET /v1/traces/:id
   * Fetch a single trace by ID — scoped to the authenticated org.
   */
  fastify.get("/v1/traces/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const trace = await getTrace(id, request.orgId);
    if (!trace) {
      return reply.code(404).send({ error: "Not Found" });
    }
    return reply.code(200).send(trace);
  });

  /**
   * GET /v1/traces/:traceId/spans/:spanId/replay
   * Reconstruct the full agent context at the moment a specific span began.
   * Scoped to the authenticated org.
   */
  fastify.get("/v1/traces/:traceId/spans/:spanId/replay", async (request, reply) => {
    const { traceId, spanId } = request.params as { traceId: string; spanId: string };
    const context = await getReplayContext(traceId, spanId, request.orgId);
    if (!context) {
      return reply.code(404).send({ error: "Not Found" });
    }
    return reply.code(200).send(context);
  });

  /**
   * GET /v1/runs/diff
   * Side-by-side diff of two agent runs — scoped to the authenticated org.
   */
  fastify.get("/v1/runs/diff", async (request, reply) => {
    const result = DiffQuerySchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const { runA, runB } = result.data;
    const diff = await diffTraces(runA, runB, request.orgId);
    if (!diff) {
      return reply.code(404).send({ error: "One or both runs not found" });
    }

    return reply.code(200).send(diff);
  });

  /**
   * GET /v1/traces
   * Query persisted traces with optional filters — scoped to the authenticated org.
   */
  fastify.get("/v1/traces", async (request, reply) => {
    const result = QueryTracesSchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const { agentId, sessionId, from, to, page, limit } = result.data;

    const rows = await queryTraces({ orgId: request.orgId, agentId, sessionId, from, to, page, limit });

    return reply.code(200).send({
      data: rows,
      pagination: { page, limit, count: rows.length },
    });
  });
}
