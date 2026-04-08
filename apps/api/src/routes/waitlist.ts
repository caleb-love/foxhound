import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { z } from "zod";
import { insertWaitlistSignup } from "@foxhound/db";

const WaitlistSchema = z.object({
  email: z.string().email(),
});

export function waitlistRoutes(fastify: FastifyInstance): void {
  /**
   * POST /v1/waitlist
   * Sign up for the paid-plans waitlist.
   * Public endpoint — no authentication required.
   */
  fastify.post(
    "/v1/waitlist",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const result = WaitlistSchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const { email } = result.data;
      const { alreadyExists } = await insertWaitlistSignup(randomUUID(), email);

      return reply.code(200).send({ ok: true, alreadyExists });
    },
  );
}
