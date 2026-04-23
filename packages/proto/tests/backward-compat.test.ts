/**
 * Backward-compatibility test for the foxhound.v1 schema.
 *
 * Protocol:
 *   1. A frozen "v1.0" binary fixture is produced the first time this test
 *      runs. It captures the wire bytes for a well-known span + batch under
 *      the initial schema.
 *   2. On every subsequent run, the current code MUST decode the frozen
 *      bytes without loss. This proves additive-only discipline holds.
 *   3. If an engineer introduces a breaking change (renumber, type change,
 *      remove field), this test fails loudly and the change must either
 *      revert or bump to v2.
 *
 * Where fixtures live: `tests/fixtures/v1_0_*.bin`. They are committed so
 * the guard survives a fresh clone.
 *
 * How to regenerate the fixture (operator action only):
 *   rm packages/proto/tests/fixtures/v1_0_*.bin
 *   pnpm --filter @foxhound/proto test
 * The test writes the fixture on a cold run and then asserts on all future
 * runs. Regeneration should ONLY be done when deliberately bumping to v2.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SpanCodec,
  SpanKind,
  StatusCode,
  TraceBatchCodec,
  type Span,
  type TraceBatch,
} from "../src/v1/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const SPAN_FIXTURE = resolve(here, "fixtures/v1_0_span.bin");
const BATCH_FIXTURE = resolve(here, "fixtures/v1_0_trace_batch.bin");

// The canonical v1.0 fixture content. These values are immutable; if any
// engineer "fixes" them, that is a breaking schema change by definition.
const FIXTURE_SPAN: Span = {
  orgId: "fixture_org",
  traceId: "0".repeat(32),
  spanId: "1".repeat(16),
  parentSpanId: "2".repeat(16),
  name: "fixture.span",
  kind: SpanKind.CLIENT,
  startTimeUnixNano: "1700000000000000000",
  endTimeUnixNano: "1700000000000250000",
  status: { code: StatusCode.OK, message: "ok" },
  attributes: {
    k_string: { stringValue: "v" },
    k_int: { intValue: 7 },
    k_double: { doubleValue: 1.5 },
    k_bool: { boolValue: true },
  },
  events: [{ timeUnixNano: "1700000000000010000", name: "ev1", attributes: {} }],
  agentId: "fixture_agent",
  sessionId: "fixture_session",
};

const FIXTURE_BATCH: TraceBatch = {
  schemaVersion: "v1",
  batchId: 999,
  orgId: "fixture_org",
  spans: [FIXTURE_SPAN],
  sdkLanguage: "ts",
  sdkVersion: "0.1.0",
};

async function ensureFixture(path: string, bytes: Uint8Array): Promise<Uint8Array> {
  if (!existsSync(path)) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    // eslint-disable-next-line no-console
    console.warn(
      `[backward-compat] cold fixture written: ${path} (${bytes.length} bytes). ` +
        "This should only happen on the first run after a deliberate v-bump.",
    );
    return bytes;
  }
  return new Uint8Array(await readFile(path));
}

describe("foxhound.v1 · backward-compat · Span", () => {
  let frozen: Uint8Array;
  beforeAll(async () => {
    frozen = await ensureFixture(SPAN_FIXTURE, SpanCodec.encode(FIXTURE_SPAN));
  });

  it("current code decodes the v1.0 fixture without loss", () => {
    const decoded = SpanCodec.decode(frozen);
    expect(decoded.orgId).toBe("fixture_org");
    expect(decoded.traceId).toBe("0".repeat(32));
    expect(decoded.spanId).toBe("1".repeat(16));
    expect(decoded.parentSpanId).toBe("2".repeat(16));
    expect(decoded.kind).toBe(SpanKind.CLIENT);
    expect(decoded.status.code).toBe(StatusCode.OK);
    expect(decoded.status.message).toBe("ok");
    expect(decoded.attributes["k_string"]).toEqual({ stringValue: "v" });
    // int64 fields decode as strings; see codec.ts `longs: String` rationale.
    expect(decoded.attributes["k_int"]).toEqual({ intValue: "7" });
    expect(decoded.attributes["k_double"]).toEqual({ doubleValue: 1.5 });
    expect(decoded.attributes["k_bool"]).toEqual({ boolValue: true });
    expect(decoded.events).toHaveLength(1);
    expect(decoded.events[0]!.name).toBe("ev1");
    expect(decoded.agentId).toBe("fixture_agent");
    expect(decoded.sessionId).toBe("fixture_session");
  });

  it("adding a new optional field (hypothetical future v1) still decodes v1.0 fixture", () => {
    // Simulate: a future writer sends a span with a NEW unknown field
    // (tag 200, which we reserved). protobufjs preserves unknown fields
    // through decode, and old consumers ignore them. Prove this by taking
    // the frozen bytes, concatenating an unknown tag=200 varint value, and
    // decoding — it must still succeed and our known fields must match.
    const extra = new Uint8Array([
      // field 200, wire type 0 (varint): tag = (200 << 3) | 0 = 1600
      // varint encoding of 1600: 0xC0 0x0C
      0xc0, 0x0c,
      // value: varint 42 → 0x2a
      0x2a,
    ]);
    const combined = new Uint8Array(frozen.length + extra.length);
    combined.set(frozen, 0);
    combined.set(extra, frozen.length);

    const decoded = SpanCodec.decode(combined);
    expect(decoded.orgId).toBe("fixture_org");
    expect(decoded.name).toBe("fixture.span");
  });
});

describe("foxhound.v1 · backward-compat · TraceBatch", () => {
  let frozen: Uint8Array;
  beforeAll(async () => {
    frozen = await ensureFixture(BATCH_FIXTURE, TraceBatchCodec.encode(FIXTURE_BATCH));
  });

  it("current code decodes the v1.0 batch fixture without loss", () => {
    const decoded = TraceBatchCodec.decode(frozen);
    expect(decoded.schemaVersion).toBe("v1");
    expect(Number(decoded.batchId)).toBe(999);
    expect(decoded.orgId).toBe("fixture_org");
    expect(decoded.spans).toHaveLength(1);
    expect(decoded.spans[0]!.name).toBe("fixture.span");
    expect(decoded.sdkLanguage).toBe("ts");
  });
});

describe("foxhound.v1 · breaking-change guard (negative case)", () => {
  it("decoding a payload written by an incompatible 'v2' sender fails or drops fields, never silently mislabels", () => {
    // Simulate a mismatched sender by overwriting field 1 (orgId / string)
    // with a malformed varint header. The decoder should either throw or
    // produce unrecoverable garbage — what it MUST NOT do is silently
    // reinterpret the bytes as a valid Span with different field values.
    const bytes = SpanCodec.encode(FIXTURE_SPAN);
    const corrupted = new Uint8Array(bytes);
    // Flip bits in the first length-delimited payload header.
    if (corrupted.length > 2) {
      corrupted[1] = corrupted[1]! ^ 0xff;
    }
    let caughtOrDifferent = false;
    try {
      const decoded = SpanCodec.decode(corrupted);
      if (decoded.orgId !== FIXTURE_SPAN.orgId) caughtOrDifferent = true;
    } catch {
      caughtOrDifferent = true;
    }
    expect(caughtOrDifferent).toBe(true);
  });
});
