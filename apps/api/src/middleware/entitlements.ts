import type { FastifyRequest, FastifyReply } from "fastify";
import type { Entitlements } from "@foxhound/billing";

type BooleanEntitlementKey = {
  [K in keyof Entitlements]: Entitlements[K] extends boolean ? K : never;
}[keyof Entitlements];

/**
 * Returns a Fastify preHandler that gates the route on a boolean entitlement.
 * Self-hosted open-source mode: all features are available to all users.
 * This is a pass-through — no plan checks are performed.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function requireEntitlement(_feature: BooleanEntitlementKey) {
  return async (_request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // Pass-through: all entitlements granted for self-hosted deployments.
  };
}
