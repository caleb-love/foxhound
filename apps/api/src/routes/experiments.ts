import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  createExperiment,
  listExperiments,
  getExperiment,
  deleteExperiment,
  getDataset,
  listDatasetItems,
  createExperimentRuns,
  listExperimentRuns,
  getExperimentComparison,
} from "@foxhound/db";
import { getExperimentQueue } from "../queue.js";
import { trackPendoEvent } from "../lib/pendo.js";
import { parseParams, IdParamSchema } from "../lib/params.js";

const CreateExperimentSchema = z.object({
  datasetId: z.string().min(1),
  name: z.string().min(1).max(100),
  config: z.record(z.unknown()),
});

const ListExperimentsSchema = z.object({
  datasetId: z.string().optional(),
});

const ComparisonSchema = z.object({
  experiment_ids: z.string().min(1),
});

export function experimentsRoutes(fastify: FastifyInstance): void {
  // POST /v1/experiments — Create and enqueue experiment
  fastify.post(
    "/v1/experiments",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const result = CreateExperimentSchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const { datasetId, name, config } = result.data;
      const orgId = request.orgId;

      const dataset = await getDataset(datasetId, orgId);
      if (!dataset) {
        return reply.code(404).send({ error: "Dataset not found" });
      }

      const items = await listDatasetItems({ datasetId, orgId, limit: 10000 });
      if (items.length === 0) {
        return reply.code(400).send({ error: "Dataset has no items" });
      }

      const experiment = await createExperiment({
        id: `exp_${randomUUID()}`,
        orgId,
        datasetId,
        name,
        config,
      });

      const runs = await createExperimentRuns(
        items.map((item) => ({
          id: `exr_${randomUUID()}`,
          experimentId: experiment.id,
          datasetItemId: item.id,
        })),
      );

      const queue = getExperimentQueue();
      if (queue) {
        await queue.add(
          "run-experiment",
          { experimentId: experiment.id, orgId },
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        );
      }

      trackPendoEvent({
        event: "experiment_created",
        visitorId: request.userId ?? "system",
        accountId: orgId,
        properties: {
          experimentId: experiment.id,
          datasetId,
          name,
          runCount: runs.length,
        },
      });

      return reply.code(202).send({
        experiment,
        runCount: runs.length,
        message: `Experiment queued with ${runs.length} run(s)`,
      });
    },
  );

  // GET /v1/experiments — List experiments
  fastify.get("/v1/experiments", async (request, reply) => {
    const result = ListExperimentsSchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const rows = await listExperiments(request.orgId, result.data.datasetId);
    return reply.code(200).send({ data: rows });
  });

  // GET /v1/experiments/:id — Get experiment with runs
  fastify.get("/v1/experiments/:id", async (request, reply) => {
    const p = parseParams(request, reply, IdParamSchema);
    if (!p) return;
    const { id } = p;
    const experiment = await getExperiment(id, request.orgId);
    if (!experiment) {
      return reply.code(404).send({ error: "Not Found", message: "Experiment not found" });
    }

    const runs = await listExperimentRuns(id, request.orgId);
    return reply.code(200).send({ ...experiment, runs });
  });

  // DELETE /v1/experiments/:id — Delete experiment and runs
  fastify.delete("/v1/experiments/:id", async (request, reply) => {
    const p = parseParams(request, reply, IdParamSchema);
    if (!p) return;
    const { id } = p;
    const deleted = await deleteExperiment(id, request.orgId);
    if (!deleted) {
      return reply.code(404).send({ error: "Not Found", message: "Experiment not found" });
    }
    return reply.code(204).send();
  });

  // GET /v1/experiment-comparisons — Side-by-side comparison
  fastify.get("/v1/experiment-comparisons", async (request, reply) => {
    const result = ComparisonSchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({ error: "experiment_ids query parameter is required" });
    }

    const experimentIds = result.data.experiment_ids.split(",").filter(Boolean);
    if (experimentIds.length < 2) {
      return reply.code(400).send({ error: "At least 2 experiment IDs required for comparison" });
    }

    const comparison = await getExperimentComparison(experimentIds, request.orgId);
    if (!comparison) {
      return reply.code(404).send({ error: "One or more experiments not found" });
    }

    trackPendoEvent({
      event: "experiment_comparison_viewed",
      visitorId: request.userId ?? "system",
      accountId: request.orgId,
      properties: {
        experimentCount: experimentIds.length,
      },
    });

    return reply.code(200).send(comparison);
  });
}
