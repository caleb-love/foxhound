import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  createAnnotationQueue,
  listAnnotationQueues,
  getAnnotationQueue,
  getAnnotationQueueStats,
  deleteAnnotationQueue,
  addAnnotationQueueItems,
  claimAnnotationQueueItem,
  completeAnnotationQueueItem,
  skipAnnotationQueueItem,
  getAnnotationQueueItem,
  createScore,
  getTrace,
} from "@foxhound/db";

const ScoreConfigSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["numeric", "categorical"]),
  labels: z.array(z.string().max(50)).optional(),
});

const CreateAnnotationQueueSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  scoreConfigs: z.array(ScoreConfigSchema).max(10).optional(),
});

const AddItemsSchema = z.object({
  traceIds: z.array(z.string().min(1)).min(1).max(100),
});

const SubmitScoresSchema = z.object({
  scores: z.array(
    z.object({
      name: z.string().min(1).max(100),
      value: z.number().min(0).max(1).optional(),
      label: z.string().max(100).optional(),
      comment: z.string().max(2000).optional(),
    }),
  ),
});

export function annotationsRoutes(fastify: FastifyInstance): void {
  /**
   * POST /v1/annotation-queues
   * Create an annotation queue for human review workflows.
   */
  fastify.post(
    "/v1/annotation-queues",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
    const result = CreateAnnotationQueueSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const queue = await createAnnotationQueue({
      id: `anq_${randomUUID()}`,
      orgId: request.orgId,
      name: result.data.name,
      description: result.data.description,
      scoreConfigs: result.data.scoreConfigs,
    });

    return reply.code(201).send(queue);
  },
  );

  /**
   * GET /v1/annotation-queues
   * List all annotation queues for the authenticated org.
   */
  fastify.get("/v1/annotation-queues", async (request, reply) => {
    const rows = await listAnnotationQueues(request.orgId);
    return reply.code(200).send({ data: rows });
  });

  /**
   * GET /v1/annotation-queues/:id
   * Get an annotation queue with item counts.
   */
  fastify.get("/v1/annotation-queues/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const queue = await getAnnotationQueue(id, request.orgId);
    if (!queue) {
      return reply.code(404).send({ error: "Not Found", message: "Annotation queue not found" });
    }

    const stats = await getAnnotationQueueStats(id, request.orgId);
    return reply.code(200).send({ ...queue, stats });
  });

  /**
   * DELETE /v1/annotation-queues/:id
   * Delete an annotation queue and all its items.
   */
  fastify.delete("/v1/annotation-queues/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await deleteAnnotationQueue(id, request.orgId);
    if (!deleted) {
      return reply.code(404).send({ error: "Not Found", message: "Annotation queue not found" });
    }
    return reply.code(204).send();
  });

  /**
   * POST /v1/annotation-queues/:id/items
   * Add traces to an annotation queue for review.
   */
  fastify.post(
    "/v1/annotation-queues/:id/items",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = AddItemsSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const queue = await getAnnotationQueue(id, request.orgId);
    if (!queue) {
      return reply.code(404).send({ error: "Queue not found" });
    }

    // Verify all traces belong to this org
    const orgId = request.orgId;
    const traceChecks = await Promise.all(result.data.traceIds.map((tid) => getTrace(tid, orgId)));
    const missingTraces = result.data.traceIds.filter((_, i) => !traceChecks[i]);
    if (missingTraces.length > 0) {
      return reply.code(400).send({
        error: "Some traces not found",
        missingCount: missingTraces.length,
      });
    }

    const items = await addAnnotationQueueItems(
      { queueId: id, traceIds: result.data.traceIds },
      () => `aqi_${randomUUID()}`,
    );

    return reply.code(201).send({ added: items.length, items });
  },
  );

  /**
   * POST /v1/annotation-queues/:id/claim
   * Claim the next pending item in the queue for the current user.
   * Requires JWT auth (userId).
   */
  fastify.post(
    "/v1/annotation-queues/:id/claim",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!request.userId) {
      return reply.code(401).send({ error: "JWT auth required for claiming items" });
    }

    const queue = await getAnnotationQueue(id, request.orgId);
    if (!queue) {
      return reply.code(404).send({ error: "Queue not found" });
    }

    const item = await claimAnnotationQueueItem(id, request.orgId, request.userId);
    if (!item) {
      return reply.code(204).send();
    }

    return reply.code(200).send(item);
  },
  );

  /**
   * POST /v1/annotation-queue-items/:id/submit
   * Submit scores for an annotation queue item and mark it as completed.
   */
  fastify.post(
    "/v1/annotation-queue-items/:id/submit",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = SubmitScoresSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const orgId = request.orgId;
    const item = await getAnnotationQueueItem(id, orgId);
    if (!item) {
      return reply.code(404).send({ error: "Item not found" });
    }

    if (item.status !== "pending") {
      return reply.code(400).send({ error: `Item is already ${item.status}` });
    }

    // Create scores for each submitted score
    const createdScores = await Promise.all(
      result.data.scores.map((s) =>
        createScore({
          id: `scr_${randomUUID()}`,
          orgId,
          traceId: item.traceId,
          name: s.name,
          value: s.value,
          label: s.label,
          source: "manual",
          comment: s.comment,
          userId: request.userId,
        }),
      ),
    );

    await completeAnnotationQueueItem(id, orgId);

    return reply.code(200).send({
      item: { ...item, status: "completed" },
      scores: createdScores,
    });
  },
  );

  /**
   * POST /v1/annotation-queue-items/:id/skip
   * Skip an annotation queue item.
   */
  fastify.post(
    "/v1/annotation-queue-items/:id/skip",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
    const { id } = request.params as { id: string };
    const orgId = request.orgId;
    const item = await getAnnotationQueueItem(id, orgId);
    if (!item) {
      return reply.code(404).send({ error: "Item not found" });
    }

    if (item.status !== "pending") {
      return reply.code(400).send({ error: `Item is already ${item.status}` });
    }

    const updated = await skipAnnotationQueueItem(id, orgId);
    return reply.code(200).send(updated);
  },
  );
}
