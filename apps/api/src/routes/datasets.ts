import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  createDataset,
  listDatasets,
  getDataset,
  deleteDataset,
  createDatasetItem,
  createDatasetItems,
  listDatasetItems,
  getDatasetItem,
  deleteDatasetItem,
  countDatasetItems,
  getTracesForDatasetCuration,
} from "@foxhound/db";

const CreateDatasetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
});

const CreateDatasetItemSchema = z.object({
  input: z.record(z.unknown()),
  expectedOutput: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  sourceTraceId: z.string().optional(),
});

const ListDatasetItemsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const FromTracesSchema = z.object({
  scoreName: z.string().min(1),
  scoreOperator: z.enum(["lt", "gt", "lte", "gte"]),
  scoreThreshold: z.number(),
  sinceDays: z.number().int().positive().max(365).optional(),
  limit: z.number().int().positive().max(500).default(100),
});

export function datasetsRoutes(fastify: FastifyInstance): void {
  // POST /v1/datasets — Create a new dataset
  fastify.post("/v1/datasets", async (request, reply) => {
    const result = CreateDatasetSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const dataset = await createDataset({
      id: `ds_${randomUUID()}`,
      orgId: request.orgId,
      name: result.data.name,
      description: result.data.description,
    });

    return reply.code(201).send(dataset);
  });

  // GET /v1/datasets — List all datasets for the org
  fastify.get("/v1/datasets", async (request, reply) => {
    const rows = await listDatasets(request.orgId);
    return reply.code(200).send({ data: rows });
  });

  // GET /v1/datasets/:id — Get a single dataset with item count
  fastify.get("/v1/datasets/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const dataset = await getDataset(id, request.orgId);
    if (!dataset) {
      return reply.code(404).send({ error: "Not Found" });
    }
    const itemCount = await countDatasetItems(id);
    return reply.code(200).send({ ...dataset, itemCount });
  });

  // DELETE /v1/datasets/:id — Delete a dataset and all its items
  fastify.delete("/v1/datasets/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await deleteDataset(id, request.orgId);
    if (!deleted) {
      return reply.code(404).send({ error: "Not Found" });
    }
    return reply.code(204).send();
  });

  // POST /v1/datasets/:id/items — Add a single item to a dataset
  fastify.post("/v1/datasets/:id/items", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = CreateDatasetItemSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const dataset = await getDataset(id, request.orgId);
    if (!dataset) {
      return reply.code(404).send({ error: "Dataset not found" });
    }

    const item = await createDatasetItem({
      id: `dsi_${randomUUID()}`,
      datasetId: id,
      input: result.data.input,
      expectedOutput: result.data.expectedOutput,
      metadata: result.data.metadata,
      sourceTraceId: result.data.sourceTraceId,
    });

    return reply.code(201).send(item);
  });

  // GET /v1/datasets/:id/items — List items in a dataset with pagination
  fastify.get("/v1/datasets/:id/items", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = ListDatasetItemsSchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const dataset = await getDataset(id, request.orgId);
    if (!dataset) {
      return reply.code(404).send({ error: "Dataset not found" });
    }

    const rows = await listDatasetItems({
      datasetId: id,
      page: result.data.page,
      limit: result.data.limit,
    });

    return reply.code(200).send({
      data: rows,
      pagination: { page: result.data.page, limit: result.data.limit, count: rows.length },
    });
  });

  // DELETE /v1/datasets/:id/items/:itemId — Delete a single item
  fastify.delete("/v1/datasets/:id/items/:itemId", async (request, reply) => {
    const { id, itemId } = request.params as { id: string; itemId: string };

    const dataset = await getDataset(id, request.orgId);
    if (!dataset) {
      return reply.code(404).send({ error: "Dataset not found" });
    }

    const item = await getDatasetItem(itemId);
    if (!item || item.datasetId !== id) {
      return reply.code(404).send({ error: "Not Found" });
    }

    await deleteDatasetItem(itemId);
    return reply.code(204).send();
  });

  // POST /v1/datasets/:id/items/from-traces — Auto-curate from production traces
  fastify.post("/v1/datasets/:id/items/from-traces", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = FromTracesSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const dataset = await getDataset(id, request.orgId);
    if (!dataset) {
      return reply.code(404).send({ error: "Dataset not found" });
    }

    const { scoreName, scoreOperator, scoreThreshold, sinceDays, limit } = result.data;

    const since = sinceDays
      ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
      : undefined;

    const traceResults = await getTracesForDatasetCuration({
      orgId: request.orgId,
      scoreName,
      scoreOperator,
      scoreThreshold,
      since,
      limit,
    });

    if (traceResults.length === 0) {
      return reply.code(201).send({ added: 0, items: [] });
    }

    const itemInputs = traceResults.map(({ trace, spans }) => {
      const firstSpan = spans[0];
      const lastSpan = spans[spans.length - 1];
      const input = firstSpan?.attributes?.["input"] ?? firstSpan?.attributes ?? {};
      const output = lastSpan?.attributes?.["output"] ?? lastSpan?.attributes ?? {};

      return {
        id: `dsi_${randomUUID()}`,
        datasetId: id,
        input: typeof input === "object" ? (input as Record<string, unknown>) : { value: input },
        expectedOutput: typeof output === "object"
          ? (output as Record<string, unknown>)
          : { value: output },
        metadata: trace.metadata,
        sourceTraceId: trace.id,
      };
    });

    const items = await createDatasetItems(itemInputs);

    return reply.code(201).send({ added: items.length, items });
  });
}
