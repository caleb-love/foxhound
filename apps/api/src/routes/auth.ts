import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  getUserByEmail,
  getUserById,
  getMembershipsByUser,
  signup,
  hashPassword,
  verifyPassword,
} from "@foxhound/db";
import type { JwtPayload } from "../plugins/auth.js";

const SignupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  orgName: z.string().min(1).max(100),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Derive a URL-safe slug from an org name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/auth/signup
   * Create a new user + org. Returns a JWT.
   */
  fastify.post("/v1/auth/signup", async (request, reply) => {
    const result = SignupSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const { name, email, password, orgName } = result.data;

    const existing = await getUserByEmail(email);
    if (existing) {
      return reply.code(409).send({ error: "Conflict", message: "Email already registered" });
    }

    const userId = `usr_${randomUUID().replace(/-/g, "")}`;
    const orgId = `org_${randomUUID().replace(/-/g, "")}`;
    const orgSlug = slugify(orgName);
    const passwordHash = hashPassword(password);

    const { org, user } = await signup({ userId, orgId, orgName, orgSlug, email, passwordHash, name });

    const payload: JwtPayload = { userId: user.id, orgId: org.id };
    const token = fastify.jwt.sign(payload, { expiresIn: "30d" });

    return reply.code(201).send({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      org: { id: org.id, name: org.name, slug: org.slug },
    });
  });

  /**
   * POST /v1/auth/login
   * Authenticate with email + password. Returns a JWT.
   */
  fastify.post("/v1/auth/login", async (request, reply) => {
    const result = LoginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const { email, password } = result.data;

    const user = await getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return reply.code(401).send({ error: "Unauthorized", message: "Invalid email or password" });
    }

    const memberships = await getMembershipsByUser(user.id);
    if (memberships.length === 0) {
      return reply.code(403).send({ error: "Forbidden", message: "No org membership found" });
    }

    // Use the first org (owner membership preferred)
    const primary =
      memberships.find((m) => m.role === "owner") ?? memberships[0]!;

    const payload: JwtPayload = { userId: user.id, orgId: primary.org.id };
    const token = fastify.jwt.sign(payload, { expiresIn: "30d" });

    return reply.code(200).send({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      org: { id: primary.org.id, name: primary.org.name, slug: primary.org.slug },
    });
  });

  /**
   * GET /v1/auth/me
   * Return current user + org info. Requires JWT.
   */
  fastify.get(
    "/v1/auth/me",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = await getUserById(request.userId!);
      if (!user) {
        return reply.code(404).send({ error: "Not Found", message: "User not found" });
      }

      const memberships = await getMembershipsByUser(user.id);
      const currentOrg = memberships.find((m) => m.org.id === request.orgId);

      return reply.code(200).send({
        user: { id: user.id, email: user.email, name: user.name },
        org: currentOrg
          ? { id: currentOrg.org.id, name: currentOrg.org.name, slug: currentOrg.org.slug }
          : null,
        role: currentOrg?.role ?? null,
      });
    },
  );
}
