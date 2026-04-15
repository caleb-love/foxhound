import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  generateApiKey,
  writeAuditLog,
} from "@foxhound/db";
import { trackPendoEvent } from "../lib/pendo.js";

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  /** Optional expiration date (ISO 8601). Keys past this date are rejected at auth time. */
  expiresAt: z.coerce
    .date()
    .refine((d) => d > new Date(), {
      message: "expiresAt must be in the future",
    })
    .optional(),
  // NOTE: scopes column exists in DB but is NOT user-settable until scope enforcement
  // is implemented in Sprint H4. Accepting scopes here without enforcement creates
  // a false sense of security. See hardening plan H4 / security review.
});

export function apiKeysRoutes(fastify: FastifyInstance): void {
  /**
   * POST /v1/api-keys
   * Create a new API key for the authenticated org.
   * Requires JWT. Returns the plaintext key once — it cannot be retrieved again.
   */
  fastify.post("/v1/api-keys", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = CreateApiKeySchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const { name, expiresAt } = result.data;
    const { key, prefix, keyHash } = generateApiKey();

    const record = await createApiKey({
      id: `key_${randomUUID().replace(/-/g, "")}`,
      orgId: request.orgId,
      keyHash,
      prefix,
      name,
      createdByUserId: request.userId!,
      expiresAt: expiresAt ?? null,
    });

    trackPendoEvent({
      event: "api_key_created",
      visitorId: request.userId ?? "system",
      accountId: request.orgId,
      properties: {
        keyName: name,
        keyPrefix: prefix,
        hasExpiry: !!expiresAt,
      },
      context: { ip: request.ip },
    });

    // Audit: API key creation
    writeAuditLog({
      orgId: request.orgId,
      actorUserId: request.userId,
      action: "api_key.create",
      targetType: "api_key",
      targetId: record.id,
      metadata: { keyName: name, keyPrefix: prefix },
      ipAddress: request.ip,
    }).catch((err) => {
      request.log.error({ err, action: "api_key.create" }, "Audit log write failed");
    });

    return reply.code(201).send({
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      // Return the plaintext key once — store it securely, it won't be shown again
      key,
    });
  });

  /**
   * GET /v1/api-keys
   * List active API keys for the authenticated org.
   * Requires JWT. Never returns the plaintext key.
   */
  fastify.get("/v1/api-keys", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const keys = await listApiKeys(request.orgId);
    return reply.code(200).send({ data: keys });
  });

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

      trackPendoEvent({
        event: "api_key_revoked",
        visitorId: request.userId ?? "system",
        accountId: request.orgId,
        properties: {
          keyId: id,
        },
        context: { ip: request.ip },
      });

      // Audit: API key revocation
      writeAuditLog({
        orgId: request.orgId,
        actorUserId: request.userId,
        action: "api_key.revoke",
        targetType: "api_key",
        targetId: id,
        ipAddress: request.ip,
      }).catch((err) => {
        request.log.error({ err, action: "api_key.revoke" }, "Audit log write failed");
      });

      return reply.code(200).send({ success: true });
    },
  );
}
