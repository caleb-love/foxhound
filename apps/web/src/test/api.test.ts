import { describe, it, expect } from "vitest";
import { buildSpanTree, spanDurationMs } from "@/lib/api";
import type { Span } from "@foxhound/types";

function makeSpan(overrides: Partial<Span> & { spanId: string }): Span {
  return {
    spanId: overrides.spanId,
    ...(overrides.parentSpanId !== undefined && { parentSpanId: overrides.parentSpanId }),
    traceId: overrides.traceId ?? "trace-1",
    name: overrides.name ?? overrides.spanId,
    kind: overrides.kind ?? "custom",
    status: overrides.status ?? "ok",
    startTimeMs: overrides.startTimeMs ?? 0,
    ...(overrides.endTimeMs !== undefined && { endTimeMs: overrides.endTimeMs }),
    attributes: overrides.attributes ?? {},
    events: overrides.events ?? [],
  };
}

describe("spanDurationMs", () => {
  it("returns 0 when endTimeMs is absent", () => {
    const span = makeSpan({ spanId: "s1", startTimeMs: 1000 });
    expect(spanDurationMs(span)).toBe(0);
  });

  it("returns difference when endTimeMs is set", () => {
    const span = makeSpan({ spanId: "s1", startTimeMs: 1000, endTimeMs: 1500 });
    expect(spanDurationMs(span)).toBe(500);
  });

  it("handles zero-duration spans", () => {
    const span = makeSpan({ spanId: "s1", startTimeMs: 2000, endTimeMs: 2000 });
    expect(spanDurationMs(span)).toBe(0);
  });
});

describe("buildSpanTree", () => {
  it("returns empty array for empty input", () => {
    expect(buildSpanTree([])).toEqual([]);
  });

  it("returns single root span at depth 0", () => {
    const span = makeSpan({ spanId: "root", startTimeMs: 0 });
    const tree = buildSpanTree([span]);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.depth).toBe(0);
    expect(tree[0]!.span.spanId).toBe("root");
  });

  it("nests child spans under their parent", () => {
    const root = makeSpan({ spanId: "root", startTimeMs: 0 });
    const child = makeSpan({ spanId: "child", parentSpanId: "root", startTimeMs: 10 });
    const tree = buildSpanTree([root, child]);

    expect(tree).toHaveLength(2);
    expect(tree[0]).toMatchObject({ span: { spanId: "root" }, depth: 0 });
    expect(tree[1]).toMatchObject({ span: { spanId: "child" }, depth: 1 });
  });

  it("nests grandchild spans at depth 2", () => {
    const root = makeSpan({ spanId: "root", startTimeMs: 0 });
    const child = makeSpan({ spanId: "child", parentSpanId: "root", startTimeMs: 5 });
    const grandchild = makeSpan({ spanId: "gc", parentSpanId: "child", startTimeMs: 10 });
    const tree = buildSpanTree([root, child, grandchild]);

    expect(tree.find((n) => n.span.spanId === "gc")?.depth).toBe(2);
  });

  it("sorts children by startTimeMs", () => {
    const root = makeSpan({ spanId: "root", startTimeMs: 0 });
    const childB = makeSpan({ spanId: "b", parentSpanId: "root", startTimeMs: 20 });
    const childA = makeSpan({ spanId: "a", parentSpanId: "root", startTimeMs: 10 });
    const tree = buildSpanTree([root, childB, childA]);

    const childOrder = tree.slice(1).map((n) => n.span.spanId);
    expect(childOrder).toEqual(["a", "b"]);
  });

  it("treats spans with unknown parentSpanId as roots", () => {
    const orphan = makeSpan({ spanId: "orphan", parentSpanId: "missing-parent", startTimeMs: 0 });
    const tree = buildSpanTree([orphan]);
    expect(tree[0]!.depth).toBe(0);
  });

  it("handles multiple root spans sorted by startTimeMs", () => {
    const r2 = makeSpan({ spanId: "r2", startTimeMs: 20 });
    const r1 = makeSpan({ spanId: "r1", startTimeMs: 10 });
    const tree = buildSpanTree([r2, r1]);
    expect(tree.map((n) => n.span.spanId)).toEqual(["r1", "r2"]);
  });

  it("performs depth-first traversal", () => {
    // root -> a -> a1
    //      -> b
    const root = makeSpan({ spanId: "root", startTimeMs: 0 });
    const a = makeSpan({ spanId: "a", parentSpanId: "root", startTimeMs: 1 });
    const a1 = makeSpan({ spanId: "a1", parentSpanId: "a", startTimeMs: 2 });
    const b = makeSpan({ spanId: "b", parentSpanId: "root", startTimeMs: 10 });

    const tree = buildSpanTree([root, b, a, a1]);
    expect(tree.map((n) => n.span.spanId)).toEqual(["root", "a", "a1", "b"]);
  });
});
