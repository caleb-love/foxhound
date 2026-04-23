import { describe, it, expect } from "vitest";
import type { Trace } from "@foxhound/types";
import { v1 } from "@foxhound/proto";
import { spanToProtoSpan, traceToTraceBatch } from "./map.js";

function buildTrace(partial?: Partial<Trace>): Trace {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    agentId: "agent_planner",
    sessionId: "sess_xyz",
    spans: [
      {
        traceId: "11111111-1111-1111-1111-111111111111",
        spanId: "span_root",
        name: "llm.generate",
        kind: "llm_call",
        startTimeMs: 1_700_000_000_000,
        endTimeMs: 1_700_000_000_150,
        status: "ok",
        attributes: {
          "gen_ai.system": "openai",
          "gen_ai.usage.input_tokens": 512,
          cached: true,
          nullable: null,
        },
        events: [{ timeMs: 1_700_000_000_005, name: "request.start", attributes: { seq: 1 } }],
      },
      {
        traceId: "11111111-1111-1111-1111-111111111111",
        spanId: "span_child",
        parentSpanId: "span_root",
        name: "tool.search",
        kind: "tool_call",
        startTimeMs: 1_700_000_000_020,
        endTimeMs: 1_700_000_000_080,
        status: "error",
        attributes: { "tool.name": "vector_search" },
        events: [],
      },
    ],
    startTimeMs: 1_700_000_000_000,
    endTimeMs: 1_700_000_000_150,
    metadata: { source: "unit-test" },
    ...partial,
  };
}

describe("sdk · transport · map · spanToProtoSpan", () => {
  it("converts ms timestamps to nanoseconds", () => {
    const trace = buildTrace();
    const span = spanToProtoSpan(trace.spans[0]!, "org_test");
    expect(span.startTimeUnixNano).toBe("1700000000000000000");
    expect(span.endTimeUnixNano).toBe("1700000000150000000");
    expect(span.events[0]!.timeUnixNano).toBe("1700000000005000000");
  });

  it("maps SDK SpanKind to proto SpanKind", () => {
    const trace = buildTrace();
    expect(spanToProtoSpan(trace.spans[0]!, "o").kind).toBe(v1.SpanKind.CLIENT);
    expect(spanToProtoSpan(trace.spans[1]!, "o").kind).toBe(v1.SpanKind.CLIENT);
  });

  it("maps SDK SpanStatus to proto StatusCode", () => {
    const trace = buildTrace();
    expect(spanToProtoSpan(trace.spans[0]!, "o").status.code).toBe(v1.StatusCode.OK);
    expect(spanToProtoSpan(trace.spans[1]!, "o").status.code).toBe(v1.StatusCode.ERROR);
  });

  it("preserves attributes across types (string/int/double/bool), drops nulls", () => {
    const trace = buildTrace();
    const pb = spanToProtoSpan(trace.spans[0]!, "o");
    expect(pb.attributes["gen_ai.system"]).toEqual({ stringValue: "openai" });
    expect(pb.attributes["gen_ai.usage.input_tokens"]).toEqual({ intValue: 512 });
    expect(pb.attributes["cached"]).toEqual({ boolValue: true });
    expect(pb.attributes["nullable"]).toBeUndefined();
  });

  it("tags every span with the supplied org_id (guardrail)", () => {
    const trace = buildTrace();
    for (const span of trace.spans) {
      expect(spanToProtoSpan(span, "org_foo").orgId).toBe("org_foo");
    }
  });

  // ── WP15 · agent_id wire propagation ─────────────────────────────────

  it("WP15 propagates trace-level agentId to every span when no per-span scope is set", () => {
    const trace = buildTrace();
    const a = spanToProtoSpan(trace.spans[0]!, "o", { traceAgentId: "orchestrator" });
    const b = spanToProtoSpan(trace.spans[1]!, "o", { traceAgentId: "orchestrator" });
    expect(a.agentId).toBe("orchestrator");
    expect(b.agentId).toBe("orchestrator");
  });

  it("WP15 per-span agentId overrides the trace-level default", () => {
    const trace = buildTrace({
      spans: [
        {
          traceId: "t",
          spanId: "s1",
          name: "root",
          kind: "agent_step",
          startTimeMs: 1,
          endTimeMs: 2,
          status: "ok",
          attributes: {},
          events: [],
          agentId: "researcher",
        },
      ],
    });
    const pb = spanToProtoSpan(trace.spans[0]!, "o", { traceAgentId: "orchestrator" });
    expect(pb.agentId).toBe("researcher");
  });

  it("WP15 omits wire agentId when neither trace- nor span-level scope is set (proto3 absence)", () => {
    const trace = buildTrace({ agentId: "" });
    const pb = spanToProtoSpan(trace.spans[0]!, "o");
    expect(pb.agentId).toBeUndefined();
  });

  it("WP15 treats empty-string trace/span agentId as unset (no silent empty id)", () => {
    const trace = buildTrace();
    const pb = spanToProtoSpan(trace.spans[0]!, "o", { traceAgentId: "" });
    expect(pb.agentId).toBeUndefined();
  });
});

