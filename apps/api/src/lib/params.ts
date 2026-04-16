import { z } from "zod";
import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Common param schemas for route handlers.
 * Usage: const { id } = parseParams(request, reply, IdParamSchema);
 */

export const IdParamSchema = z.object({
  id: z.string().min(1, "id parameter is required"),
});

export const AgentIdParamSchema = z.object({
  agentId: z.string().min(1, "agentId parameter is required"),
});

export const TraceSpanParamSchema = z.object({
  traceId: z.string().min(1, "traceId parameter is required"),
  spanId: z.string().min(1, "spanId parameter is required"),
});

export const IdItemParamSchema = z.object({
  id: z.string().min(1, "id parameter is required"),
  itemId: z.string().min(1, "itemId parameter is required"),
});

export const IdLabelParamSchema = z.object({
  id: z.string().min(1, "id parameter is required"),
  label: z.string().min(1, "label parameter is required"),
});

export const OrgSlugParamSchema = z.object({
  orgSlug: z.string().min(1, "orgSlug parameter is required"),
});

/**
 * Parse and validate route params with a Zod schema.
 * Returns the validated params or sends a 400 response and returns null.
 */
export function parseParams<T extends z.ZodType>(
  request: FastifyRequest,
  reply: FastifyReply,
  schema: T,
): z.infer<T> | null {
  const result = schema.safeParse(request.params);
  if (!result.success) {
    void reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    return null;
  }
  return result.data;
}
