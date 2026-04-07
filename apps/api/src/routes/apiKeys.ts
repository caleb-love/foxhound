import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createApiKey, listApiKeys, revokeApiKey, generateApiKey } from "@foxhound/db";

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
});

export async function apiKeysRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/api-keys
   * Create a new API key for the authenticated org.
   * Requires JWT. Returns the plaintext key once — it cannot be retrieved again.
   */
  fastify.post(
    "/v1/api-keys",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const result = CreateApiKeySchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const { name } = result.data;
      const { key, prefix, keyHash } = generateApiKey();

      const record = await createApiKey({
        id: `key_${randomUUID().replace(/-/g, "")}`,
        orgId: request.orgId,
        keyHash,
        prefix,
        name,
        createdByUserId: request.userId!,
      });

      return reply.code(201).send({
        id: record.id,
        name: record.name,
        prefix: record.prefix,
        createdAt: record.createdAt,
        // Return the plaintext key once — store it securely, it won't be shown again
        key,
      });
    },
  );

  /**
   * GET /v1/api-keys
   * List active API keys for the authenticated org.
   * Requires JWT. Never returns the plaintext key.
   */
  fastify.get(
    "/v1/api-keys",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const keys = await listApiKeys(request.orgId);
      return reply.code(200).send({ data: keys });
    },
  );

  /**
   * DELETE /v1/api-keys/:id
   * Revoke an API key. Requires JWT.
   */
  fastify.delete(
    "/v1/api-keys/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const revoked = await revokeApiKey(id, request.orgId);
      if (!revoked) {
        return reply
          .code(404)
          .send({ error: "Not Found", message: "API key not found or already revoked" });
      }
      return reply.code(200).send({ success: true });
    },
  );
}
