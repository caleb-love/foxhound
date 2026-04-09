import type { FastifyRequest, FastifyReply } from "fastify";
import type { Entitlements } from "@foxhound/billing";
import { getEntitlements } from "@foxhound/billing";

type BooleanEntitlementKey = {
  [K in keyof Entitlements]: Entitlements[K] extends boolean ? K : never;
}[keyof Entitlements];

/**
 * Returns a Fastify preHandler that gates the route on a boolean entitlement.
 * Self-hosted: pass-through (all features available).
 * Cloud (FOXHOUND_CLOUD=1): checks the org's plan entitlements.
 */
export function requireEntitlement(feature: BooleanEntitlementKey) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!process.env["FOXHOUND_CLOUD"]) return;

    const entitlements = await getEntitlements(request.orgId);
    if (!entitlements[feature]) {
      return reply.code(403).send({
        error: "Forbidden",
        message: `Your plan does not include the "${feature}" feature. Upgrade at /billing.`,
      });
    }
  };
}
