import { performance } from "node:perf_hooks";
import { describe, expect, it, vi } from "vitest";
import type { Trace } from "@foxhound/types";
import type { SendResult, SpanTransport } from "./index.js";
import { BatchSpanProcessor } from "./batch-processor.js";

function mkTrace(id: string): Trace {
  return {
    id,
    agentId: "test-agent",
    spans: [],
    startTimeMs: Date.now(),
    endTimeMs: Date.now() + 10,
    metadata: {},
  };
}

function fakeTransport(opts: {
  delayMs?: number;
  hang?: boolean;
  failOn?: (trace: Trace) => boolean;
} = {}): {
  transport: SpanTransport;
  sent: Trace[];
  closed: () => boolean;
} {
  const sent: Trace[] = [];
  let closed = false;
  const transport: SpanTransport = {
    wireFormat: "protobuf",
    async send(trace: Trace): Promise<SendResult> {
      if (opts.hang) {
        await new Promise<never>(() => {});
      }
      if (opts.delayMs !== undefined) {
        await new Promise<void>((resolve) => setTimeout(resolve, opts.delayMs));
      }
      if (opts.failOn?.(trace)) throw new Error("transport error");
      sent.push(trace);
      return {
        status: 202,
        wireFormat: "protobuf",
        payloadBytes: 0,
        headers: new Headers(),
      };
    },
    close(): Promise<void> {
      closed = true;
      return Promise.resolve();
    },
  };
  return { transport, sent, closed: () => closed };
}

describe("sdk BatchSpanProcessor enqueue overhead", () => {
  it("keeps 10,000 enqueue calls below 100 microseconds on average", async () => {
    const { transport } = fakeTransport();
    const processor = new BatchSpanProcessor({
      transport,
      maxQueueSize: 20_000,
      maxExportBatchSize: 50_000,
      scheduleDelayMs: 60_000,
      backpressurePolicy: "drop-oldest",
    });

    const iterations = 10_000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      processor.enqueue(mkTrace(`trace-${i}`));
    }
    const elapsedMs = performance.now() - start;

    expect(elapsedMs / iterations).toBeLessThan(0.1);
    await processor.shutdown(500);
  });
});

describe("sdk BatchSpanProcessor backpressure policies", () => {
  it("drop-oldest evicts the oldest trace and retains the newest", async () => {
    const drops: Trace[] = [];
    const { transport } = fakeTransport({ hang: true });
    const processor = new BatchSpanProcessor({
      transport,
      maxQueueSize: 3,
      scheduleDelayMs: 60_000,
      backpressurePolicy: "drop-oldest",
      onDrop: (trace) => drops.push(trace),
    });

    processor.enqueue(mkTrace("t1"));
    processor.enqueue(mkTrace("t2"));
    processor.enqueue(mkTrace("t3"));
    processor.enqueue(mkTrace("t4"));

    expect(drops.map((trace) => trace.id)).toEqual(["t1"]);
    expect(processor.queueDepth).toBe(3);
    await processor.shutdown(5);
  });

  it("drop-newest refuses the incoming trace when the queue is full", async () => {
    const drops: Trace[] = [];
    const { transport } = fakeTransport({ hang: true });
    const processor = new BatchSpanProcessor({
      transport,
      maxQueueSize: 2,
      scheduleDelayMs: 60_000,
      backpressurePolicy: "drop-newest",
      onDrop: (trace) => drops.push(trace),
    });

    processor.enqueue(mkTrace("t1"));
    processor.enqueue(mkTrace("t2"));
    processor.enqueue(mkTrace("t3"));

    expect(drops.map((trace) => trace.id)).toEqual(["t3"]);
    expect(processor.queueDepth).toBe(2);
    await processor.shutdown(5);
  });

  it("block policy starts an immediate drain before accepting the incoming trace", async () => {
    const { transport, sent } = fakeTransport();
    const processor = new BatchSpanProcessor({
      transport,
      maxQueueSize: 2,
      maxExportBatchSize: 10,
      scheduleDelayMs: 60_000,
      backpressurePolicy: "block",
    });

    processor.enqueue(mkTrace("t1"));
    processor.enqueue(mkTrace("t2"));
    processor.enqueue(mkTrace("t3"));

    await processor.shutdown(500);
    expect(sent.map((trace) => trace.id).sort()).toEqual(["t1", "t2", "t3"]);
  });
});

