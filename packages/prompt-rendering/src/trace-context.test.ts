import { describe, it, expect } from "vitest";
import { extractTraceContext, renderPromptForTrace } from "./trace-context.js";
import type { TraceLike } from "./types.js";

const traceFixture: TraceLike = {
  spans: [
    {
      name: "ingress",
      kind: "internal",
      attributes: { input: "user question", api_key: "sk-leak" },
      events: [],
    },
    {
      name: "egress",
      kind: "internal",
      attributes: { output: "answer", authorization: "Bearer t" },
      events: [],
    },
  ],
  metadata: { tenant: "acme", session_id: "abc" },
};

describe("extractTraceContext", () => {
  it("returns input from first span attribute", () => {
    expect(extractTraceContext(traceFixture).input).toBe("user question");
  });

  it("returns output from last span attribute", () => {
    expect(extractTraceContext(traceFixture).output).toBe("answer");
  });

  it("redacts sensitive span attributes before serialising", () => {
    const ctx = extractTraceContext(traceFixture);
    expect(ctx.spans).not.toContain("sk-leak");
    expect(ctx.spans).not.toContain("Bearer t");
    expect(ctx.spans).toContain("[REDACTED]");
  });

  it("redacts sensitive metadata before serialising", () => {
    const ctx = extractTraceContext(traceFixture);
    expect(ctx.metadata).not.toContain("abc");
    expect(ctx.metadata).toContain("[REDACTED]");
  });

  it("reports span count as a string for template-friendliness", () => {
    expect(extractTraceContext(traceFixture).spanCount).toBe("2");
  });

  it("handles a trace with zero spans", () => {
    const empty: TraceLike = { spans: [], metadata: {} };
    const ctx = extractTraceContext(empty);
    expect(ctx.spanCount).toBe("0");
    expect(ctx.input).toBe("{}");
    expect(ctx.output).toBe("{}");
  });
});

describe("renderPromptForTrace", () => {
  it("substitutes trace context values into a template", () => {
    const out = renderPromptForTrace("Q: {{input}} A: {{output}}", traceFixture);
    expect(out).toBe("Q: user question A: answer");
  });

  it("preserves unknown placeholders", () => {
    const out = renderPromptForTrace("Hello {{nope}}", traceFixture);
    expect(out).toBe("Hello {{nope}}");
  });

  it("never leaks redacted span data into the rendered prompt", () => {
    const out = renderPromptForTrace("{{spans}}", traceFixture);
    expect(out).not.toContain("sk-leak");
    expect(out).not.toContain("Bearer t");
  });
});
