import type { FastifyInstance } from "fastify";

/**
 * Registers a global API key auth hook on the Fastify instance.
 * All routes except /health require a valid Bearer token.
 *
 * Configure valid keys via FOX_API_KEYS (comma-separated) or FOX_API_KEY.
 * If no keys are configured the server accepts any Bearer token (dev mode).
 */
export function registerAuth(fastify: FastifyInstance): void {
  const rawKeys = process.env["FOX_API_KEYS"] ?? process.env["FOX_API_KEY"] ?? "";
  const validKeys = rawKeys
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  fastify.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health") return;

    const auth = request.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return reply
        .code(401)
        .send({ error: "Unauthorized", message: "Missing or invalid Authorization header" });
    }

    const token = auth.slice(7);
    if (validKeys.length > 0 && !validKeys.includes(token)) {
      return reply.code(401).send({ error: "Unauthorized", message: "Invalid API key" });
    }
  });
}
