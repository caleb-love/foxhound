import { describe, it, expect } from "vitest";
import type { Trace } from "@foxhound/types";
import {
  aggregateTrace,
  PREVIEW_MAX_CHARS,
  __buildListConversationsSqlForTest,
  parseCursor,
} from "../src/index.js";

function mkTrace(overrides: Partial<Trace> = {}): Trace {
  return {
    id: "t-agg-1",
    agentId: "agent_x",
    spans: [
      {
        traceId: "t-agg-1",
        spanId: "s-0",
        name: "llm.generate",
        kind: "llm_call",
        startTimeMs: 1_700_000_000_000,
        endTimeMs: 1_700_000_000_100,
        status: "ok",
        attributes: {
          "gen_ai.prompt": "Hello, how are you today?",
          "gen_ai.completion": "I am doing well, thank you.",
          "gen_ai.usage.input_tokens": 12,
          "gen_ai.usage.output_tokens": 7,
        },
        events: [],
      },
      {
        traceId: "t-agg-1",
        spanId: "s-1",
        parentSpanId: "s-0",
        name: "tool.search",
        kind: "tool_call",
        startTimeMs: 1_700_000_000_020,
        endTimeMs: 1_700_000_000_080,
        status: "ok",
        attributes: {},
        events: [],
      },
      {
        traceId: "t-agg-1",
        spanId: "s-2",
        name: "llm.generate",
        kind: "llm_call",
        startTimeMs: 1_700_000_000_120,
        endTimeMs: 1_700_000_000_200,
        status: "ok",
        attributes: {
          "gen_ai.completion": "Here is my final response to the user.",
          "gen_ai.usage.input_tokens": 45,
          "gen_ai.usage.output_tokens": 18,
        },
        events: [],
      },
    ],
    startTimeMs: 1_700_000_000_000,
    endTimeMs: 1_700_000_000_200,
    metadata: {},
    ...overrides,
  };
}

