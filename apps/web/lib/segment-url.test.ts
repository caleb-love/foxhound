import { describe, expect, it } from "vitest";
import { readSegmentFromSearchParams, upsertSegmentInUrl } from "./segment-url";

describe("segment-url", () => {
  it("reads the active segment from search params", () => {
    expect(readSegmentFromSearchParams("segment=Planner%20agent")).toBe("Planner agent");
  });

  it("adds or replaces segment in url", () => {
    expect(upsertSegmentInUrl("/traces", "Planner agent")).toBe("/traces?segment=Planner+agent");
    expect(upsertSegmentInUrl("/traces?foo=bar", "Planner agent")).toBe(
      "/traces?foo=bar&segment=Planner+agent",
    );
  });

  it("removes segment for all traffic", () => {
    expect(upsertSegmentInUrl("/traces?segment=Planner+agent&foo=bar", null)).toBe(
      "/traces?foo=bar",
    );
    expect(upsertSegmentInUrl("/traces?segment=Planner+agent", "All traffic")).toBe("/traces");
  });
});
