import { describe, it, expect } from "vitest";
import type { Trace } from "@foxhound/types";
import { Tracer } from "../tracer.js";
import {
  FoxhoundSpanProcessor,
  type OtelReadableSpan,
  type OtelReadWriteSpan,
  type OtelStatus,
} from "./opentelemetry.js";

// ---------------------------------------------------------------------------
// Test helpers — mirror pattern from claude-agent.test.ts
// ---------------------------------------------------------------------------

function makeTracer(): { processor: FoxhoundSpanProcessor; flushed: Trace[] } {
  const flushed: Trace[] = [];
  const inner = new Tracer({
    agentId: "test-otel-agent",
    metadata: {},
    onFlush: (trace) => {
      flushed.push(trace);
      return Promise.resolve();
    },
  });
  const processor = new FoxhoundSpanProcessor(inner);
  return { processor, flushed };
}

function spansByName(flushed: Trace[]): Record<string, Trace["spans"][number]> {
  const result: Record<string, Trace["spans"][number]> = {};
  for (const span of flushed[0]!.spans) {
    result[span.name] = span;
  }
  return result;
}

// OTel status code values (mirrors @opentelemetry/api StatusCode enum)
const STATUS_UNSET = 0;
const STATUS_OK = 1;
const STATUS_ERROR = 2;

/** Build a minimal mock OTel span (read-write shape, used in onStart). */
function makeOtelSpan(overrides: {
  name?: string;
  spanId?: string;
  traceId?: string;
  parentSpanId?: string;
  attributes?: Record<string, unknown>;
  statusCode?: number;
}): OtelReadWriteSpan {
  const {
    name = "test-span",
    spanId = "abcd1234abcd1234",
    traceId = "deadbeefdeadbeefdeadbeefdeadbeef",
    parentSpanId,
    attributes = {},
    statusCode = STATUS_UNSET,
  } = overrides;

  const status: OtelStatus = { code: statusCode };

  return {
    name,
    spanContext: () => ({ traceId, spanId, traceFlags: 1 }),
    parentSpanId,
    status,
    attributes,
  };
}

