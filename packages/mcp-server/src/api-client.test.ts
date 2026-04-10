import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FoxhoundApiClient } from "@foxhound/api-client";
import type { Trace, Span } from "@foxhound/types";

describe("FoxhoundApiClient", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function makeClient(): FoxhoundApiClient {
    return new FoxhoundApiClient({
      endpoint: "https://api.foxhound.dev",
      apiKey: "fox_test_key",
    });
  }

  function mockOk(body: unknown): void {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(body),
    });
  }

  it("searchTraces sends correct URL and auth header", async () => {
    const client = makeClient();
    mockOk({ data: [], pagination: { page: 1, limit: 20, count: 0 } });

    await client.searchTraces({ agentId: "my-agent", limit: 10 });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.foxhound.dev/v1/traces?agentId=my-agent&limit=10");
    expect(opts.headers).toMatchObject({
      Authorization: "Bearer fox_test_key",
    });
  });

  it("searchTraces includes time range params", async () => {
    const client = makeClient();
    mockOk({ data: [], pagination: { page: 1, limit: 20, count: 0 } });

    await client.searchTraces({ from: 1000, to: 2000 });

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("from=1000");
    expect(url).toContain("to=2000");
  });

  it("getTrace fetches correct URL", async () => {
    const client = makeClient();
    mockOk({ id: "trace-123", spans: [] });

    await client.getTrace("trace-123");

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe("https://api.foxhound.dev/v1/traces/trace-123");
  });

  it("replaySpan fetches correct URL", async () => {
    const client = makeClient();
    mockOk({ context: {} });

    await client.replaySpan("trace-1", "span-2");

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe("https://api.foxhound.dev/v1/traces/trace-1/spans/span-2/replay");
  });

  it("diffRuns sends runA and runB as query params", async () => {
    const client = makeClient();
    mockOk({ diff: {} });

    await client.diffRuns("run-a", "run-b");

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe("https://api.foxhound.dev/v1/runs/diff?runA=run-a&runB=run-b");
  });

  it("throws on non-OK response", async () => {
    const client = makeClient();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve("Not Found"),
    });

    await expect(client.getTrace("missing")).rejects.toThrow("Foxhound API 404");
  });

  it("strips trailing slashes from endpoint", async () => {
    const client = new FoxhoundApiClient({
      endpoint: "https://api.foxhound.dev///",
      apiKey: "key",
    });
    mockOk({ data: [] });

    await client.searchTraces({});

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url.startsWith("https://api.foxhound.dev/v1/traces")).toBe(true);
  });
});