describe("sdk · transport · map · traceToTraceBatch", () => {
  it("produces a v1 batch round-trippable through the codec", () => {
    const trace = buildTrace();
    const batch = traceToTraceBatch(trace, {
      orgId: "org_rt",
      sdkLanguage: "ts",
      sdkVersion: "0.3.0",
    });
    expect(batch.schemaVersion).toBe("v1");
    expect(batch.orgId).toBe("org_rt");
    expect(batch.spans).toHaveLength(2);
    expect(batch.sdkLanguage).toBe("ts");
    expect(batch.sdkVersion).toBe("0.3.0");

    const bytes = v1.TraceBatchCodec.encode(batch);
    const decoded = v1.TraceBatchCodec.decode(bytes);
    expect(decoded.orgId).toBe("org_rt");
    expect(decoded.spans).toHaveLength(2);
    expect(decoded.spans[0]!.name).toBe("llm.generate");
    expect(decoded.spans[1]!.parentSpanId).toBe("span_root");
  });

  it("handles traces without explicit orgId by using empty string", () => {
    const trace = buildTrace();
    const batch = traceToTraceBatch(trace, {});
    expect(batch.orgId).toBe("");
    expect(batch.spans[0]!.orgId).toBe("");
  });

  it("WP15 threads trace.agentId into every batch span when none is explicit", () => {
    const trace = buildTrace({ agentId: "planner" });
    const batch = traceToTraceBatch(trace, { orgId: "org_rt" });
    for (const s of batch.spans) {
      expect(s.agentId).toBe("planner");
    }
  });

  it("WP15 preserves per-span agentId across batch encoding + decoding", () => {
    const trace = buildTrace({
      agentId: "planner",
      spans: [
        {
          traceId: "t1",
          spanId: "s1",
          name: "plan",
          kind: "agent_step",
          startTimeMs: 1_700_000_000_000,
          endTimeMs: 1_700_000_000_010,
          status: "ok",
          attributes: {},
          events: [],
        },
        {
          traceId: "t1",
          spanId: "s2",
          parentSpanId: "s1",
          name: "search",
          kind: "tool_call",
          startTimeMs: 1_700_000_000_005,
          endTimeMs: 1_700_000_000_020,
          status: "ok",
          attributes: {},
          events: [],
          agentId: "researcher",
        },
      ],
    });
    const batch = traceToTraceBatch(trace, { orgId: "org_multi" });
    const bytes = v1.TraceBatchCodec.encode(batch);
    const decoded = v1.TraceBatchCodec.decode(bytes);
    expect(decoded.spans[0]!.agentId).toBe("planner");
    expect(decoded.spans[1]!.agentId).toBe("researcher");
  });

  it("drops sdkLanguage/sdkVersion when not provided (exactOptionalPropertyTypes)", () => {
    const trace = buildTrace();
    const batch = traceToTraceBatch(trace);
    expect(batch.sdkLanguage).toBeUndefined();
    expect(batch.sdkVersion).toBeUndefined();
  });
});