describe("db-analytics · aggregateTrace · basic shape", () => {
  it("produces a ConversationRow with the expected counts", () => {
    const row = aggregateTrace(mkTrace(), "org_a");
    expect(row.org_id).toBe("org_a");
    expect(row.trace_id).toBe("t-agg-1");
    expect(row.agent_id).toBe("agent_x");
    expect(row.total_spans).toBe(3);
    expect(row.total_llm_calls).toBe(2);
    expect(row.total_tool_calls).toBe(1);
    expect(row.total_subagent_calls).toBe(0); // WP15
    expect(row.error_count).toBe(0);
    expect(row.status).toBe("ok");
  });

  it("sums input + output tokens across all spans", () => {
    const row = aggregateTrace(mkTrace(), "org_a");
    expect(row.input_tokens).toBe(12 + 45);
    expect(row.output_tokens).toBe(7 + 18);
  });

  it("computes duration from trace.startTime to max(span.endTime)", () => {
    const row = aggregateTrace(mkTrace(), "org_a");
    expect(row.duration_ms).toBe(200);
  });

  it("stamps updated_at in CH DateTime64(3) format", () => {
    const row = aggregateTrace(mkTrace(), "org_a", { nowMs: 1_700_000_000_500 });
    expect(row.updated_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it("leaves cost_usd_micros at 0 (WP16 populates)", () => {
    const row = aggregateTrace(mkTrace(), "org_a");
    expect(row.cost_usd_micros).toBe(0);
  });
});

describe("db-analytics · aggregateTrace · status derivation", () => {
  it("sets status=error when any span has status=error", () => {
    const trace = mkTrace();
    trace.spans[1]!.status = "error";
    const row = aggregateTrace(trace, "org_a");
    expect(row.status).toBe("error");
    expect(row.error_count).toBe(1);
  });

  it("sets status=unset for a trace with no llm/tool spans", () => {
    const trace: Trace = {
      id: "t-empty",
      agentId: "a",
      spans: [
        {
          traceId: "t-empty",
          spanId: "s",
          name: "misc",
          kind: "custom",
          startTimeMs: 1,
          endTimeMs: 2,
          status: "unset",
          attributes: {},
          events: [],
        },
      ],
      startTimeMs: 1,
      endTimeMs: 2,
      metadata: {},
    };
    const row = aggregateTrace(trace, "org_a");
    expect(row.status).toBe("unset");
  });
});

describe("db-analytics · aggregateTrace · preview extraction", () => {
  it("picks the first llm/agent span's user-ish attribute for input preview", () => {
    const row = aggregateTrace(mkTrace(), "org_a");
    expect(row.user_input_preview).toBe("Hello, how are you today?");
  });

  it("picks the last successful llm span's output-ish attribute for output preview", () => {
    const row = aggregateTrace(mkTrace(), "org_a");
    expect(row.agent_output_preview).toBe("Here is my final response to the user.");
  });

  it("truncates previews to PREVIEW_MAX_CHARS with an ellipsis", () => {
    const long = "x".repeat(PREVIEW_MAX_CHARS + 50);
    const trace = mkTrace();
    trace.spans[0]!.attributes["gen_ai.prompt"] = long;
    const row = aggregateTrace(trace, "org_a");
    expect(row.user_input_preview.length).toBe(PREVIEW_MAX_CHARS);
    expect(row.user_input_preview.endsWith("…")).toBe(true);
  });

  it("returns empty strings when no preview-worthy attribute is present", () => {
    const trace: Trace = {
      id: "t-x",
      agentId: "a",
      spans: [
        {
          traceId: "t-x",
          spanId: "s",
          name: "step",
          kind: "agent_step",
          startTimeMs: 1,
          endTimeMs: 2,
          status: "ok",
          attributes: {},
          events: [],
        },
      ],
      startTimeMs: 1,
      endTimeMs: 2,
      metadata: {},
    };
    const row = aggregateTrace(trace, "org_a");
    expect(row.user_input_preview).toBe("");
    expect(row.agent_output_preview).toBe("");
  });

  it("honours custom extractors", () => {
    const row = aggregateTrace(mkTrace(), "org_a", {
      extractInputPreview: () => "CUSTOM_IN",
      extractOutputPreview: () => "CUSTOM_OUT",
    });
    expect(row.user_input_preview).toBe("CUSTOM_IN");
    expect(row.agent_output_preview).toBe("CUSTOM_OUT");
  });

  it("falls back to an earlier successful llm span when the last is errored", () => {
    const trace = mkTrace();
    // s-2 errors; extractor walks backwards and picks the prior ok llm
    // span (s-0) whose completion attribute is "I am doing well...".
    trace.spans[2]!.status = "error";
    const row = aggregateTrace(trace, "org_a");
    expect(row.agent_output_preview).toBe("I am doing well, thank you.");
  });

  it("returns empty output preview when every llm span is errored", () => {
    const trace = mkTrace();
    for (const s of trace.spans) if (s.kind === "llm_call") s.status = "error";
    const row = aggregateTrace(trace, "org_a");
    expect(row.agent_output_preview).toBe("");
  });
});

describe("db-analytics · aggregateTrace · tenant + idempotency properties", () => {
  it("org_id on the row matches the passed scope, not trace metadata", () => {
    const row1 = aggregateTrace(mkTrace(), "org_a");
    const row2 = aggregateTrace(mkTrace(), "org_b");
    expect(row1.org_id).toBe("org_a");
    expect(row2.org_id).toBe("org_b");
  });

  it("is deterministic for the same input + nowMs (ReplacingMergeTree stability)", () => {
    const a = aggregateTrace(mkTrace(), "org_a", { nowMs: 1_700_000_001_000 });
    const b = aggregateTrace(mkTrace(), "org_a", { nowMs: 1_700_000_001_000 });
    expect(a).toEqual(b);
  });

  it("advances updated_at when nowMs advances (upsert version column)", () => {
    const a = aggregateTrace(mkTrace(), "org_a", { nowMs: 1_000_000 });
    const b = aggregateTrace(mkTrace(), "org_a", { nowMs: 2_000_000 });
    expect(a.updated_at < b.updated_at).toBe(true);
  });

  it("handles a span with missing endTimeMs (uses startTimeMs)", () => {
    const trace = mkTrace();
    trace.spans[2] = {
      ...trace.spans[2]!,
      endTimeMs: undefined as unknown as number,
    };
    const row = aggregateTrace(trace, "org_a");
    // Duration still computed from trace.endTimeMs (which is set).
    expect(row.duration_ms).toBe(200);
  });
});

describe("db-analytics · listConversations SQL shape", () => {
  it("org_id is always the first WHERE predicate", () => {
    const { sql } = __buildListConversationsSqlForTest({
      orgId: "org_a",
      from: new Date(0),
      to: new Date(1),
    });
    expect(sql.startsWith("WHERE org_id = {orgId:String}")).toBe(true);
  });

  it("parameterises every string input (no raw interpolation)", () => {
    const { sql, params } = __buildListConversationsSqlForTest({
      orgId: "org_a",
      from: new Date(0),
      to: new Date(1),
      agentId: "agent_xyz",
      status: "error",
    });
    expect(sql).not.toContain("org_a");
    expect(sql).not.toContain("agent_xyz");
    expect(sql).not.toContain("'error'");
    expect(params["orgId"]).toBe("org_a");
    expect(params["agentId"]).toBe("agent_xyz");
    expect(params["status"]).toBe("error");
  });

  it("cursor round-trips base64url-encoded (started_at, trace_id)", () => {
    const enc = Buffer.from(
      "2026-04-20 12:34:56.000000000|trace-abc",
      "utf8",
    ).toString("base64url");
    const { cursorStart, cursorTraceId } = parseCursor(enc);
    expect(cursorStart).toBe("2026-04-20 12:34:56.000000000");
    expect(cursorTraceId).toBe("trace-abc");
  });
});