describe("sdk BatchSpanProcessor flush and shutdown", () => {
  it("flush exports all queued traces", async () => {
    const { transport, sent } = fakeTransport();
    const processor = new BatchSpanProcessor({ transport, scheduleDelayMs: 60_000 });

    processor.enqueue(mkTrace("a"));
    processor.enqueue(mkTrace("b"));

    await expect(processor.flush(500)).resolves.toBe(true);
    expect(sent.map((trace) => trace.id)).toEqual(["a", "b"]);
    await processor.shutdown(100);
  });

  it("flush returns false within the timeout if transport hangs", async () => {
    const { transport } = fakeTransport({ hang: true });
    const processor = new BatchSpanProcessor({ transport, scheduleDelayMs: 60_000 });

    processor.enqueue(mkTrace("slow"));
    const start = performance.now();
    const drained = await processor.flush(20);
    const elapsedMs = performance.now() - start;

    expect(drained).toBe(false);
    expect(elapsedMs).toBeLessThan(250);
    await processor.shutdown(5);
  });

  it("shutdown drains, closes transport, and rejects later enqueues", async () => {
    const { transport, sent, closed } = fakeTransport();
    const drops: Trace[] = [];
    const processor = new BatchSpanProcessor({
      transport,
      scheduleDelayMs: 60_000,
      onDrop: (trace) => drops.push(trace),
    });

    processor.enqueue(mkTrace("x"));

    await expect(processor.shutdown(500)).resolves.toBe(true);
    expect(sent.map((trace) => trace.id)).toEqual(["x"]);
    expect(closed()).toBe(true);

    processor.enqueue(mkTrace("after-shutdown"));
    expect(sent).toHaveLength(1);
    expect(drops).toHaveLength(0);
  });

  it("does not deadlock when flush runs during an in-flight export", async () => {
    const { transport, sent } = fakeTransport({ delayMs: 20 });
    const processor = new BatchSpanProcessor({
      transport,
      maxExportBatchSize: 1,
      scheduleDelayMs: 60_000,
    });

    processor.enqueue(mkTrace("a"));
    processor.enqueue(mkTrace("b"));

    await expect(processor.flush(1000)).resolves.toBe(true);
    expect(sent.map((trace) => trace.id)).toEqual(["a", "b"]);
    await processor.shutdown(100);
  });
});

describe("sdk BatchSpanProcessor export errors", () => {
  it("export errors are non-fatal and successful traces still export", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { transport, sent } = fakeTransport({ failOn: (trace) => trace.id === "bad" });
    const processor = new BatchSpanProcessor({ transport, scheduleDelayMs: 60_000 });

    processor.enqueue(mkTrace("good-1"));
    processor.enqueue(mkTrace("bad"));
    processor.enqueue(mkTrace("good-2"));

    await expect(processor.flush(500)).resolves.toBe(true);
    expect(sent.map((trace) => trace.id)).toEqual(["good-1", "good-2"]);
    expect(warn).toHaveBeenCalledOnce();

    warn.mockRestore();
    await processor.shutdown(100);
  });
});

describe("sdk BatchSpanProcessor FoxhoundClient integration", () => {
  it("FoxhoundClient queues by default and shutdown drains", async () => {
    const fetchCalls: string[] = [];
    const mockFetch: typeof fetch = (input) => {
      fetchCalls.push(String(input));
      return Promise.resolve(new Response(null, { status: 202 }));
    };
    const { FoxhoundClient } = await import("../client.js");
    const fox = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "http://api.test",
      fetchImpl: mockFetch,
      wireFormat: "json",
      compression: "none",
      exportScheduleDelayMs: 60_000,
    });

    const tracer = fox.startTrace({ agentId: "test-agent" });
    tracer.startSpan({ name: "step", kind: "agent_step" }).end("ok");
    await tracer.flush();

    expect(fetchCalls).toHaveLength(0);
    await expect(fox.shutdown(500)).resolves.toBe(true);
    expect(fetchCalls).toEqual(["http://api.test/v1/traces"]);
  });

  it("FoxhoundClient can opt out with maxQueueSize 0 for inline export", async () => {
    const fetchCalls: string[] = [];
    const mockFetch: typeof fetch = (input) => {
      fetchCalls.push(String(input));
      return Promise.resolve(new Response(null, { status: 202 }));
    };
    const { FoxhoundClient } = await import("../client.js");
    const fox = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "http://api.test",
      fetchImpl: mockFetch,
      wireFormat: "json",
      compression: "none",
      maxQueueSize: 0,
    });

    const tracer = fox.startTrace({ agentId: "test-agent" });
    tracer.startSpan({ name: "step", kind: "agent_step" }).end("ok");
    await tracer.flush();

    expect(fetchCalls).toHaveLength(1);
  });
});
