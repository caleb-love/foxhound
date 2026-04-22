import { describe, it, expect } from "vitest";
import { gzipSync } from "node:zlib";
import { v1 } from "@foxhound/proto";
import { decodeProtoBatch, isProtobufRequest } from "./traces-proto.js";

function mkBatch(orgId: string, spanOrgId = orgId): Uint8Array {
  return v1.TraceBatchCodec.encode({
    schemaVersion: "v1",
    batchId: 1,
    orgId,
    sdkLanguage: "ts",
    sdkVersion: "0.3.0",
    spans: [
      {
        orgId: spanOrgId,
        traceId: "t".repeat(32),
        spanId: "s".repeat(16),
        name: "llm.generate",
        kind: v1.SpanKind.CLIENT,
        startTimeUnixNano: "1700000000000000000",
        endTimeUnixNano: "1700000000050000000",
        status: { code: v1.StatusCode.OK, message: "" },
        attributes: { "gen_ai.system": { stringValue: "openai" } },
        events: [],
      },
    ],
  });
}

describe("api · traces-proto · isProtobufRequest", () => {
  const fake = (headers: Record<string, string>) =>
    ({ headers } as unknown as Parameters<typeof isProtobufRequest>[0]);

  it("detects application/x-protobuf", () => {
    expect(isProtobufRequest(fake({ "content-type": "application/x-protobuf" }))).toBe(true);
  });
  it("detects application/vnd.google.protobuf", () => {
    expect(isProtobufRequest(fake({ "content-type": "application/vnd.google.protobuf" }))).toBe(true);
  });
  it("tolerates a charset suffix on the content-type", () => {
    expect(isProtobufRequest(fake({ "content-type": "application/x-protobuf; charset=binary" }))).toBe(true);
  });
  it("accepts the explicit x-foxhound-wire hint when content-type is missing", () => {
    expect(isProtobufRequest(fake({ "x-foxhound-wire": "protobuf" }))).toBe(true);
  });
  it("does not flag JSON requests", () => {
    expect(isProtobufRequest(fake({ "content-type": "application/json" }))).toBe(false);
  });
});

