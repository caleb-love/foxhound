import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { insertTrace, queryTraces } from "@fox/db";

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
   */
  fastify.post("/v1/traces", async (request, reply) => {
    const result = IngestTraceSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const trace = result.data;

    // Respond 202 immediately; persist in the next event loop tick
    reply.code(202).send({ accepted: true, id: trace.id });

    setImmediate(() => {
      insertTrace(trace).catch((err: unknown) => {
        fastify.log.error({ err, traceId: trace.id }, "Failed to persist trace");
      });
    });
  });

  /**
   * GET /v1/traces
   * Query persisted traces with optional filters and pagination.
   */
  fastify.get("/v1/traces", async (request, reply) => {
    const result = QueryTracesSchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const { agentId, sessionId, from, to, page, limit } = result.data;

    const rows = await queryTraces({ agentId, sessionId, from, to, page, limit });

    return reply.code(200).send({
      data: rows,
      pagination: { page, limit, count: rows.length },
    });
  });
}