describe("failure analysis", () => {
  function makeSpan(
    overrides: Partial<Span> & Pick<Span, "spanId" | "name">,
  ): Span {
    return {
      traceId: "trace-1",
      kind: "custom",
      startTimeMs: Date.now(),
      status: "ok",
      attributes: {},
      events: [],
      ...overrides,
    };
  }

  function makeTrace(spans: Span[]): Trace {
    return {
      id: "trace-1",
      agentId: "test-agent",
      spans,
      startTimeMs: spans[0]?.startTimeMs ?? Date.now(),
      endTimeMs: spans[spans.length - 1]?.endTimeMs,
      metadata: {},
    };
  }

  describe("error detection", () => {
    it("identifies spans with error status", () => {
      const errorSpan = makeSpan({
        spanId: "span-1",
        name: "failing-operation",
        status: "error",
        events: [
          {
            timeMs: Date.now(),
            name: "error",
            attributes: { "error.message": "Connection failed" },
          },
        ],
      });

      const trace = makeTrace([errorSpan]);
      const errors = trace.spans.filter((s) => s.status === "error");

      expect(errors).toHaveLength(1);
      expect(errors[0]?.name).toBe("failing-operation");
    });

    it("extracts error messages from events", () => {
      const errorSpan = makeSpan({
        spanId: "span-1",
        name: "api-call",
        status: "error",
        events: [
          {
            timeMs: Date.now(),
            name: "error",
            attributes: { "error.message": "API key invalid" },
          },
        ],
      });

      const trace = makeTrace([errorSpan]);
      const errorEvent = trace.spans[0]?.events.find((e) => e.name === "error");

      expect(errorEvent?.attributes["error.message"]).toBe("API key invalid");
    });

    it("handles traces with no errors", () => {
      const okSpan = makeSpan({
        spanId: "span-1",
        name: "successful-operation",
        status: "ok",
      });

      const trace = makeTrace([okSpan]);
      const errors = trace.spans.filter((s) => s.status === "error");

      expect(errors).toHaveLength(0);
    });
  });

  describe("error classification", () => {
    it("classifies timeout errors by duration threshold", () => {
      const timeoutSpan = makeSpan({
        spanId: "span-1",
        name: "slow-operation",
        status: "error",
        startTimeMs: 1000,
        endTimeMs: 32000, // 31s duration > 30s threshold
        events: [
          {
            timeMs: 32000,
            name: "error",
            attributes: { "error.message": "Operation timed out" },
          },
        ],
      });

      const duration = (timeoutSpan.endTimeMs ?? 0) - timeoutSpan.startTimeMs;
      expect(duration).toBeGreaterThan(30000);
    });

    it("classifies timeout errors by message pattern", () => {
      const patterns = ["timeout", "timed out", "deadline exceeded"];

      for (const pattern of patterns) {
        const span = makeSpan({
          spanId: `span-${pattern}`,
          name: "operation",
          status: "error",
          events: [
            {
              timeMs: Date.now(),
              name: "error",
              attributes: { "error.message": `Request ${pattern}` },
            },
          ],
        });

        const errorMsg = String(
          span.events.find((e) => e.name === "error")?.attributes["error.message"] ?? "",
        ).toLowerCase();

        expect(
          errorMsg.includes("timeout") ||
            errorMsg.includes("timed out") ||
            errorMsg.includes("deadline"),
        ).toBe(true);
      }
    });

    it("classifies auth errors by message pattern", () => {
      const patterns = [
        "unauthorized",
        "forbidden",
        "401",
        "403",
        "api key invalid",
        "authentication failed",
      ];

      for (const pattern of patterns) {
        const span = makeSpan({
          spanId: `span-${pattern}`,
          name: "auth-check",
          status: "error",
          events: [
            {
              timeMs: Date.now(),
              name: "error",
              attributes: { "error.message": pattern },
            },
          ],
        });

        const errorMsg = String(
          span.events.find((e) => e.name === "error")?.attributes["error.message"] ?? "",
        ).toLowerCase();

        const isAuth =
          errorMsg.includes("unauthorized") ||
          errorMsg.includes("forbidden") ||
          errorMsg.includes("401") ||
          errorMsg.includes("403") ||
          errorMsg.includes("api key") ||
          errorMsg.includes("authentication");

        expect(isAuth).toBe(true);
      }
    });

    it("classifies rate limit errors by message pattern", () => {
      const patterns = ["rate limit exceeded", "429", "too many requests", "quota exceeded"];

      for (const pattern of patterns) {
        const span = makeSpan({
          spanId: `span-${pattern}`,
          name: "api-call",
          status: "error",
          events: [
            {
              timeMs: Date.now(),
              name: "error",
              attributes: { "error.message": pattern },
            },
          ],
        });

        const errorMsg = String(
          span.events.find((e) => e.name === "error")?.attributes["error.message"] ?? "",
        ).toLowerCase();

        const isRateLimit =
          errorMsg.includes("rate limit") ||
          errorMsg.includes("429") ||
          errorMsg.includes("too many requests") ||
          errorMsg.includes("quota");

        expect(isRateLimit).toBe(true);
      }
    });

    it("classifies tool errors by span kind", () => {
      const toolSpan = makeSpan({
        spanId: "span-1",
        name: "calculator_tool",
        kind: "tool_call",
        status: "error",
        events: [
          {
            timeMs: Date.now(),
            name: "error",
            attributes: { "error.message": "Tool execution failed" },
          },
        ],
      });

      expect(toolSpan.kind).toBe("tool_call");
      expect(toolSpan.status).toBe("error");
    });

    it("classifies LLM errors by span kind", () => {
      const llmSpan = makeSpan({
        spanId: "span-1",
        name: "generate_response",
        kind: "llm_call",
        status: "error",
        events: [
          {
            timeMs: Date.now(),
            name: "error",
            attributes: { "error.message": "Model not found" },
          },
        ],
      });

      expect(llmSpan.kind).toBe("llm_call");
      expect(llmSpan.status).toBe("error");
    });

    it("classifies LLM errors by message pattern", () => {
      const patterns = ["model not found", "openai error", "anthropic api error"];

      for (const pattern of patterns) {
        const span = makeSpan({
          spanId: `span-${pattern}`,
          name: "llm-call",
          status: "error",
          events: [
            {
              timeMs: Date.now(),
              name: "error",
              attributes: { "error.message": pattern },
            },
          ],
        });

        const errorMsg = String(
          span.events.find((e) => e.name === "error")?.attributes["error.message"] ?? "",
        ).toLowerCase();

        const isLlmError =
          errorMsg.includes("model") ||
          errorMsg.includes("openai") ||
          errorMsg.includes("anthropic");

        expect(isLlmError).toBe(true);
      }
    });

    it("classifies validation errors by message pattern", () => {
      const patterns = [
        "validation failed",
        "invalid input",
        "required field missing",
        "schema error",
      ];

      for (const pattern of patterns) {
        const span = makeSpan({
          spanId: `span-${pattern}`,
          name: "validate-input",
          status: "error",
          events: [
            {
              timeMs: Date.now(),
              name: "error",
              attributes: { "error.message": pattern },
            },
          ],
        });

        const errorMsg = String(
          span.events.find((e) => e.name === "error")?.attributes["error.message"] ?? "",
        ).toLowerCase();

        const isValidation =
          errorMsg.includes("validation") ||
          errorMsg.includes("invalid") ||
          errorMsg.includes("required") ||
          errorMsg.includes("schema");

        expect(isValidation).toBe(true);
      }
    });
  });

  describe("parent chain building", () => {
    it("builds parent chain for error span", () => {
      const rootSpan = makeSpan({
        spanId: "root",
        name: "workflow",
      });

      const middleSpan = makeSpan({
        spanId: "middle",
        name: "process",
        parentSpanId: "root",
      });

      const errorSpan = makeSpan({
        spanId: "error",
        name: "failing-step",
        parentSpanId: "middle",
        status: "error",
        events: [
          {
            timeMs: Date.now(),
            name: "error",
            attributes: { "error.message": "Step failed" },
          },
        ],
      });

      const trace = makeTrace([rootSpan, middleSpan, errorSpan]);

      // Build parent chain
      const spanMap = new Map<string, Span>();
      for (const span of trace.spans) {
        spanMap.set(span.spanId, span);
      }

      function getParentChain(span: Span): Span[] {
        const chain: Span[] = [span];
        let current = span;
        while (current.parentSpanId) {
          const parent = spanMap.get(current.parentSpanId);
          if (!parent) break;
          chain.unshift(parent);
          current = parent;
        }
        return chain;
      }

      const chain = getParentChain(errorSpan);

      expect(chain).toHaveLength(3);
      expect(chain[0]?.spanId).toBe("root");
      expect(chain[1]?.spanId).toBe("middle");
      expect(chain[2]?.spanId).toBe("error");
    });

    it("handles orphan spans with no parent", () => {
      const orphanSpan = makeSpan({
        spanId: "orphan",
        name: "isolated-operation",
        status: "error",
      });

      const trace = makeTrace([orphanSpan]);

      const spanMap = new Map<string, Span>();
      for (const span of trace.spans) {
        spanMap.set(span.spanId, span);
      }

      function getParentChain(span: Span): Span[] {
        const chain: Span[] = [span];
        let current = span;
        while (current.parentSpanId) {
          const parent = spanMap.get(current.parentSpanId);
          if (!parent) break;
          chain.unshift(parent);
          current = parent;
        }
        return chain;
      }

      const chain = getParentChain(orphanSpan);

      expect(chain).toHaveLength(1);
      expect(chain[0]?.spanId).toBe("orphan");
    });
  });

  describe("multiple errors", () => {
    it("identifies earliest error by start time", () => {
      const error1 = makeSpan({
        spanId: "error-1",
        name: "first-error",
        startTimeMs: 2000,
        status: "error",
      });

      const error2 = makeSpan({
        spanId: "error-2",
        name: "second-error",
        startTimeMs: 1000,
        status: "error",
      });

      const error3 = makeSpan({
        spanId: "error-3",
        name: "third-error",
        startTimeMs: 3000,
        status: "error",
      });

      const trace = makeTrace([error1, error2, error3]);
      const errorSpans = trace.spans.filter((s) => s.status === "error");

      const firstError = errorSpans.reduce((earliest, current) =>
        current.startTimeMs < earliest.startTimeMs ? current : earliest,
      );

      expect(firstError.spanId).toBe("error-2");
      expect(firstError.startTimeMs).toBe(1000);
    });

    it("counts total error spans", () => {
      const spans = [
        makeSpan({ spanId: "ok-1", name: "success-1", status: "ok" }),
        makeSpan({ spanId: "error-1", name: "failure-1", status: "error" }),
        makeSpan({ spanId: "ok-2", name: "success-2", status: "ok" }),
        makeSpan({ spanId: "error-2", name: "failure-2", status: "error" }),
        makeSpan({ spanId: "error-3", name: "failure-3", status: "error" }),
      ];

      const trace = makeTrace(spans);
      const errorCount = trace.spans.filter((s) => s.status === "error").length;

      expect(errorCount).toBe(3);
    });
  });

  describe("edge cases", () => {
    it("handles missing error message attributes", () => {
      const span = makeSpan({
        spanId: "span-1",
        name: "operation",
        status: "error",
        events: [
          {
            timeMs: Date.now(),
            name: "error",
            attributes: {}, // No error.message
          },
        ],
      });

      const errorEvent = span.events.find((e) => e.name === "error");
      const message = String(
        errorEvent?.attributes["error.message"] ??
          errorEvent?.attributes["message"] ??
          "Unknown error",
      );

      expect(message).toBe("Unknown error");
    });

    it("handles spans with no events", () => {
      const span = makeSpan({
        spanId: "span-1",
        name: "operation",
        status: "error",
        events: [], // No events at all
      });

      const errorEvents = span.events.filter((e) => e.name === "error");
      expect(errorEvents).toHaveLength(0);
    });

    it("handles incomplete spans with no end time", () => {
      const span = makeSpan({
        spanId: "span-1",
        name: "incomplete",
        status: "error",
        startTimeMs: 1000,
        // No endTimeMs
      });

      const duration = span.endTimeMs ? span.endTimeMs - span.startTimeMs : 0;
      expect(duration).toBe(0);
    });
  });
});

