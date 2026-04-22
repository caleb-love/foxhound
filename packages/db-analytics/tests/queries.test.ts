import { describe, it, expect } from "vitest";
import {
  __buildListTracesSqlForTest,
  msToClickHouseDateTime64,
  parseCursor,
  rowFromInternalSpan,
} from "../src/index.js";
import type { InternalSpan } from "../src/types.js";

describe("db-analytics · rowFromInternalSpan", () => {
  const span: InternalSpan = {
    traceId: "t-1",
    spanId: "s-1",
    parentSpanId: "p-1",
    name: "llm.generate",
    kind: "llm_call",
    startTimeMs: 1_700_000_000_000,
    endTimeMs: 1_700_000_000_250,
    status: "ok",
    attributes: {
      "gen_ai.request.model": "gpt-4o",
      "gen_ai.usage.input_tokens": 512,
      "gen_ai.usage.output_tokens": 256,
      cached: true,
      "nullable.attr": null,
    },
    events: [],
  };

  it("maps the canonical fields", () => {
    const row = rowFromInternalSpan(span, { orgId: "org_a" });
    expect(row.org_id).toBe("org_a");
    expect(row.trace_id).toBe("t-1");
    expect(row.span_id).toBe("s-1");
    expect(row.parent_span_id).toBe("p-1");
    expect(row.name).toBe("llm.generate");
    expect(row.kind).toBe("llm_call");
    expect(row.status).toBe("ok");
  });

  it("auto-extracts model, input_tokens, output_tokens from attributes", () => {
    const row = rowFromInternalSpan(span, { orgId: "org_a" });
    expect(row.model).toBe("gpt-4o");
    expect(row.prompt_tokens).toBe(512);
    expect(row.completion_tokens).toBe(256);
  });

  it("lets explicit opts override auto-extraction", () => {
    const row = rowFromInternalSpan(span, {
      orgId: "org_a",
      model: "override-model",
      promptTokens: 1,
      completionTokens: 2,
    });
    expect(row.model).toBe("override-model");
    expect(row.prompt_tokens).toBe(1);
    expect(row.completion_tokens).toBe(2);
  });

  it("flattens attributes to strings and drops nulls", () => {
    const row = rowFromInternalSpan(span, { orgId: "org_a" });
    expect(row.attributes["gen_ai.request.model"]).toBe("gpt-4o");
    expect(row.attributes["gen_ai.usage.input_tokens"]).toBe("512");
    expect(row.attributes["cached"]).toBe("true");
    expect(row.attributes["nullable.attr"]).toBeUndefined();
  });

  it("converts ms timestamps to ClickHouse DateTime64 format (UTC)", () => {
    const row = rowFromInternalSpan(span, { orgId: "org_a" });
    expect(row.start_time).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{9}$/);
    expect(row.start_time).toContain("2023-11-14"); // 1_700_000_000_000 ms = 2023-11-14T22:13:20Z
  });

  it("falls back to startTime when endTime is missing", () => {
    const s: InternalSpan = { ...span, endTimeMs: undefined as unknown as number };
    const row = rowFromInternalSpan(s, { orgId: "org_a" });
    expect(row.end_time).toBe(row.start_time);
  });

  it("leaves reserved-for-later fields null (agent_id, cost, uris)", () => {
    const row = rowFromInternalSpan(span, { orgId: "org_a" });
    expect(row.agent_id).toBeNull();
    expect(row.cost_usd_micros).toBeNull();
    expect(row.input_uri).toBeNull();
    expect(row.output_uri).toBeNull();
  });
});

describe("db-analytics · msToClickHouseDateTime64", () => {
  it("rounds to a zero-padded UTC representation", () => {
    const iso = msToClickHouseDateTime64(0);
    expect(iso).toBe("1970-01-01 00:00:00.000000000");
  });
  it("preserves millisecond precision into the 9-digit subseconds field", () => {
    const iso = msToClickHouseDateTime64(1_700_000_000_123);
    expect(iso.endsWith(".123000000")).toBe(true);
  });
});

describe("db-analytics · listTraces · SQL shape guardrails", () => {
  it("org_id is ALWAYS the first WHERE predicate", () => {
    const { sql } = __buildListTracesSqlForTest({
      orgId: "org_a",
      window: { from: new Date(0), to: new Date(1) },
    });
    expect(sql.startsWith("WHERE org_id = {orgId:String}")).toBe(true);
  });

  it("parameterises all string inputs (no raw string interpolation)", () => {
    const { sql, params } = __buildListTracesSqlForTest({
      orgId: "org_a",
      window: { from: new Date(0), to: new Date(1) },
      agentId: "agent_xx",
      status: "error",
      nameContains: "llm",
    });
    // No literal orgId / agentId / search string in the SQL.
    expect(sql).not.toContain("org_a");
    expect(sql).not.toContain("agent_xx");
    expect(sql).not.toContain("'llm'");
    // Parameters are present.
    expect(params["orgId"]).toBe("org_a");
    expect(params["agentId"]).toBe("agent_xx");
    expect(params["status"]).toBe("error");
    expect(params["nameContains"]).toBe("llm");
  });

  it("adds agent / status / name filters only when supplied", () => {
    const a = __buildListTracesSqlForTest({
      orgId: "org_a",
      window: { from: new Date(0), to: new Date(1) },
    });
    expect(a.sql).not.toContain("agent_id");
    expect(a.sql).not.toContain("status =");
    expect(a.sql).not.toContain("positionCaseInsensitive");

    const b = __buildListTracesSqlForTest({
      orgId: "org_a",
      window: { from: new Date(0), to: new Date(1) },
      agentId: "a",
      status: "error",
      nameContains: "x",
    });
    expect(b.sql).toContain("agent_id = {agentId:String}");
    expect(b.sql).toContain("status = {status:String}");
    expect(b.sql).toContain("positionCaseInsensitive(name, {nameContains:String})");
  });
});

describe("db-analytics · cursor encoding round-trip", () => {
  it("decodes a freshly-encoded cursor back into the same values", () => {
    // Cursor format: base64url("<start_time>|<trace_id>")
    const enc = Buffer.from("2026-04-20 12:34:56.000000000|trace-abc", "utf8").toString(
      "base64url",
    );
    const { cursorStart, cursorTraceId } = parseCursor(enc);
    expect(cursorStart).toBe("2026-04-20 12:34:56.000000000");
    expect(cursorTraceId).toBe("trace-abc");
  });
  it("handles missing / malformed cursors gracefully", () => {
    expect(parseCursor(undefined)).toEqual({ cursorStart: null, cursorTraceId: null });
    expect(parseCursor("garbage!!!")).toEqual({ cursorStart: null, cursorTraceId: null });
  });
});
