import { describe, it, expect } from "vitest";
import type { Trace } from "@foxhound/types";
import { Tracer } from "../tracer.js";
import { FoxClaudeTracer } from "./claude-agent.js";

function makeTracer(): { tracer: FoxClaudeTracer; flushed: Trace[] } {
  const flushed: Trace[] = [];
  const inner = new Tracer({
    agentId: "test-claude-agent",
    metadata: {},
    onFlush: async (trace) => {
      flushed.push(trace);
    },
  });
  return { tracer: new FoxClaudeTracer(inner), flushed };
}

function spansByName(flushed: Trace[]): Record<string, Trace["spans"][number]> {
  const result: Record<string, Trace["spans"][number]> = {};
  for (const span of flushed[0]!.spans) {
    result[span.name] = span;
  }
  return result;
}

// Mock message constructors that set constructor.name
function makeAssistantMessage(overrides: Record<string, unknown> = {}): unknown {
  const msg = {
    model: "claude-sonnet-4-20250514",
    usage: { input_tokens: 100, output_tokens: 50 },
    content: [],
    ...overrides,
  };
  Object.defineProperty(msg, "constructor", { value: { name: "AssistantMessage" } });
  return msg;
}

function makeResultMessage(overrides: Record<string, unknown> = {}): unknown {
  const msg = {
    cost_usd: 0.003,
    duration_ms: 1500,
    ...overrides,
  };
  Object.defineProperty(msg, "constructor", { value: { name: "ResultMessage" } });
  return msg;
}

describe("FoxClaudeTracer", () => {
  it("creates workflow span", async () => {
    const { tracer, flushed } = makeTracer();
    tracer.startWorkflow("Write a script");
    tracer.endWorkflow();
    await tracer.flush();

    const spans = spansByName(flushed);
    expect(spans["claude-agent"]).toBeDefined();
    expect(spans["claude-agent"]!.kind).toBe("workflow");
    expect(spans["claude-agent"]!.status).toBe("ok");
    expect(spans["claude-agent"]!.attributes["agent.prompt"]).toBe("Write a script");
  });

  it("records LLM call from AssistantMessage", async () => {
    const { tracer, flushed } = makeTracer();
    tracer.startWorkflow();
    tracer.onMessage(makeAssistantMessage());
    tracer.endWorkflow();
    await tracer.flush();

    const spans = spansByName(flushed);
    expect(spans["llm:claude:turn-1"]).toBeDefined();
    expect(spans["llm:claude:turn-1"]!.kind).toBe("llm_call");
    expect(spans["llm:claude:turn-1"]!.attributes["llm.model"]).toBe("claude-sonnet-4-20250514");
    expect(spans["llm:claude:turn-1"]!.attributes["llm.prompt_tokens"]).toBe(100);
    expect(spans["llm:claude:turn-1"]!.attributes["llm.completion_tokens"]).toBe(50);
  });

  it("records sequential turns", async () => {
    const { tracer, flushed } = makeTracer();
    tracer.startWorkflow();
    tracer.onMessage(makeAssistantMessage());
    tracer.onMessage(makeAssistantMessage());
    tracer.endWorkflow();
    await tracer.flush();

    const llmSpans = flushed[0]!.spans.filter((s) => s.kind === "llm_call");
    expect(llmSpans).toHaveLength(2);
    expect(llmSpans[0]!.name).toBe("llm:claude:turn-1");
    expect(llmSpans[1]!.name).toBe("llm:claude:turn-2");
  });

  it("records tool use via hooks", async () => {
    const { tracer, flushed } = makeTracer();
    tracer.startWorkflow();

    await tracer.onPreToolUse("Bash", { command: "echo hello" }, "tu_1");
    await tracer.onPostToolUse("tu_1", "hello\n");

    tracer.endWorkflow();
    await tracer.flush();

    const spans = spansByName(flushed);
    expect(spans["tool:Bash"]).toBeDefined();
    expect(spans["tool:Bash"]!.kind).toBe("tool_call");
    expect(spans["tool:Bash"]!.status).toBe("ok");
    expect(spans["tool:Bash"]!.attributes["tool.name"]).toBe("Bash");
    expect(spans["tool:Bash"]!.attributes["tool.input.command"]).toBe("echo hello");
    expect(spans["tool:Bash"]!.attributes["tool.output"]).toBe("hello\n");
  });

  it("records tool error", async () => {
    const { tracer, flushed } = makeTracer();
    tracer.startWorkflow();

    await tracer.onPreToolUse("Read", { path: "/missing" }, "tu_2");
    await tracer.onPostToolUse("tu_2", undefined, "File not found");

    tracer.endWorkflow();
    await tracer.flush();

    const spans = spansByName(flushed);
    expect(spans["tool:Read"]!.status).toBe("error");
    expect(spans["tool:Read"]!.events.some((e) => e.name === "error")).toBe(true);
  });

  it("captures cost from ResultMessage", async () => {
    const { tracer, flushed } = makeTracer();
    tracer.startWorkflow();
    tracer.onMessage(makeResultMessage({ cost_usd: 0.005, duration_ms: 2000 }));
    tracer.endWorkflow();
    await tracer.flush();

    const spans = spansByName(flushed);
    expect(spans["claude-agent"]!.attributes["agent.cost_usd"]).toBe(0.005);
    expect(spans["claude-agent"]!.attributes["agent.duration_ms"]).toBe(2000);
  });

  it("ends unclosed tool spans on flush", async () => {
    const { tracer, flushed } = makeTracer();
    tracer.startWorkflow();
    await tracer.onPreToolUse("Bash", { command: "sleep 999" }, "tu_orphan");
    tracer.endWorkflow();
    await tracer.flush();

    const spans = spansByName(flushed);
    expect(spans["tool:Bash"]!.status).toBe("error");
  });

  it("parents all spans under workflow", async () => {
    const { tracer, flushed } = makeTracer();
    tracer.startWorkflow();
    tracer.onMessage(makeAssistantMessage());
    await tracer.onPreToolUse("Write", { path: "test.py" }, "tu_3");
    await tracer.onPostToolUse("tu_3", "ok");
    tracer.endWorkflow();
    await tracer.flush();

    const spans = flushed[0]!.spans;
    const workflowSpan = spans.find((s) => s.kind === "workflow")!;
    for (const s of spans) {
      if (s.kind !== "workflow") {
        expect(s.parentSpanId).toBe(workflowSpan.spanId);
      }
    }
  });

  it("exposes trace ID", () => {
    const { tracer } = makeTracer();
    expect(tracer.traceId).toBeTruthy();
    expect(typeof tracer.traceId).toBe("string");
  });
});
