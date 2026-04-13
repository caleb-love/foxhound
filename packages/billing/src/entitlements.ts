import { getOrganizationById } from "@foxhound/db";

export interface Entitlements {
  canReplay: boolean;
  canRunDiff: boolean;
  canAuditLog: boolean;
  canEvaluate: boolean;
  canManagePrompts: boolean;
  maxSpans: number;
  maxProjects: number;
  maxSeats: number;
  retentionDays: number;
}

export type Plan = "free" | "pro" | "team" | "enterprise";

const PLAN_LIMITS: Record<Plan, Entitlements> = {
  free: {
    canReplay: true,
    canRunDiff: true,
    canAuditLog: false,
    canEvaluate: false,
    canManagePrompts: false,
    maxSpans: 100_000,
    maxProjects: -1,
    maxSeats: -1,
    retentionDays: 30,
  },
  pro: {
    canReplay: true,
    canRunDiff: true,
    canAuditLog: false,
    canEvaluate: true,
    canManagePrompts: true,
    maxSpans: 1_000_000,
    maxProjects: -1,
    maxSeats: -1,
    retentionDays: 365,
  },
  team: {
    canReplay: true,
    canRunDiff: true,
    canAuditLog: true,
    canEvaluate: true,
    canManagePrompts: true,
    maxSpans: 5_000_000,
    maxProjects: -1,
    maxSeats: -1,
    retentionDays: 730,
  },
  enterprise: {
    canReplay: true,
    canRunDiff: true,
    canAuditLog: true,
    canEvaluate: true,
    canManagePrompts: true,
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
