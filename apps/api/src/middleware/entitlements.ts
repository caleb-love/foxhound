import type { FastifyRequest, FastifyReply } from "fastify";
import { getEntitlements } from "@foxhound/billing";
import type { Entitlements } from "@foxhound/billing";

type BooleanEntitlementKey = {
  [K in keyof Entitlements]: Entitlements[K] extends boolean ? K : never;
}[keyof Entitlements];

const FEATURE_LABELS: Record<BooleanEntitlementKey, string> = {
  canReplay: "replay",
  canRunDiff: "run_diff",
  canAuditLog: "audit_log",
};

/**
 * Returns a Fastify preHandler that gates the route on a boolean entitlement.
 * Returns 403 with upgrade_required if the org's plan doesn't allow the feature.
 */
export function requireEntitlement(feature: BooleanEntitlementKey) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const entitlements = await getEntitlements(request.orgId);
    if (!entitlements[feature]) {
      return reply.code(403).send({
        error: "upgrade_required",
        feature: FEATURE_LABELS[feature],
        upgradeUrl: "/pricing",
      });
    }
  };
}
