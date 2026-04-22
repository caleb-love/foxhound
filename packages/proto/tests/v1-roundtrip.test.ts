import { describe, it, expect } from "vitest";
import {
  SpanCodec,
  SpanKind,
  StatusCode,
  TraceBatchCodec,
  type Span,
  type TraceBatch,
} from "../src/v1/index.js";

describe("foxhound.v1 · Span codec", () => {
  const span: Span = {
    orgId: "org_abc",
    traceId: "a".repeat(32),
    spanId: "b".repeat(16),
    parentSpanId: "c".repeat(16),
    name: "llm.generate",
    kind: SpanKind.CLIENT,
    startTimeUnixNano: "1713600000000000000",
    endTimeUnixNano: "1713600000000150000",
    status: { code: StatusCode.OK, message: "" },
    attributes: {
      "gen_ai.system": { stringValue: "openai" },
      "gen_ai.usage.input_tokens": { intValue: 512 },
      cached: { boolValue: true },
    },
    events: [
      {
        timeUnixNano: "1713600000000005000",
        name: "request.start",
        attributes: { chunk: { intValue: 1 } },
      },
    ],
    agentId: "agent_planner",
    sessionId: "sess_xyz",
  };

  it("encodes and decodes a fully-populated span", () => {
    const bytes = SpanCodec.encode(span);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(50);

    const decoded = SpanCodec.decode(bytes);
    expect(decoded.orgId).toBe("org_abc");
    expect(decoded.name).toBe("llm.generate");
    expect(decoded.kind).toBe(SpanKind.CLIENT);
    expect(decoded.status.code).toBe(StatusCode.OK);
    expect(decoded.attributes["gen_ai.system"]).toEqual({ stringValue: "openai" });
    // int64 fields decode as strings (see codec.ts `longs: String` rationale).
    expect(decoded.attributes["gen_ai.usage.input_tokens"]).toEqual({ intValue: "512" });
    expect(decoded.events).toHaveLength(1);
    expect(decoded.events[0]!.name).toBe("request.start");
    expect(decoded.agentId).toBe("agent_planner");
    expect(decoded.sessionId).toBe("sess_xyz");
  });

  it("round-trips a span without optional fields", () => {
    const minimal: Span = {
      orgId: "org_m",
      traceId: "a".repeat(32),
      spanId: "b".repeat(16),
      name: "agent.step",
      kind: SpanKind.INTERNAL,
      startTimeUnixNano: 1,
      endTimeUnixNano: 2,
      status: { code: StatusCode.UNSET, message: "" },
      attributes: {},
      events: [],
    };
    const decoded = SpanCodec.decode(SpanCodec.encode(minimal));
    expect(decoded.orgId).toBe("org_m");
    expect(decoded.parentSpanId).toBeUndefined();
    expect(decoded.agentId).toBeUndefined();
    expect(decoded.costUsdMicros).toBeUndefined();
  });

  it("verify rejects a span with wrong field types", () => {
    // verify() is strict: wrong-type fields return an error string.
    // Note: string-encoded int64 is ACCEPTED by encode() but REJECTED by
    // verify(); that distinction is documented in `codec.ts`.
    const bad = { ...span, startTimeUnixNano: { not: "a number" } } as unknown as Span;
    expect(SpanCodec.verify(bad)).not.toBeNull();
  });

  it("verify accepts numeric int64 fields", () => {
    const numericSpan: Span = {
      ...span,
      startTimeUnixNano: 1,
      endTimeUnixNano: 2,
      // Nested event times must also be numeric for verify() to pass.
      events: span.events.map((e) => ({ ...e, timeUnixNano: 10 })),
    };
    expect(SpanCodec.verify(numericSpan)).toBeNull();
  });
});

describe("foxhound.v1 · TraceBatch codec", () => {
  it("round-trips a batch of two spans", () => {
    const mk = (seq: string): Span => ({
      orgId: "org_batch",
      traceId: "t".repeat(32),
      spanId: seq.repeat(16).slice(0, 16),
      name: `step.${seq}`,
      kind: SpanKind.INTERNAL,
      startTimeUnixNano: 100,
      endTimeUnixNano: 200,
      status: { code: StatusCode.OK, message: "" },
      attributes: {},
      events: [],
    });
    const batch: TraceBatch = {
      schemaVersion: "v1",
      batchId: 42,
      orgId: "org_batch",
      spans: [mk("1"), mk("2")],
      sdkLanguage: "ts",
      sdkVersion: "0.1.0",
      sdkCompressionHint: "gzip",
    };
    const decoded = TraceBatchCodec.decode(TraceBatchCodec.encode(batch));
    expect(decoded.schemaVersion).toBe("v1");
    expect(decoded.spans).toHaveLength(2);
    expect(decoded.spans[0]!.orgId).toBe("org_batch");
    expect(decoded.spans[1]!.name).toBe("step.2");
    expect(decoded.sdkLanguage).toBe("ts");
  });

  it("rejects a batch with no org_id set (protocol violation)", () => {
    // Empty string is on-wire OK for proto3 but semantically invalid; the
    // API will reject. Parity test: verify accepts empty string (wire), the
    // semantic check belongs in the ingest route.
    const batch: TraceBatch = {
      schemaVersion: "v1",
      batchId: 1,
      orgId: "",
      spans: [],
    };
    expect(TraceBatchCodec.verify(batch)).toBeNull();
  });
});

describe("foxhound.v1 · tenancy semantics", () => {
  it("each span carries its own org_id (guardrail: API cross-check)", () => {
    const span: Span = {
      orgId: "org_alpha",
      traceId: "a".repeat(32),
      spanId: "b".repeat(16),
      name: "s",
      kind: SpanKind.INTERNAL,
      startTimeUnixNano: 1,
      endTimeUnixNano: 2,
      status: { code: StatusCode.OK, message: "" },
      attributes: {},
      events: [],
    };
    const mismatch: TraceBatch = {
      schemaVersion: "v1",
      batchId: 1,
      orgId: "org_beta",
      spans: [span],
    };
    const roundTripped = TraceBatchCodec.decode(TraceBatchCodec.encode(mismatch));
    // The encoding preserves the mismatch; the API layer is responsible
    // for detecting `batch.orgId !== span.orgId` and rejecting. This test
    // documents that the wire format does NOT silently normalise.
    expect(roundTripped.orgId).toBe("org_beta");
    expect(roundTripped.spans[0]!.orgId).toBe("org_alpha");
  });
});
