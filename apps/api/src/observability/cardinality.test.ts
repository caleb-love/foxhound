import { describe, it, expect } from "vitest";
import { createBoundedLabels } from "./cardinality.js";

describe("observability · BoundedLabels", () => {
  it("preserves raw labels up to the cap", () => {
    const b = createBoundedLabels({ maxLabels: 3 });
    expect(b.resolve("org_a")).toBe("org_a");
    expect(b.resolve("org_b")).toBe("org_b");
    expect(b.resolve("org_c")).toBe("org_c");
    expect(b.size()).toBe(3);
  });

  it("rolls excess labels into 'other'", () => {
    const b = createBoundedLabels({ maxLabels: 2 });
    expect(b.resolve("org_a")).toBe("org_a");
    expect(b.resolve("org_b")).toBe("org_b");
    expect(b.resolve("org_c")).toBe("other");
    expect(b.resolve("org_d")).toBe("other");
    expect(b.size()).toBe(2); // "other" does not count toward size
  });

  it("preserves previously-tracked orgs across repeated access", () => {
    const b = createBoundedLabels({ maxLabels: 2 });
    b.resolve("org_a");
    b.resolve("org_b");
    b.resolve("org_c"); // rolls to other
    // org_a and org_b still first-class.
    expect(b.resolve("org_a")).toBe("org_a");
    expect(b.resolve("org_b")).toBe("org_b");
    expect(b.resolve("org_c")).toBe("other");
  });

  it("handles empty org_id by mapping to 'unknown'", () => {
    const b = createBoundedLabels({ maxLabels: 5 });
    expect(b.resolve("")).toBe("unknown");
  });

  it("accepts a custom other-label", () => {
    const b = createBoundedLabels({ maxLabels: 1, otherLabel: "rolled_up" });
    b.resolve("org_a");
    expect(b.resolve("org_b")).toBe("rolled_up");
  });

  it("rejects maxLabels < 1", () => {
    expect(() => createBoundedLabels({ maxLabels: 0 })).toThrow();
  });

  it("cardinality invariant: tracked + 'other' ≤ maxLabels + 1 regardless of input volume", () => {
    const b = createBoundedLabels({ maxLabels: 5 });
    for (let i = 0; i < 10_000; i++) b.resolve(`org_${i}`);
    expect(b.size()).toBeLessThanOrEqual(5);
    const labels = new Set<string>(b.snapshot());
    labels.add("other");
    expect(labels.size).toBeLessThanOrEqual(6);
  });
});
