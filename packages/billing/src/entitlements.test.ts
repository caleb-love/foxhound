import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Plan } from "./entitlements.js";

vi.mock("@foxhound/db", () => ({
  getOrganizationById: vi.fn(),
}));

import * as db from "@foxhound/db";
import { getEntitlements, invalidateEntitlements } from "./entitlements.js";

function makeOrg(plan: Plan) {
  return {
    id: "org_1",
    name: "Test Org",
    slug: "test-org",
    plan,
    stripeCustomerId: null,
    retentionDays: 90,
    samplingRate: 1.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("getEntitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateEntitlements("org_1");
    invalidateEntitlements("org_pro");
    invalidateEntitlements("org_enterprise");
  });

  it("returns free plan limits for a free-tier org", async () => {
    vi.mocked(db.getOrganizationById).mockResolvedValue(makeOrg("free"));

    const e = await getEntitlements("org_1");

    expect(e.canReplay).toBe(false);
    expect(e.canRunDiff).toBe(false);
    expect(e.canAuditLog).toBe(false);
    expect(e.maxSpans).toBe(10_000);
    expect(e.maxProjects).toBe(1);
    expect(e.maxSeats).toBe(1);
    expect(e.retentionDays).toBe(7);
  });

  it("returns pro plan limits for a pro-tier org", async () => {
    vi.mocked(db.getOrganizationById).mockResolvedValue(makeOrg("pro"));

    const e = await getEntitlements("org_pro");

    expect(e.canReplay).toBe(true);
    expect(e.canRunDiff).toBe(true);
    expect(e.canAuditLog).toBe(false);
    expect(e.maxSpans).toBe(500_000);
    expect(e.retentionDays).toBe(90);
  });

  it("returns enterprise plan limits for an enterprise org", async () => {
    vi.mocked(db.getOrganizationById).mockResolvedValue(makeOrg("enterprise"));

    const e = await getEntitlements("org_enterprise");

    expect(e.canReplay).toBe(true);
    expect(e.canRunDiff).toBe(true);
    expect(e.canAuditLog).toBe(true);
    expect(e.maxSpans).toBe(-1);
    expect(e.retentionDays).toBe(365);
  });

  it("defaults to free limits when org not found", async () => {
    vi.mocked(db.getOrganizationById).mockResolvedValue(null);

    const e = await getEntitlements("org_1");

    expect(e.canReplay).toBe(false);
    expect(e.canRunDiff).toBe(false);
    expect(db.getOrganizationById).toHaveBeenCalledTimes(1);
  });

  it("caches entitlements and skips subsequent DB calls", async () => {
    vi.mocked(db.getOrganizationById).mockResolvedValue(makeOrg("pro"));

    await getEntitlements("org_pro");
    await getEntitlements("org_pro");
    await getEntitlements("org_pro");

    expect(db.getOrganizationById).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after cache invalidation", async () => {
    vi.mocked(db.getOrganizationById).mockResolvedValue(makeOrg("free"));

    await getEntitlements("org_1");
    invalidateEntitlements("org_1");

    vi.mocked(db.getOrganizationById).mockResolvedValue(makeOrg("pro"));
    const e = await getEntitlements("org_1");

    expect(db.getOrganizationById).toHaveBeenCalledTimes(2);
    expect(e.canReplay).toBe(true);
  });
});
