import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  createEvaluator,
  listEvaluators,
  getEvaluator,
  updateEvaluator,
  deleteEvaluator,
  createEvaluatorRuns,
  getEvaluatorRunForOrg,
  getTrace,
  isLlmEvaluationEnabled,
  writeAuditLog,
} from "@foxhound/db";
import { requireEntitlement } from "../middleware/entitlements.js";
import { getEvaluatorQueue } from "../queue.js";

const CreateEvaluatorSchema = z.object({
  name: z.string().min(1).max(100),
  promptTemplate: z.string().min(1).max(10000),
  model: z.string().min(1).max(100),
  scoringType: z.enum(["numeric", "categorical"]),
  labels: z.array(z.string().max(50)).max(20).optional(),
});

const UpdateEvaluatorSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  promptTemplate: z.string().min(1).max(10000).optional(),
  model: z.string().min(1).max(100).optional(),
  scoringType: z.enum(["numeric", "categorical"]).optional(),
  labels: z.array(z.string().max(50)).max(20).optional(),
  enabled: z.boolean().optional(),
});

const TriggerEvaluatorRunsSchema = z.object({
  evaluatorId: z.string().min(1),
  traceIds: z.array(z.string().min(1)).min(1).max(100),
});

export function evaluatorsRoutes(fastify: FastifyInstance): void {
  /**
   * POST /v1/evaluators
   * Create an evaluator template (LLM-as-a-Judge configuration).
   * Requires canEvaluate entitlement (Pro+).
   */
  fastify.post(
    "/v1/evaluators",
    { preHandler: [requireEntitlement("canEvaluate")] },
    async (request, reply) => {
      const result = CreateEvaluatorSchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const { name, promptTemplate, model, scoringType, labels } = result.data;

      if (scoringType === "categorical" && (!labels || labels.length === 0)) {
        return reply.code(400).send({ error: "Categorical evaluators require at least one label" });
      }

      const evaluator = await createEvaluator({
        id: `evl_${randomUUID()}`,
        orgId: request.orgId,
        name,
        promptTemplate,
        model,
        scoringType,
        labels,
      });

      // Audit: evaluator creation
      writeAuditLog({
        orgId: request.orgId,
        action: "evaluator.create",
        targetType: "evaluator",
        targetId: evaluator.id,
        metadata: { name, model, scoringType },
        ipAddress: request.ip,
      }).catch((err) => {
        request.log.error({ err, action: "evaluator.create" }, "Audit log write failed");
      });

      return reply.code(201).send(evaluator);
    },
  );

  /**
   * GET /v1/evaluators
   * List all evaluators for the authenticated org.
   */
  fastify.get(
    "/v1/evaluators",
    { preHandler: [requireEntitlement("canEvaluate")] },
    async (request, reply) => {
      const rows = await listEvaluators(request.orgId);
      return reply.code(200).send({ data: rows });
    },
  );

  /**
   * GET /v1/evaluators/:id
   * Get a single evaluator by ID.
   */
  fastify.get(
    "/v1/evaluators/:id",
    { preHandler: [requireEntitlement("canEvaluate")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const evaluator = await getEvaluator(id, request.orgId);
      if (!evaluator) {
        return reply.code(404).send({ error: "Not Found", message: "Evaluator not found" });
      }
      return reply.code(200).send(evaluator);
    },
  );

  /**
   * PATCH /v1/evaluators/:id
   * Update an evaluator template.
   */
  fastify.patch(
    "/v1/evaluators/:id",
    { preHandler: [requireEntitlement("canEvaluate")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = UpdateEvaluatorSchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const updated = await updateEvaluator(id, request.orgId, result.data);
      if (!updated) {
        return reply.code(404).send({ error: "Not Found", message: "Evaluator not found" });
      }

      // Audit: evaluator update (security-relevant: prompt/model changes)
      writeAuditLog({
        orgId: request.orgId,
        action: "evaluator.update",
        targetType: "evaluator",
        targetId: id,
        metadata: { updatedFields: Object.keys(result.data) },
        ipAddress: request.ip,
      }).catch((err) => {
        request.log.error({ err, action: "evaluator.update" }, "Audit log write failed");
      });

      return reply.code(200).send(updated);
    },
  );

  /**
   * DELETE /v1/evaluators/:id
   * Delete an evaluator template.
   */
  fastify.delete(
    "/v1/evaluators/:id",
    { preHandler: [requireEntitlement("canEvaluate")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await deleteEvaluator(id, request.orgId);
      if (!deleted) {
        return reply.code(404).send({ error: "Not Found", message: "Evaluator not found" });
      }

      // Audit: evaluator deletion
      writeAuditLog({
        orgId: request.orgId,
        action: "evaluator.delete",
        targetType: "evaluator",
        targetId: id,
        ipAddress: request.ip,
      }).catch((err) => {
        request.log.error({ err, action: "evaluator.delete" }, "Audit log write failed");
      });

      return reply.code(204).send();
    },
  );

  /**
   * POST /v1/evaluator-runs
   * Trigger batch evaluation: creates pending runs for each trace.
   * The worker process picks these up asynchronously.
   */
  fastify.post(
    "/v1/evaluator-runs",
    { preHandler: [requireEntitlement("canEvaluate")] },
    async (request, reply) => {
      const result = TriggerEvaluatorRunsSchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const { evaluatorId, traceIds } = result.data;
      const orgId = request.orgId;

      // Consent gate: org must opt in to sending trace data to LLM providers
      const consentEnabled = await isLlmEvaluationEnabled(orgId);
      if (!consentEnabled) {
        return reply.code(403).send({
          error: "Forbidden",
          message:
            "Your organization has not enabled LLM-based evaluation. " +
            "Enabling this feature will send trace data to third-party LLM providers. " +
            "Enable it in your organization settings to proceed.",
        });
      }

      // Verify evaluator belongs to this org
      const evaluator = await getEvaluator(evaluatorId, orgId);
      if (!evaluator) {
        return reply.code(404).send({ error: "Not Found", message: "Evaluator not found" });
      }

      if (!evaluator.enabled) {
        return reply.code(400).send({ error: "Bad Request", message: "Evaluator is disabled" });
      }

      // Verify all traces belong to this org
      const traceChecks = await Promise.all(traceIds.map((id) => getTrace(id, orgId)));
      const missingTraces = traceIds.filter((_, i) => !traceChecks[i]);
      if (missingTraces.length > 0) {
        return reply.code(400).send({
          error: "Some traces not found",
          missingCount: missingTraces.length,
        });
      }

      const runs = await createEvaluatorRuns(
        traceIds.map((traceId) => ({
          id: `evr_${randomUUID()}`,
          evaluatorId,
          traceId,
        })),
      );

      // Enqueue BullMQ jobs for the worker to process
      const queue = getEvaluatorQueue();
      if (queue) {
        await Promise.all(
          runs.map((r) =>
            queue.add(
              "evaluate",
              { runId: r.id },
              {
                attempts: 3,
                backoff: { type: "exponential", delay: 5000 },
                removeOnComplete: 100,
                removeOnFail: 500,
              },
            ),
          ),
        );
      }

      return reply.code(202).send({
        message: `${runs.length} evaluation run(s) queued`,
        runs: runs.map((r) => ({ id: r.id, traceId: r.traceId, status: r.status })),
      });
    },
  );

  /**
   * GET /v1/evaluator-runs/:id
   * Check the status of an evaluator run.
   */
  fastify.get(
    "/v1/evaluator-runs/:id",
    { preHandler: [requireEntitlement("canEvaluate")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const run = await getEvaluatorRunForOrg(id, request.orgId);
      if (!run) {
        return reply.code(404).send({ error: "Not Found", message: "Evaluator run not found" });
      }
      return reply.code(200).send(run);
    },
  );
}