describe("api · traces-proto · decodeProtoBatch", () => {
  it("decodes a well-formed batch and returns a Trace", () => {
    const bytes = mkBatch("org_a");
    const result = decodeProtoBatch(Buffer.from(bytes), "org_a");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.schemaVersion).toBe("v1");
    expect(result.trace.spans).toHaveLength(1);
    expect(result.trace.spans[0]!.name).toBe("llm.generate");
    expect(result.trace.metadata["foxhound.wire_format"]).toBe("protobuf");
    expect(result.trace.metadata["sdk.language"]).toBe("ts");
  });

  it("returns 400 on a malformed payload", () => {
    const result = decodeProtoBatch(Buffer.from([0xff, 0xff, 0xff]), "org_a");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toBe("Bad Request");
  });

  // ── WP05 · Content-Encoding + size ceiling ──────────────────────────

  it("WP05 honors Content-Encoding: gzip and decodes the batch", () => {
    const raw = mkBatch("org_a");
    const zipped = gzipSync(Buffer.from(raw));
    const result = decodeProtoBatch(zipped, "org_a", "gzip");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contentEncoding).toBe("gzip");
    expect(result.trace.spans).toHaveLength(1);
  });

  it("WP05 reports contentEncoding: none when no header is set", () => {
    const raw = mkBatch("org_a");
    const result = decodeProtoBatch(Buffer.from(raw), "org_a");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contentEncoding).toBe("none");
  });

  it("WP05 returns 415 on an invalid gzip body", () => {
    const bogusGzip = Buffer.from([0x1f, 0x8b, 0x00, 0x00, 0x00]);
    const result = decodeProtoBatch(bogusGzip, "org_a", "gzip");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(415);
    expect(result.message).toMatch(/invalid gzip/);
  });

  it("WP05 returns 415 on an unsupported Content-Encoding (e.g. deflate)", () => {
    const raw = mkBatch("org_a");
    const result = decodeProtoBatch(Buffer.from(raw), "org_a", "deflate");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(415);
    expect(result.message).toMatch(/unsupported Content-Encoding: deflate/);
  });

  it("WP05 returns 413 when decompressed body exceeds 1 MiB", () => {
    // Construct a realistic 2 MiB body that gzips well (so the
    // compressed input is modest; the server-side ceiling must still
    // fire on the decompressed size, not the compressed size).
    const bigRaw = Buffer.alloc(2 * 1024 * 1024, 0x61); // 2 MiB of 'a'
    const zipped = gzipSync(bigRaw);
    expect(zipped.byteLength).toBeLessThan(64 * 1024); // sanity: gzip crushes to < 64 KB
    const result = decodeProtoBatch(zipped, "org_a", "gzip");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(413);
    expect(result.message).toMatch(/decompressed body of/);
  });

  it("WP05 returns 413 when raw (uncompressed) body exceeds 1 MiB", () => {
    const big = Buffer.alloc(2 * 1024 * 1024, 0);
    const result = decodeProtoBatch(big, "org_a");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(413);
  });

  it("REJECTS a batch whose batch.org_id does not match the caller (403)", () => {
    const bytes = mkBatch("org_other");
    const result = decodeProtoBatch(Buffer.from(bytes), "org_me");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
    expect(result.message).toContain("batch.org_id");
  });

  it("REJECTS a batch whose span.org_id mismatches the caller (403, cross-tenant guardrail)", () => {
    // batch orgId matches, but a span inside does not.
    const bytes = mkBatch("org_me", "org_leaked");
    const result = decodeProtoBatch(Buffer.from(bytes), "org_me");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
    expect(result.message).toContain("different org_id");
  });

  it("accepts empty batch.org_id but enforces span.org_id when set", () => {
    // SDK may omit batch.orgId; the API still authenticates from the key.
    const bytes = v1.TraceBatchCodec.encode({
      schemaVersion: "v1",
      batchId: 2,
      orgId: "",
      spans: [
        {
          orgId: "",
          traceId: "t".repeat(32),
          spanId: "s".repeat(16),
          name: "step",
          kind: v1.SpanKind.INTERNAL,
          startTimeUnixNano: "1700000000000000000",
          endTimeUnixNano: "1700000000010000000",
          status: { code: v1.StatusCode.OK, message: "" },
          attributes: {},
          events: [],
        },
      ],
    });
    const result = decodeProtoBatch(Buffer.from(bytes), "org_auth");
    expect(result.ok).toBe(true);
  });

  it("rejects unsupported schema_version with 400", () => {
    // Bypass codec to inject an unexpected string.
    const bytes = v1.TraceBatchCodec.encode({
      schemaVersion: "v2" as "v1",
      batchId: 3,
      orgId: "org_a",
      spans: [
        {
          orgId: "org_a",
          traceId: "t".repeat(32),
          spanId: "s".repeat(16),
          name: "x",
          kind: v1.SpanKind.INTERNAL,
          startTimeUnixNano: "1",
          endTimeUnixNano: "2",
          status: { code: v1.StatusCode.OK, message: "" },
          attributes: {},
          events: [],
        },
      ],
    });
    const result = decodeProtoBatch(Buffer.from(bytes), "org_a");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.message).toContain("schema_version");
  });

  it("rejects empty-span batch with 400", () => {
    const bytes = v1.TraceBatchCodec.encode({
      schemaVersion: "v1",
      batchId: 4,
      orgId: "org_a",
      spans: [],
    });
    const result = decodeProtoBatch(Buffer.from(bytes), "org_a");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("converts nanosecond timestamps back to milliseconds correctly", () => {
    const bytes = mkBatch("org_a");
    const result = decodeProtoBatch(Buffer.from(bytes), "org_a");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trace.spans[0]!.startTimeMs).toBe(1_700_000_000_000);
    expect(result.trace.spans[0]!.endTimeMs).toBe(1_700_000_000_050);
  });

  it("groups spans sharing a trace_id; records sdkLanguage/version into metadata", () => {
    const bytes = v1.TraceBatchCodec.encode({
      schemaVersion: "v1",
      batchId: 5,
      orgId: "org_a",
      sdkLanguage: "py",
      sdkVersion: "0.1.0",
      spans: [
        {
          orgId: "org_a",
          traceId: "t".repeat(32),
          spanId: "s1" + "s".repeat(14),
          name: "root",
          kind: v1.SpanKind.INTERNAL,
          startTimeUnixNano: "1000000000",
          endTimeUnixNano: "2000000000",
          status: { code: v1.StatusCode.OK, message: "" },
          attributes: {},
          events: [],
        },
        {
          orgId: "org_a",
          traceId: "t".repeat(32),
          spanId: "s2" + "s".repeat(14),
          parentSpanId: "s1" + "s".repeat(14),
          name: "child",
          kind: v1.SpanKind.INTERNAL,
          startTimeUnixNano: "1500000000",
          endTimeUnixNano: "1800000000",
          status: { code: v1.StatusCode.OK, message: "" },
          attributes: {},
          events: [],
        },
      ],
    });
    const result = decodeProtoBatch(Buffer.from(bytes), "org_a");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trace.spans).toHaveLength(2);
    expect(result.trace.metadata["sdk.language"]).toBe("py");
    expect(result.trace.metadata["sdk.version"]).toBe("0.1.0");
  });
});
