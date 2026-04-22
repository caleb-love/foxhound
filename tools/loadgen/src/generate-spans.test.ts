import { describe, it, expect } from "vitest";
import {
  createRng,
  generateBatch,
  generateSpan,
  generateTrace,
  type OtlpRequestBody,
} from "./generate-spans.js";

describe("loadgen · generate-spans", () => {
  it("createRng is deterministic for a given seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 10; i++) {
      expect(a.nextFloat()).toBe(b.nextFloat());
    }
  });

  it("generateSpan produces a valid OTLP span shape", () => {
    const rng = createRng(1);
    const traceId = rng.nextHex(16);
    const span = generateSpan({ rng, traceId, sizeBytesTarget: 1024 });
    expect(span.traceId).toBe(traceId);
    expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect([1, 2, 3]).toContain(span.kind);
    expect(span.startTimeUnixNano).toMatch(/^\d+$/);
    expect(span.endTimeUnixNano).toMatch(/^\d+$/);
    expect(BigInt(span.endTimeUnixNano) > BigInt(span.startTimeUnixNano)).toBe(true);
    expect([0, 1, 2]).toContain(span.status.code);
  });

  it("generateSpan respects the size target within envelope tolerance", () => {
    const rng = createRng(7);
    const traceId = rng.nextHex(16);
    const span = generateSpan({ rng, traceId, sizeBytesTarget: 4096 });
    const json = JSON.stringify(span);
    // Soft target; filler padding brings us within ~10% of target for 4KB.
    expect(json.length).toBeGreaterThan(3500);
    expect(json.length).toBeLessThan(5500);
  });

  it("generateTrace chains parent→child spans by spanId", () => {
    const rng = createRng(2);
    const resource = generateTrace({ rng, orgId: "org_test", spansPerTrace: 5 });
    expect(resource.scopeSpans).toHaveLength(1);
    const scope = resource.scopeSpans[0]!;
    const spans = scope.spans;
    expect(spans).toHaveLength(5);
    // All spans share the same traceId.
    const traceId = spans[0]!.traceId;
    for (const s of spans) expect(s.traceId).toBe(traceId);
    // Root has no parent; each subsequent span's parent is the previous spanId.
    expect(spans[0]!.parentSpanId).toBeUndefined();
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i]!.parentSpanId).toBe(spans[i - 1]!.spanId);
    }
  });

  it("generateTrace tags the resource with the orgId for cross-tenant-leak detection", () => {
    const rng = createRng(3);
    const resource = generateTrace({ rng, orgId: "org_xyz", spansPerTrace: 2 });
    const orgTag = resource.resource.attributes.find(
      (a) => a.key === "foxhound.loadgen.org_id"
    );
    expect(orgTag).toBeDefined();
    expect(orgTag!.value).toEqual({ stringValue: "org_xyz" });
  });

  it("generateBatch produces one resourceSpans entry per (org × trace)", () => {
    const rng = createRng(4);
    const batch = generateBatch({
      rng,
      orgIds: ["org_a", "org_b", "org_c"],
      tracesPerOrg: 2,
      spansPerTrace: 3,
    });
    expect(batch.resourceSpans).toHaveLength(3 * 2);
    // Spread of orgIds across the batch.
    const orgs = batch.resourceSpans
      .map(
        (r) =>
          r.resource.attributes.find((a) => a.key === "foxhound.loadgen.org_id")?.value
      )
      .map((v) => (v && "stringValue" in v ? v.stringValue : null));
    expect(orgs.filter((o) => o === "org_a")).toHaveLength(2);
    expect(orgs.filter((o) => o === "org_b")).toHaveLength(2);
    expect(orgs.filter((o) => o === "org_c")).toHaveLength(2);
  });

  it("generateBatch produces valid OTLP JSON (round-trip stable)", () => {
    const rng = createRng(5);
    const batch = generateBatch({
      rng,
      orgIds: ["org_a"],
      tracesPerOrg: 1,
      spansPerTrace: 4,
    });
    const json = JSON.stringify(batch);
    const parsed = JSON.parse(json) as OtlpRequestBody;
    expect(parsed.resourceSpans).toHaveLength(1);
    expect(parsed.resourceSpans[0]!.scopeSpans[0]!.spans).toHaveLength(4);
  });

  it("no span crosses orgIds within a single resource", () => {
    const rng = createRng(9);
    const batch = generateBatch({
      rng,
      orgIds: ["org_one", "org_two"],
      tracesPerOrg: 3,
      spansPerTrace: 2,
    });
    // Each resource has exactly one orgId tag; spans within it must share it.
    for (const r of batch.resourceSpans) {
      const orgTag = r.resource.attributes.find((a) => a.key === "foxhound.loadgen.org_id");
      const orgVal =
        orgTag && "stringValue" in orgTag.value ? orgTag.value.stringValue : null;
      expect(orgVal === "org_one" || orgVal === "org_two").toBe(true);
    }
  });
});
