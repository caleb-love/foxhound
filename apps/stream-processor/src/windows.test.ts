import { describe, it, expect } from "vitest";
import { RollingWindow } from "./windows.js";

describe("RollingWindow", () => {
  it("rejects non-positive window or bucket sizes", () => {
    expect(() => new RollingWindow<number>({ windowMs: 0, bucketMs: 1 })).toThrow();
    expect(() => new RollingWindow<number>({ windowMs: 1000, bucketMs: 0 })).toThrow();
    expect(() => new RollingWindow<number>({ windowMs: 100, bucketMs: 200 })).toThrow();
  });

  it("returns empty values for an unseen key", () => {
    const w = new RollingWindow<number>({ windowMs: 60_000, bucketMs: 1_000 });
    expect(w.values("missing", 1_000)).toEqual([]);
  });

  it("accumulates values within the same bucket", () => {
    const w = new RollingWindow<number>({ windowMs: 60_000, bucketMs: 1_000 });
    w.add("k", 1, 1_000);
    w.add("k", 2, 1_500);
    w.add("k", 3, 1_999);
    expect(w.values("k", 2_000)).toEqual([1, 2, 3]);
    expect(w.bucketCount()).toBe(1);
  });

  it("splits values into separate buckets when timestamps cross a boundary", () => {
    const w = new RollingWindow<number>({ windowMs: 60_000, bucketMs: 1_000 });
    w.add("k", 1, 1_000);
    w.add("k", 2, 2_000);
    w.add("k", 3, 3_000);
    expect(w.values("k", 3_500)).toEqual([1, 2, 3]);
    expect(w.bucketCount()).toBe(3);
  });

  it("evicts values older than windowMs from values()", () => {
    const w = new RollingWindow<number>({ windowMs: 5_000, bucketMs: 1_000 });
    w.add("k", 1, 1_000);
    w.add("k", 2, 3_000);
    w.add("k", 3, 10_000);
    // At now=10_500, cutoff = (10_500 - 5_000) / 1_000 = 5.5 → bucket 5
    // Bucket indices: 1, 3, 10. Only bucket 10 > 5 is in range.
    expect(w.values("k", 10_500)).toEqual([3]);
  });

  it("forEach visits only keys with items in-window", () => {
    const w = new RollingWindow<string>({ windowMs: 10_000, bucketMs: 1_000 });
    w.add("a", "x", 1_000);
    w.add("b", "y", 15_000);
    const seen = new Map<string, string[]>();
    w.forEach(15_500, (k, items) => seen.set(k, items));
    expect(seen.size).toBe(1);
    expect(seen.get("b")).toEqual(["y"]);
    expect(seen.has("a")).toBe(false);
  });

  it("prune removes fully-expired keys but preserves partially-live ones", () => {
    const w = new RollingWindow<number>({ windowMs: 5_000, bucketMs: 1_000 });
    w.add("stale", 1, 1_000);
    w.add("fresh", 2, 9_000);
    w.add("fresh", 3, 11_000);
    expect(w.size()).toBe(2);
    w.prune(12_000); // cutoff bucket = (12_000 - 5_000)/1_000 = 7
    expect(w.size()).toBe(1);
    expect(w.values("stale", 12_000)).toEqual([]);
    // "fresh" kept — bucket 9 > 7 is live; bucket 11 > 7 also live.
    expect(w.values("fresh", 12_000)).toEqual([2, 3]);
  });

  it("prune drops only the expired buckets on a mixed key", () => {
    const w = new RollingWindow<number>({ windowMs: 5_000, bucketMs: 1_000 });
    w.add("k", 1, 1_000); // bucket 1
    w.add("k", 2, 4_000); // bucket 4
    w.add("k", 3, 9_000); // bucket 9
    // At now=10_000, cutoff bucket = 5. Buckets 1 and 4 should be pruned.
    w.prune(10_000);
    expect(w.values("k", 10_000)).toEqual([3]);
    expect(w.bucketCount()).toBe(1);
  });

  it("memory bound: bucketCount tracks exactly active buckets", () => {
    const w = new RollingWindow<number>({ windowMs: 60_000, bucketMs: 5_000 });
    for (let i = 0; i < 20; i++) {
      w.add("k", i, i * 5_000);
    }
    // Without prune, up to 20 buckets accumulated.
    expect(w.bucketCount()).toBe(20);
    w.prune(20 * 5_000);
    // Window = 60s, bucketMs=5s → at most 12 live buckets. Cutoff bucket =
    // (100_000 - 60_000)/5_000 = 8, so buckets 9..19 = 11 alive.
    expect(w.bucketCount()).toBe(11);
  });
});