describe("scoring tools", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function makeClient(): FoxhoundApiClient {
    return new FoxhoundApiClient({
      endpoint: "https://api.foxhound.dev",
      apiKey: "fox_test_key",
    });
  }

  function mockOk(body: unknown): void {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(body),
    });
  }

  describe("createScore", () => {
    it("sends correct URL and payload for trace-level score", async () => {
      const client = makeClient();
      mockOk({ id: "score-123", traceId: "trace-1", name: "quality", value: 0.95 });

      await client.createScore({
        traceId: "trace-1",
        name: "quality",
        value: 0.95,
        source: "manual",
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.foxhound.dev/v1/scores");
      expect(opts.method).toBe("POST");
      expect(opts.headers).toMatchObject({
        Authorization: "Bearer fox_test_key",
        "Content-Type": "application/json",
      });

      const body = JSON.parse(opts.body as string);
      expect(body).toMatchObject({
        traceId: "trace-1",
        name: "quality",
        value: 0.95,
        source: "manual",
      });
    });

    it("sends correct payload for span-level score", async () => {
      const client = makeClient();
      mockOk({ id: "score-456", traceId: "trace-1", spanId: "span-2", name: "latency" });

      await client.createScore({
        traceId: "trace-1",
        spanId: "span-2",
        name: "latency",
        label: "slow",
        source: "manual",
        comment: "Needs optimization",
      });

      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(opts.body as string);
      expect(body).toMatchObject({
        traceId: "trace-1",
        spanId: "span-2",
        name: "latency",
        label: "slow",
        source: "manual",
        comment: "Needs optimization",
      });
    });

    it("handles value and label scores separately", async () => {
      const client = makeClient();

      // Value score
      mockOk({ id: "score-1", name: "accuracy", value: 0.87 });
      await client.createScore({
        traceId: "trace-1",
        name: "accuracy",
        value: 0.87,
        source: "manual",
      });

      const [, opts1] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body1 = JSON.parse(opts1.body as string);
      expect(body1.value).toBe(0.87);
      expect(body1.label).toBeUndefined();

      // Label score
      mockOk({ id: "score-2", name: "quality", label: "excellent" });
      await client.createScore({
        traceId: "trace-1",
        name: "quality",
        label: "excellent",
        source: "manual",
      });

      const [, opts2] = mockFetch.mock.calls[1] as [string, RequestInit];
      const body2 = JSON.parse(opts2.body as string);
      expect(body2.label).toBe("excellent");
      expect(body2.value).toBeUndefined();
    });
  });

  describe("getTraceScores", () => {
    it("fetches scores for a trace", async () => {
      const client = makeClient();
      mockOk({
        data: [
          {
            id: "score-1",
            traceId: "trace-1",
            name: "quality",
            value: 0.95,
            source: "manual",
          },
          {
            id: "score-2",
            traceId: "trace-1",
            spanId: "span-2",
            name: "performance",
            label: "good",
            source: "evaluator",
            comment: "Meets SLA",
          },
        ],
      });

      const response = await client.getTraceScores("trace-1");

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe("https://api.foxhound.dev/v1/traces/trace-1/scores");

      expect(response.data).toHaveLength(2);
      expect(response.data[0]).toMatchObject({
        id: "score-1",
        name: "quality",
        value: 0.95,
      });
      expect(response.data[1]).toMatchObject({
        id: "score-2",
        name: "performance",
        label: "good",
      });
    });

    it("handles empty score list", async () => {
      const client = makeClient();
      mockOk({ data: [] });

      const response = await client.getTraceScores("trace-1");

      expect(response.data).toHaveLength(0);
    });

    it("includes auth header", async () => {
      const client = makeClient();
      mockOk({ data: [] });

      await client.getTraceScores("trace-1");

      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(opts.headers).toMatchObject({
        Authorization: "Bearer fox_test_key",
      });
    });
  });

  describe("error handling", () => {
    it("throws on 404 for missing trace", async () => {
      const client = makeClient();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("Trace not found"),
      });

      await expect(client.createScore({
        traceId: "missing-trace",
        name: "quality",
        value: 0.8,
        source: "manual",
      })).rejects.toThrow("Foxhound API 404");
    });

    it("throws on 401 for auth failure", async () => {
      const client = makeClient();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("Invalid API key"),
      });

      await expect(client.getTraceScores("trace-1")).rejects.toThrow("Foxhound API 401");
    });
  });
});
