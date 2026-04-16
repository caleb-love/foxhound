import { describe, it, expect } from "vitest";
import { getBudgetPeriodKey, parsePeriodStart } from "./index.js";
import type { SegmentationQuery } from "./index.js";

// ---------------------------------------------------------------------------
// getBudgetPeriodKey
// ---------------------------------------------------------------------------

describe("getBudgetPeriodKey", () => {
  // 2026-04-10 is a Friday
  const timestampMs = Date.UTC(2026, 3, 10, 14, 30, 0); // 2026-04-10T14:30:00Z

  it("daily returns YYYY-MM-DD format", () => {
    const key = getBudgetPeriodKey("daily", timestampMs);
    expect(key).toBe("2026-04-10");
  });

  it("weekly returns YYYY-WNN format (ISO week)", () => {
    const key = getBudgetPeriodKey("weekly", timestampMs);
    // 2026-04-10 is in ISO week 15 (Monday 2026-04-06 to Sunday 2026-04-12)
    expect(key).toBe("2026-W15");
  });

  it("monthly returns YYYY-MM format", () => {
    const key = getBudgetPeriodKey("monthly", timestampMs);
    expect(key).toBe("2026-04");
  });

  it("unknown period defaults to monthly format", () => {
    const key = getBudgetPeriodKey("quarterly", timestampMs);
    expect(key).toBe("2026-04");
  });
});

// ---------------------------------------------------------------------------
// parsePeriodStart
// ---------------------------------------------------------------------------

describe("parsePeriodStart", () => {
  it("parses daily key to midnight UTC", () => {
    const ts = parsePeriodStart("2026-04-10");
    expect(ts).toBe(Date.UTC(2026, 3, 10, 0, 0, 0));
  });

  it("parses monthly key to first of month midnight UTC", () => {
    const ts = parsePeriodStart("2026-04");
    expect(ts).toBe(Date.UTC(2026, 3, 1, 0, 0, 0));
  });

  it("parses weekly key to correct Monday timestamp", () => {
    const ts = parsePeriodStart("2026-W15");
    // ISO week 15 of 2026 starts on Monday 2026-04-06
    const expected = Date.UTC(2026, 3, 6, 0, 0, 0);
    expect(ts).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Roundtrip
// ---------------------------------------------------------------------------

describe("getBudgetPeriodKey -> parsePeriodStart roundtrip", () => {
  it("roundtrips correctly for daily", () => {
    const timestampMs = Date.UTC(2026, 3, 10, 14, 30, 0);
    const key = getBudgetPeriodKey("daily", timestampMs);
    const start = parsePeriodStart(key);

    // parsePeriodStart should return midnight of the same day
    expect(start).toBe(Date.UTC(2026, 3, 10, 0, 0, 0));
    // And generating a key from the start should yield the same key
    expect(getBudgetPeriodKey("daily", start)).toBe(key);
  });

  it("roundtrips correctly for monthly", () => {
    const timestampMs = Date.UTC(2026, 3, 15, 8, 0, 0);
    const key = getBudgetPeriodKey("monthly", timestampMs);
    const start = parsePeriodStart(key);

    // parsePeriodStart should return first of month midnight
    expect(start).toBe(Date.UTC(2026, 3, 1, 0, 0, 0));
    // And generating a key from the start should yield the same key
    expect(getBudgetPeriodKey("monthly", start)).toBe(key);
  });
});

describe("SegmentationQuery", () => {
  it("accepts the shared filter shape used by dashboard surfaces", () => {
    const query: SegmentationQuery = {
      timeRange: {
        start: "2026-04-15T00:00:00.000Z",
        end: "2026-04-16T00:00:00.000Z",
      },
      status: "error",
      severity: "critical",
      agentIds: ["planner-agent"],
      promptIds: ["support-routing"],
      datasetIds: ["ds_1"],
      searchQuery: "refund",
    };

    expect(query.status).toBe("error");
    expect(query.timeRange?.start).toContain("2026-04-15");
    expect(query.agentIds).toEqual(["planner-agent"]);
  });
});
