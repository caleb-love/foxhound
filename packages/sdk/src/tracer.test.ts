import { describe, it, expect, vi, beforeEach } from "vitest";
import { Tracer, ActiveSpan } from "./tracer.js";

function makeTracer(overrides?: Partial<ConstructorParameters<typeof Tracer>[0]>) {
  const onFlush = vi.fn().mockResolvedValue(undefined);
  const tracer = new Tracer({
    agentId: "agent_1",
    metadata: {},
    onFlush,
    ...overrides,
  });
  return { tracer, onFlush };
}

// ---------------------------------------------------------------------------
// Tracer — identity
// ---------------------------------------------------------------------------

describe("Tracer — traceId", () => {
  it("assigns a non-empty traceId on construction", () => {
    const { tracer } = makeTracer();
    expect(typeof tracer.traceId).toBe("string");
    expect(tracer.traceId.length).toBeGreaterThan(0);
  });

  it("each Tracer instance has a unique traceId", () => {
    const { tracer: t1 } = makeTracer();
    const { tracer: t2 } = makeTracer();
    expect(t1.traceId).not.toBe(t2.traceId);
  });
});

// ---------------------------------------------------------------------------
// Tracer — startSpan
// ---------------------------------------------------------------------------

describe("Tracer.startSpan()", () => {
  it("returns an ActiveSpan", () => {
    const { tracer } = makeTracer();
    const span = tracer.startSpan({ name: "step", kind: "agent_step" });
    expect(span).toBeInstanceOf(ActiveSpan);
  });

  it("assigns a unique spanId to each span", () => {
    const { tracer } = makeTracer();
    const s1 = tracer.startSpan({ name: "s1", kind: "agent_step" });
    const s2 = tracer.startSpan({ name: "s2", kind: "tool_call" });
    expect(s1.spanId).not.toBe(s2.spanId);
  });

  it("stores the span in the tracer's span collection (visible after flush)", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "my-span", kind: "llm_call" });
    await tracer.flush();
    const trace = onFlush.mock.calls[0][0];
    expect(trace.spans).toHaveLength(1);
    expect(trace.spans[0].name).toBe("my-span");
  });

  it("attaches parentSpanId when provided", async () => {
    const { tracer, onFlush } = makeTracer();
    const parent = tracer.startSpan({ name: "parent", kind: "agent_step" });
    tracer.startSpan({ name: "child", kind: "tool_call", parentSpanId: parent.spanId });
    await tracer.flush();

    const trace = onFlush.mock.calls[0][0];
    const child = trace.spans.find((s: { name: string }) => s.name === "child");
    expect(child?.parentSpanId).toBe(parent.spanId);
  });

  it("sets initial attributes on the span", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s", kind: "custom", attributes: { key: "value", num: 42 } });
    await tracer.flush();
    const trace = onFlush.mock.calls[0][0];
    expect(trace.spans[0].attributes).toEqual({ key: "value", num: 42 });
  });

  it("spans without attributes default to empty object", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s", kind: "workflow" });
    await tracer.flush();
    const trace = onFlush.mock.calls[0][0];
    expect(trace.spans[0].attributes).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Tracer — flush
// ---------------------------------------------------------------------------

describe("Tracer.flush()", () => {
  it("calls onFlush with the correct trace shape", async () => {
    const { tracer, onFlush } = makeTracer({ agentId: "agent_99", metadata: { env: "prod" } });
    await tracer.flush();

    const trace = onFlush.mock.calls[0][0];
    expect(trace.id).toBe(tracer.traceId);
    expect(trace.agentId).toBe("agent_99");
    expect(trace.metadata).toEqual({ env: "prod" });
    expect(Array.isArray(trace.spans)).toBe(true);
    expect(typeof trace.startTimeMs).toBe("number");
    expect(typeof trace.endTimeMs).toBe("number");
  });

  it("includes all spans created before flush", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s1", kind: "agent_step" });
    tracer.startSpan({ name: "s2", kind: "tool_call" });
    tracer.startSpan({ name: "s3", kind: "llm_call" });
    await tracer.flush();

    const trace = onFlush.mock.calls[0][0];
    expect(trace.spans).toHaveLength(3);
  });

  it("propagates errors thrown by onFlush", async () => {
    const { tracer, onFlush } = makeTracer();
    onFlush.mockRejectedValue(new Error("send failed"));
    await expect(tracer.flush()).rejects.toThrow("send failed");
  });

  it("passes sessionId when provided", async () => {
    const { tracer, onFlush } = makeTracer({ sessionId: "sess_abc" });
    await tracer.flush();
    const trace = onFlush.mock.calls[0][0];
    expect(trace.sessionId).toBe("sess_abc");
  });

  it("omits sessionId when not provided", async () => {
    const { tracer, onFlush } = makeTracer();
    await tracer.flush();
    const trace = onFlush.mock.calls[0][0];
    expect(trace.sessionId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ActiveSpan — setAttribute
// ---------------------------------------------------------------------------

describe("ActiveSpan.setAttribute()", () => {
  beforeEach(() => {});

  it("is chainable (returns this)", () => {
    const { tracer } = makeTracer();
    const span = tracer.startSpan({ name: "s", kind: "agent_step" });
    const result = span.setAttribute("key", "value");
    expect(result).toBe(span);
  });

  it("sets a string attribute", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s", kind: "agent_step" }).setAttribute("model", "gpt-4");
    await tracer.flush();
    const trace = onFlush.mock.calls[0][0];
    expect(trace.spans[0].attributes["model"]).toBe("gpt-4");
  });

  it("sets a numeric attribute", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s", kind: "llm_call" }).setAttribute("tokens", 512);
    await tracer.flush();
    const trace = onFlush.mock.calls[0][0];
    expect(trace.spans[0].attributes["tokens"]).toBe(512);
  });

  it("sets a boolean attribute", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s", kind: "tool_call" }).setAttribute("cached", true);
    await tracer.flush();
    const trace = onFlush.mock.calls[0][0];
    expect(trace.spans[0].attributes["cached"]).toBe(true);
  });

  it("allows chaining multiple setAttribute calls", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s", kind: "agent_step" })
      .setAttribute("a", 1)
      .setAttribute("b", "two")
      .setAttribute("c", false);
    await tracer.flush();
    const attrs = onFlush.mock.calls[0][0].spans[0].attributes;
    expect(attrs).toEqual({ a: 1, b: "two", c: false });
  });
});

// ---------------------------------------------------------------------------
// ActiveSpan — addEvent
// ---------------------------------------------------------------------------

describe("ActiveSpan.addEvent()", () => {
  it("is chainable (returns this)", () => {
    const { tracer } = makeTracer();
    const span = tracer.startSpan({ name: "s", kind: "agent_step" });
    const result = span.addEvent("my-event");
    expect(result).toBe(span);
  });

  it("appends an event with the given name", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s", kind: "agent_step" }).addEvent("tool_called");
    await tracer.flush();
    const events = onFlush.mock.calls[0][0].spans[0].events;
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("tool_called");
  });

  it("sets a numeric timeMs on the event", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s", kind: "agent_step" }).addEvent("ping");
    await tracer.flush();
    const event = onFlush.mock.calls[0][0].spans[0].events[0];
    expect(typeof event.timeMs).toBe("number");
    expect(event.timeMs).toBeGreaterThan(0);
  });

  it("attaches event attributes when provided", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s", kind: "agent_step" }).addEvent("retry", { attempt: 2 });
    await tracer.flush();
    const event = onFlush.mock.calls[0][0].spans[0].events[0];
    expect(event.attributes).toEqual({ attempt: 2 });
  });

  it("defaults event attributes to empty object when not provided", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s", kind: "agent_step" }).addEvent("ping");
    await tracer.flush();
    const event = onFlush.mock.calls[0][0].spans[0].events[0];
    expect(event.attributes).toEqual({});
  });

  it("accumulates multiple events in order", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s", kind: "agent_step" })
      .addEvent("first")
      .addEvent("second");
    await tracer.flush();
    const events = onFlush.mock.calls[0][0].spans[0].events;
    expect(events).toHaveLength(2);
    expect(events[0].name).toBe("first");
    expect(events[1].name).toBe("second");
  });
});

