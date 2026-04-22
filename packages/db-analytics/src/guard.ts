/**
 * Tenant-scope guardrail for every analytics query.
 *
 * The MergeTree schema has `org_id` as the first ORDER BY key, so every
 * efficient query starts with `WHERE org_id = {orgId:String}`. The helper
 * here makes it a compile-time error to forget the scope: query-builder
 * functions take a branded `ScopedOrg` value that can only be produced by
 * this module, and SQL assembly happens inside the scoped context.
 *
 * This is defence in depth on top of the header-level tenant checks at the
 * edge (traces-proto.ts) and at the consumer (ingest-persistence.ts). If
 * somebody ever bypasses those, the analytics layer still cannot issue a
 * cross-tenant read.
 */
const ORG_SCOPE_BRAND: unique symbol = Symbol("foxhound.db-analytics.orgScope");

/** A validated, branded tenant scope. The only way to get one is `scope()`. */
export interface ScopedOrg {
  readonly [ORG_SCOPE_BRAND]: true;
  readonly orgId: string;
}

/** Produce a scoped tenant from a raw id. Throws on empty/whitespace/long ids. */
export function scope(orgId: string): ScopedOrg {
  if (typeof orgId !== "string") throw new Error("scope(): orgId must be a string");
  const trimmed = orgId.trim();
  if (trimmed.length === 0) {
    throw new Error("scope(): orgId must be non-empty (cross-tenant guardrail)");
  }
  if (trimmed.length > 64) {
    // ClickHouse allows long strings but our org_id is always a short ulid/
    // uuid; anything huge is almost certainly a bug or injection attempt.
    throw new Error("scope(): orgId exceeds 64 chars — refusing to query");
  }
  // Basic shape check: org ids may contain letters/digits/hyphen/underscore.
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    throw new Error("scope(): orgId contains characters outside [A-Za-z0-9_-]");
  }
  return { [ORG_SCOPE_BRAND]: true, orgId: trimmed };
}

/** Assert at the callsite that a value is a ScopedOrg (not a raw string). */
export function assertScoped(value: unknown): asserts value is ScopedOrg {
  if (!value || typeof value !== "object" || !(ORG_SCOPE_BRAND in value)) {
    throw new Error("assertScoped(): value is not a tenant-scoped org. Call `scope(orgId)` first.");
  }
}
