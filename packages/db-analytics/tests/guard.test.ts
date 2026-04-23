import { describe, it, expect } from "vitest";
import { assertScoped, scope } from "../src/guard.js";

describe("db-analytics · guard · scope()", () => {
  it("produces a branded ScopedOrg for valid ids", () => {
    const s = scope("org_abc");
    expect(s.orgId).toBe("org_abc");
  });

  it("trims whitespace", () => {
    expect(scope("  org_a  ").orgId).toBe("org_a");
  });

  it("rejects empty strings (cross-tenant guardrail)", () => {
    expect(() => scope("")).toThrow(/non-empty/);
    expect(() => scope("   ")).toThrow(/non-empty/);
  });

  it("rejects non-string inputs", () => {
    expect(() => scope(42 as unknown as string)).toThrow();
    expect(() => scope(null as unknown as string)).toThrow();
    expect(() => scope(undefined as unknown as string)).toThrow();
  });

  it("rejects excessively long ids", () => {
    expect(() => scope("x".repeat(65))).toThrow(/64/);
  });

  it("rejects ids with unsafe characters", () => {
    expect(() => scope("org_a; DROP TABLE spans")).toThrow(/characters/);
    expect(() => scope("org a")).toThrow(/characters/);
    expect(() => scope("org'a")).toThrow(/characters/);
    expect(() => scope('org"a')).toThrow(/characters/);
  });

  it("accepts letters, digits, hyphens, underscores", () => {
    expect(() => scope("Org-123_abc")).not.toThrow();
  });
});

describe("db-analytics · guard · assertScoped()", () => {
  it("passes on a ScopedOrg", () => {
    const s = scope("org_a");
    expect(() => assertScoped(s)).not.toThrow();
  });

  it("throws on a raw string (compile-time guardrail, runtime net)", () => {
    expect(() => assertScoped("org_a")).toThrow(/not a tenant-scoped org/);
  });

  it("throws on a lookalike object missing the brand", () => {
    const fake = { orgId: "org_a" };
    expect(() => assertScoped(fake)).toThrow();
  });

  it("throws on null/undefined", () => {
    expect(() => assertScoped(null)).toThrow();
    expect(() => assertScoped(undefined)).toThrow();
  });
});
