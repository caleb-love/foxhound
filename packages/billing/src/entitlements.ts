import { getOrganizationById } from "@foxhound/db";

export interface Entitlements {
  canReplay: boolean;
  canRunDiff: boolean;
  canAuditLog: boolean;
  maxSpans: number;
  maxProjects: number;
  maxSeats: number;
  retentionDays: number;
}

export type Plan = "free" | "pro" | "enterprise";

const PLAN_LIMITS: Record<Plan, Entitlements> = {
  free: {
    canReplay: false,
    canRunDiff: false,
    canAuditLog: false,
    maxSpans: 10_000,
    maxProjects: 1,
    maxSeats: 1,
    retentionDays: 7,
  },
  pro: {
    canReplay: true,
    canRunDiff: true,
    canAuditLog: false,
    maxSpans: 500_000,
    maxProjects: 10,
    maxSeats: 5,
    retentionDays: 90,
  },
  enterprise: {
    canReplay: true,
    canRunDiff: true,
    canAuditLog: true,
    maxSpans: -1,
    maxProjects: -1,
    maxSeats: -1,
    retentionDays: 365,
  },
};

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  entitlements: Entitlements;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function invalidateEntitlements(orgId: string): void {
  cache.delete(orgId);
}

export async function getEntitlements(orgId: string): Promise<Entitlements> {
  const now = Date.now();
  const cached = cache.get(orgId);
  if (cached && cached.expiresAt > now) {
    return cached.entitlements;
  }

  const org = await getOrganizationById(orgId);
  const plan = (org?.plan ?? "free") as Plan;
  const entitlements = PLAN_LIMITS[plan] ?? PLAN_LIMITS["free"];

  cache.set(orgId, { entitlements, expiresAt: now + CACHE_TTL_MS });
  return entitlements;
}