/** Build a minimal readable span (for onEnd — same shape). */
function makeReadableSpan(overrides: Parameters<typeof makeOtelSpan>[0]): OtelReadableSpan {
  return makeOtelSpan(overrides);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FoxhoundSpanProcessor", () => {
  describe("onStart + onEnd lifecycle", () => {
    it("produces a Fox span with correct name and kind", async () => {
      const { processor, flushed } = makeTracer();

      const span = makeOtelSpan({
        name: "llm-call",
        attributes: { "gen_ai.operation.name": "chat" },
      });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "llm-call", attributes: { "gen_ai.operation.name": "chat" } }));
      await processor.forceFlush();

      const spans = spansByName(flushed);
      expect(spans["llm-call"]).toBeDefined();
      expect(spans["llm-call"]!.kind).toBe("llm_call");
      expect(spans["llm-call"]!.status).toBe("ok");
    });

    it("span map cleared after onEnd", async () => {
      const { processor, flushed } = makeTracer();

      const span = makeOtelSpan({ name: "s1", spanId: "aaaa0001aaaa0001" });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "s1", spanId: "aaaa0001aaaa0001" }));

      // second onEnd with same id should be a no-op (span already removed)
      processor.onEnd(makeReadableSpan({ name: "s1", spanId: "aaaa0001aaaa0001" }));

      await processor.forceFlush();
      expect(flushed[0]!.spans).toHaveLength(1);
    });
  });

  describe("semanticToFoxKind — semantic convention mapping", () => {
    const cases: Array<{
      desc: string;
      attrs: Record<string, unknown>;
      name?: string;
      expectedKind: string;
    }> = [
      { desc: "chat → llm_call", attrs: { "gen_ai.operation.name": "chat" }, expectedKind: "llm_call" },
      { desc: "text_completion → llm_call", attrs: { "gen_ai.operation.name": "text_completion" }, expectedKind: "llm_call" },
      { desc: "embeddings → tool_call", attrs: { "gen_ai.operation.name": "embeddings" }, expectedKind: "tool_call" },
      { desc: "agent → agent_step", attrs: { "gen_ai.operation.name": "agent" }, expectedKind: "agent_step" },
      { desc: "invoke → agent_step", attrs: { "gen_ai.operation.name": "invoke" }, expectedKind: "agent_step" },
      { desc: "tool → tool_call", attrs: { "gen_ai.operation.name": "tool" }, expectedKind: "tool_call" },
      { desc: "execute → tool_call", attrs: { "gen_ai.operation.name": "execute" }, expectedKind: "tool_call" },
      { desc: "unknown op → workflow", attrs: { "gen_ai.operation.name": "unknown" }, expectedKind: "workflow" },
      { desc: "no op attr → workflow", attrs: {}, expectedKind: "workflow" },
      // Name-based heuristics
      { desc: "name starts with agent → agent_step", attrs: {}, name: "agent.run", expectedKind: "agent_step" },
      { desc: "name starts with tool → tool_call", attrs: {}, name: "tool.bash", expectedKind: "tool_call" },
      { desc: "other name → workflow", attrs: {}, name: "my-span", expectedKind: "workflow" },
    ];

    for (const { desc, attrs, name, expectedKind } of cases) {
      it(desc, async () => {
        const { processor, flushed } = makeTracer();
        const spanName = name ?? "test-span";
        const span = makeOtelSpan({ name: spanName, attributes: attrs });
        processor.onStart(span, null);
        processor.onEnd(makeReadableSpan({ name: spanName, attributes: attrs }));
        await processor.forceFlush();
        const spans = spansByName(flushed);
        expect(spans[spanName]!.kind).toBe(expectedKind);
      });
    }
  });

  describe("extractAttributes — GenAI attribute mapping", () => {
    it("maps gen_ai.request.model to llm.model", async () => {
      const { processor, flushed } = makeTracer();
      const attrs = { "gen_ai.request.model": "gpt-4o" };
      const span = makeOtelSpan({ name: "llm", attributes: attrs });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "llm", attributes: attrs }));
      await processor.forceFlush();
      expect(spansByName(flushed)["llm"]!.attributes["llm.model"]).toBe("gpt-4o");
    });

    it("maps gen_ai.usage.input_tokens to llm.prompt_tokens", async () => {
      const { processor, flushed } = makeTracer();
      const attrs = { "gen_ai.usage.input_tokens": 100 };
      const span = makeOtelSpan({ name: "llm", attributes: attrs });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "llm", attributes: attrs }));
      await processor.forceFlush();
      expect(spansByName(flushed)["llm"]!.attributes["llm.prompt_tokens"]).toBe(100);
    });

    it("maps gen_ai.usage.output_tokens to llm.completion_tokens", async () => {
      const { processor, flushed } = makeTracer();
      const attrs = { "gen_ai.usage.output_tokens": 50 };
      const span = makeOtelSpan({ name: "llm", attributes: attrs });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "llm", attributes: attrs }));
      await processor.forceFlush();
      expect(spansByName(flushed)["llm"]!.attributes["llm.completion_tokens"]).toBe(50);
    });

    it("maps gen_ai.usage.total_tokens to llm.total_tokens", async () => {
      const { processor, flushed } = makeTracer();
      const attrs = { "gen_ai.usage.total_tokens": 150 };
      const span = makeOtelSpan({ name: "llm", attributes: attrs });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "llm", attributes: attrs }));
      await processor.forceFlush();
      expect(spansByName(flushed)["llm"]!.attributes["llm.total_tokens"]).toBe(150);
    });

    it("maps all five GenAI attributes together", async () => {
      const { processor, flushed } = makeTracer();
      const attrs = {
        "gen_ai.operation.name": "chat",
        "gen_ai.request.model": "claude-3-haiku",
        "gen_ai.usage.input_tokens": 200,
        "gen_ai.usage.output_tokens": 80,
        "gen_ai.usage.total_tokens": 280,
        "gen_ai.prompt": "Summarise this document",
      };
      const span = makeOtelSpan({ name: "chat", attributes: attrs });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "chat", attributes: attrs }));
      await processor.forceFlush();
      const s = spansByName(flushed)["chat"]!;
      expect(s.attributes["llm.model"]).toBe("claude-3-haiku");
      expect(s.attributes["llm.prompt_tokens"]).toBe(200);
      expect(s.attributes["llm.completion_tokens"]).toBe(80);
      expect(s.attributes["llm.total_tokens"]).toBe(280);
      expect(s.attributes["agent.prompt"]).toBe("Summarise this document");
    });

    it("does not emit attributes that are absent from the OTel span", async () => {
      const { processor, flushed } = makeTracer();
      const span = makeOtelSpan({ name: "empty", attributes: {} });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "empty", attributes: {} }));
      await processor.forceFlush();
      const s = spansByName(flushed)["empty"]!;
      expect(s.attributes["llm.model"]).toBeUndefined();
      expect(s.attributes["llm.prompt_tokens"]).toBeUndefined();
    });
  });

  describe("prompt truncation", () => {
    it("truncates gen_ai.prompt at 512 chars", async () => {
      const { processor, flushed } = makeTracer();
      const longPrompt = "x".repeat(1000);
      const attrs = { "gen_ai.prompt": longPrompt };
      const span = makeOtelSpan({ name: "llm", attributes: attrs });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "llm", attributes: attrs }));
      await processor.forceFlush();
      const prompt = spansByName(flushed)["llm"]!.attributes["agent.prompt"];
      expect(typeof prompt).toBe("string");
      expect((prompt as string).length).toBe(512);
      expect(prompt).toBe("x".repeat(512));
    });

    it("keeps short prompts unchanged", async () => {
      const { processor, flushed } = makeTracer();
      const attrs = { "gen_ai.prompt": "short" };
      const span = makeOtelSpan({ name: "llm", attributes: attrs });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "llm", attributes: attrs }));
      await processor.forceFlush();
      expect(spansByName(flushed)["llm"]!.attributes["agent.prompt"]).toBe("short");
    });

    it("truncates exactly at boundary (512 chars)", async () => {
      const { processor, flushed } = makeTracer();
      const exactPrompt = "a".repeat(512);
      const attrs = { "gen_ai.prompt": exactPrompt };
      const span = makeOtelSpan({ name: "llm", attributes: attrs });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "llm", attributes: attrs }));
      await processor.forceFlush();
      expect((spansByName(flushed)["llm"]!.attributes["agent.prompt"] as string).length).toBe(512);
    });
  });

  describe("parent span ID propagation", () => {
    it("links child span to parent span via parentSpanId", async () => {
      const { processor, flushed } = makeTracer();

      const parentOtelId = "parent0000000001";
      const childOtelId =  "child00000000001";

      const parentSpan = makeOtelSpan({ name: "parent", spanId: parentOtelId });
      const childSpan = makeOtelSpan({
        name: "child",
        spanId: childOtelId,
        parentSpanId: parentOtelId,
      });

      processor.onStart(parentSpan, null);
      processor.onStart(childSpan, null);
      processor.onEnd(makeReadableSpan({ name: "child", spanId: childOtelId, parentSpanId: parentOtelId }));
      processor.onEnd(makeReadableSpan({ name: "parent", spanId: parentOtelId }));
      await processor.forceFlush();

      const spans = spansByName(flushed);
      const parentFoxSpan = spans["parent"]!;
      const childFoxSpan = spans["child"]!;

      expect(parentFoxSpan).toBeDefined();
      expect(childFoxSpan).toBeDefined();
      expect(childFoxSpan.parentSpanId).toBe(parentFoxSpan.spanId);
    });

    it("span with no parent has no parentSpanId", async () => {
      const { processor, flushed } = makeTracer();
      const span = makeOtelSpan({ name: "root" });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "root" }));
      await processor.forceFlush();
      expect(spansByName(flushed)["root"]!.parentSpanId).toBeUndefined();
    });
  });

  describe("error status mapping", () => {
    it("maps OTel STATUS_ERROR to Fox error status", async () => {
      const { processor, flushed } = makeTracer();
      const span = makeOtelSpan({ name: "failing", statusCode: STATUS_ERROR });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "failing", statusCode: STATUS_ERROR }));
      await processor.forceFlush();
      expect(spansByName(flushed)["failing"]!.status).toBe("error");
    });

    it("maps OTel STATUS_OK to Fox ok status", async () => {
      const { processor, flushed } = makeTracer();
      const span = makeOtelSpan({ name: "ok-span", statusCode: STATUS_OK });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "ok-span", statusCode: STATUS_OK }));
      await processor.forceFlush();
      expect(spansByName(flushed)["ok-span"]!.status).toBe("ok");
    });

    it("maps OTel STATUS_UNSET to Fox ok status", async () => {
      const { processor, flushed } = makeTracer();
      const span = makeOtelSpan({ name: "unset-span", statusCode: STATUS_UNSET });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "unset-span", statusCode: STATUS_UNSET }));
      await processor.forceFlush();
      expect(spansByName(flushed)["unset-span"]!.status).toBe("ok");
    });
  });

  describe("shutdown and forceFlush", () => {
    it("shutdown calls flush and resolves", async () => {
      const { processor, flushed } = makeTracer();
      const span = makeOtelSpan({ name: "s", attributes: { "gen_ai.operation.name": "chat" } });
      processor.onStart(span, null);
      processor.onEnd(makeReadableSpan({ name: "s", attributes: { "gen_ai.operation.name": "chat" } }));
      await processor.shutdown();
      expect(flushed).toHaveLength(1);
    });

    it("forceFlush resolves", async () => {
      const { processor, flushed } = makeTracer();
      await processor.forceFlush();
      expect(flushed).toHaveLength(1);
    });
  });

  describe("malformed / edge-case spans", () => {
    it("skips span with missing traceId (no fox span emitted)", async () => {
      const { processor, flushed } = makeTracer();
      const bad: OtelReadWriteSpan = {
        name: "bad-span",
        spanContext: () => ({ traceId: "", spanId: "abc", traceFlags: 0 }),
        parentSpanId: undefined,
        status: { code: STATUS_UNSET },
        attributes: {},
      };
      processor.onStart(bad, null);
      processor.onEnd(bad);
      await processor.forceFlush();
      // Flush should succeed but produce no spans from this bad input
      expect(flushed[0]!.spans).toHaveLength(0);
    });

    it("onEnd for unknown spanId is a no-op", async () => {
      const { processor, flushed } = makeTracer();
      // Don't call onStart — just call onEnd with a span not in the map
      processor.onEnd(makeReadableSpan({ name: "ghost", spanId: "9999999999999999" }));
      await processor.forceFlush();
      expect(flushed[0]!.spans).toHaveLength(0);
    });
  });

  describe("fromClient factory", () => {
    it("exposes traceId from the underlying tracer", () => {
      const { processor } = makeTracer();
      expect(typeof processor.traceId).toBe("string");
      expect(processor.traceId.length).toBeGreaterThan(0);
    });
  });
});
