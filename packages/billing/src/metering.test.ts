import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@foxhound/db", () => ({
  getUsageForPeriod: vi.fn(),
  upsertUsageRecord: vi.fn(),
}));

vi.mock("./entitlements.js", () => ({
  getEntitlements: vi.fn(),
}));

import * as db from "@foxhound/db";
import * as entitlementsMod from "./entitlements.js";
import {
  checkSpanLimit,
  incrementSpanCount,
  currentBillingPeriod,
  periodBounds,
} from "./metering.js";

function mockEntitlements(maxSpans: number) {
  vi.mocked(entitlementsMod.getEntitlements).mockResolvedValue({
    canReplay: true,
    canRunDiff: true,
    canAuditLog: false,
    maxSpans,
    maxProjects: -1,
    maxSeats: -1,
    retentionDays: 30,
  });
}

function mockUsage(spanCount: number | null) {
  vi.mocked(db.getUsageForPeriod).mockResolvedValue(
    spanCount === null
      ? null
      : ({ orgId: "org_1", period: "2026-04", spanCount, updatedAt: new Date() } as never),
  );
}

describe("currentBillingPeriod", () => {
  it("returns YYYY-MM format", () => {
    const period = currentBillingPeriod();
    expect(period).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("periodBounds", () => {
  it("returns correct start and end for January", () => {
    const { periodStart, periodEnd } = periodBounds("2026-01");
    expect(periodStart).toBe("2026-01-01");
    expect(periodEnd).toBe("2026-01-31");
  });

  it("returns correct start and end for April", () => {
    const { periodStart, periodEnd } = periodBounds("2026-04");
    expect(periodStart).toBe("2026-04-01");
    expect(periodEnd).toBe("2026-04-30");
  });

  it("handles February correctly", () => {
    const { periodStart, periodEnd } = periodBounds("2024-02");
    expect(periodStart).toBe("2024-02-01");
    expect(periodEnd).toBe("2024-02-29");
  });
});

describe("checkSpanLimit — free tier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntitlements(100_000);
  });

  it("allows ingestion when under limit", async () => {
    mockUsage(50_000);
    const check = await checkSpanLimit("org_1", 1_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(false);
    expect(check.spansUsed).toBe(50_000);
    expect(check.spansLimit).toBe(100_000);
  });

  it("allows ingestion exactly at limit boundary", async () => {
    mockUsage(50_000);
    const check = await checkSpanLimit("org_1", 50_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(false);
  });

  it("blocks ingestion when it would exceed limit", async () => {
    mockUsage(99_000);
    const check = await checkSpanLimit("org_1", 2_000);
    expect(check.allowed).toBe(false);
    expect(check.isOverage).toBe(true);
  });

  it("blocks when already at limit", async () => {
    mockUsage(100_000);
    const check = await checkSpanLimit("org_1", 1);
    expect(check.allowed).toBe(false);
    expect(check.isOverage).toBe(true);
  });

  it("allows when no usage record exists yet", async () => {
    mockUsage(null);
    const check = await checkSpanLimit("org_1", 100);
    expect(check.allowed).toBe(true);
    expect(check.spansUsed).toBe(0);
  });
});

describe("checkSpanLimit — pro tier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntitlements(1_000_000);
  });

  it("allows ingestion under pro limit without overage", async () => {
    mockUsage(500_000);
    const check = await checkSpanLimit("org_1", 1_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(false);
  });

  it("allows ingestion that would exceed pro limit (overage — not hard blocked)", async () => {
    mockUsage(999_000);
    const check = await checkSpanLimit("org_1", 5_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(true);
  });

  it("allows ingestion well past pro limit and flags overage", async () => {
    mockUsage(1_200_000);
    const check = await checkSpanLimit("org_1", 1_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(true);
  });
});

describe("checkSpanLimit — team tier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntitlements(5_000_000);
  });

  it("allows ingestion under team limit", async () => {
    mockUsage(2_000_000);
    const check = await checkSpanLimit("org_1", 10_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(false);
  });

  it("allows overage without hard block", async () => {
    mockUsage(4_999_000);
    const check = await checkSpanLimit("org_1", 5_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(true);
  });
});

describe("checkSpanLimit — enterprise tier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntitlements(-1);
  });

  it("always allows ingestion regardless of usage", async () => {
    mockUsage(999_999_999);
    const check = await checkSpanLimit("org_1", 1_000_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(false);
    expect(check.spansLimit).toBe(-1);
  });
});

describe("incrementSpanCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.upsertUsageRecord).mockResolvedValue({} as never);
  });

  it("calls upsertUsageRecord with orgId, current period, and count", async () => {
    await incrementSpanCount("org_1", 42);
    expect(db.upsertUsageRecord).toHaveBeenCalledWith("org_1", currentBillingPeriod(), 42);
  });

  it("uses the correct period", async () => {
    await incrementSpanCount("org_2", 100);
    const period = currentBillingPeriod();
    expect(db.upsertUsageRecord).toHaveBeenCalledWith("org_2", period, 100);
  });
});