// ---------------------------------------------------------------------------
// ActiveSpan — end
// ---------------------------------------------------------------------------

describe("ActiveSpan.end()", () => {
  it("sets status to ok by default", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s", kind: "agent_step" }).end();
    await tracer.flush();
    expect(onFlush.mock.calls[0][0].spans[0].status).toBe("ok");
  });

  it("sets status to error when passed error", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s", kind: "agent_step" }).end("error");
    await tracer.flush();
    expect(onFlush.mock.calls[0][0].spans[0].status).toBe("error");
  });

  it("sets a numeric endTimeMs on the span", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s", kind: "agent_step" }).end();
    await tracer.flush();
    const span = onFlush.mock.calls[0][0].spans[0];
    expect(typeof span.endTimeMs).toBe("number");
    expect(span.endTimeMs).toBeGreaterThanOrEqual(span.startTimeMs);
  });

  it("span remains in unset status if end() not called", async () => {
    const { tracer, onFlush } = makeTracer();
    tracer.startSpan({ name: "s", kind: "agent_step" });
    await tracer.flush();
    expect(onFlush.mock.calls[0][0].spans[0].status).toBe("unset");
  });
});

// ---------------------------------------------------------------------------
// Nested spans — parentSpanId threading
// ---------------------------------------------------------------------------

describe("Nested spans", () => {
  it("child span carries parent's spanId", async () => {
    const { tracer, onFlush } = makeTracer();
    const parent = tracer.startSpan({ name: "parent", kind: "workflow" });
    tracer.startSpan({ name: "child", kind: "agent_step", parentSpanId: parent.spanId });
    await tracer.flush();

    const trace = onFlush.mock.calls[0][0];
    const child = trace.spans.find((s: { name: string }) => s.name === "child");
    expect(child?.parentSpanId).toBe(parent.spanId);
  });

  it("deeply nested span chain is preserved", async () => {
    const { tracer, onFlush } = makeTracer();
    const grandparent = tracer.startSpan({ name: "gp", kind: "workflow" });
    const parent = tracer.startSpan({ name: "p", kind: "agent_step", parentSpanId: grandparent.spanId });
    tracer.startSpan({ name: "child", kind: "tool_call", parentSpanId: parent.spanId });
    await tracer.flush();

    const trace = onFlush.mock.calls[0][0];
    const child = trace.spans.find((s: { name: string }) => s.name === "child");
    const p = trace.spans.find((s: { name: string }) => s.name === "p");
    expect(child?.parentSpanId).toBe(parent.spanId);
    expect(p?.parentSpanId).toBe(grandparent.spanId);
  });
});
