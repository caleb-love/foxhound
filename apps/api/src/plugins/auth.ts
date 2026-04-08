import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { resolveApiKey } from "@foxhound/db";

export interface JwtPayload {
  userId: string;
  orgId: string;
}

// Augment Fastify request with resolved auth context
declare module "fastify" {
  interface FastifyRequest {
    /** Resolved org ID — set by API key middleware or JWT auth */
    orgId: string;
    /** Resolved user ID — only set for JWT-authenticated requests */
    userId?: string;
  }
  interface FastifyInstance {
    /** Verify JWT and attach userId + orgId to request */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** Routes that are fully public (no auth required). */
const PUBLIC_PATHS = new Set([
  "/health",
  "/v1/auth/signup",
  "/v1/auth/login",
  "/v1/billing/webhooks",
  "/v1/sso/callback/saml",
  "/v1/sso/callback/oidc",
]);

/** Routes that start with these prefixes are public (dynamic segments). */
const PUBLIC_PREFIXES = ["/v1/sso/login/"];

/** Routes that require JWT auth instead of API key auth. */
function isJwtRoute(url: string): boolean {
  return (
    url === "/v1/auth/me" ||
    url.startsWith("/v1/api-keys") ||
    url.startsWith("/v1/billing") ||
    url.startsWith("/v1/sso/config") ||
    url.startsWith("/v1/sso/enforce")
  );
}

export function registerAuth(fastify: FastifyInstance): void {
  const jwtSecret = process.env["JWT_SECRET"];
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  // Register the JWT plugin
  void fastify.register(fastifyJwt, { secret: jwtSecret });

  // Decorate with a reusable authenticate handler for JWT-protected routes
  fastify.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        await request.jwtVerify();
        const payload = request.user as JwtPayload;
        request.orgId = payload.orgId;
        request.userId = payload.userId;
      } catch {
        return reply.code(401).send({ error: "Unauthorized", message: "Invalid or expired token" });
      }
    },
  );

  // Global onRequest hook — handles public routes and API key auth
  fastify.addHook("onRequest", async (request, reply) => {
    const url = request.url.split("?")[0]!;

    // Public routes skip auth entirely
    if (PUBLIC_PATHS.has(url)) return;
    if (PUBLIC_PREFIXES.some((p) => url.startsWith(p))) return;

    // JWT routes are handled per-route via the authenticate decorator
    if (isJwtRoute(url)) return;

    // All other /v1/* routes require a valid API key
    const auth = request.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return reply
        .code(401)
        .send({ error: "Unauthorized", message: "Missing or invalid Authorization header" });
    }

    const token = auth.slice(7);
    const resolved = await resolveApiKey(token);
    if (!resolved) {
      return reply.code(401).send({ error: "Unauthorized", message: "Invalid or revoked API key" });
    }

    request.orgId = resolved.org.id;
  });
}
