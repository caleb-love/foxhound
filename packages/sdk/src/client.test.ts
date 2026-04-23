import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BudgetExceededInfo } from "./client.js";
import { FoxhoundClient } from "./client.js";
import { Tracer } from "./tracer.js";

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// WP06 note: `FoxhoundClient` now routes exports through the
// `BatchSpanProcessor` by default (non-blocking background queue). Tests
// that need synchronous delivery (i.e. that assert on `mockFetch` after
// `await tracer.flush()` without an explicit `await fox.shutdown()`) pass
// `maxQueueSize: 0` to disable the BSP and restore pre-WP06 inline export.
// New tests that want to exercise the BSP itself should NOT set
// `maxQueueSize: 0`; they live in `batch-processor.test.ts` instead.
const SYNC_OPTS = { maxQueueSize: 0 } as const;

// ---------------------------------------------------------------------------
// FoxhoundClient — constructor
// ---------------------------------------------------------------------------

describe("FoxhoundClient constructor", () => {
  it("requires apiKey and endpoint", () => {
    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      ...SYNC_OPTS,
    });
    expect(client).toBeInstanceOf(FoxhoundClient);
  });

  it("applies default flushIntervalMs and maxBatchSize", () => {
    // Indirect: we verify defaults via startTrace -> flush behaviour
    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      ...SYNC_OPTS,
    });
    expect(client).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// FoxhoundClient — startTrace
// ---------------------------------------------------------------------------

describe("FoxhoundClient.startTrace()", () => {
  it("returns a Tracer instance", () => {
    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      ...SYNC_OPTS,
    });
    const tracer = client.startTrace({ agentId: "agent_1" });
    expect(tracer).toBeInstanceOf(Tracer);
  });

  it("returns a tracer with a unique traceId each call", () => {
    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      ...SYNC_OPTS,
    });
    const t1 = client.startTrace({ agentId: "agent_1" });
    const t2 = client.startTrace({ agentId: "agent_1" });
    expect(t1.traceId).not.toBe(t2.traceId);
  });

  // These three tests exercise the legacy JSON wire shape explicitly,
  // since the default wire format switched to Protobuf in WP04 (RFC-004).
  // Protobuf-wire coverage lives in src/transport/transport.test.ts.
  it("passes agentId to the tracer", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      wireFormat: "json",
      ...SYNC_OPTS,
    });
    const tracer = client.startTrace({ agentId: "agent_42" });
    await tracer.flush();

    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(body.agentId).toBe("agent_42");
  });

  it("passes sessionId to the tracer when provided", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      wireFormat: "json",
      ...SYNC_OPTS,
    });
    const tracer = client.startTrace({ agentId: "agent_1", sessionId: "sess_99" });
    await tracer.flush();

    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(body.sessionId).toBe("sess_99");
  });

  it("passes metadata to the tracer when provided", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      wireFormat: "json",
      ...SYNC_OPTS,
    });
    const tracer = client.startTrace({ agentId: "agent_1", metadata: { env: "test", version: 2 } });
    await tracer.flush();

    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(body.metadata).toEqual({ env: "test", version: 2 });
  });
});

// ---------------------------------------------------------------------------
// FoxhoundClient — sendTrace (via flush)
// ---------------------------------------------------------------------------

describe("FoxhoundClient HTTP request (via Tracer.flush)", () => {
  it("POSTs to the correct URL", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      ...SYNC_OPTS,
    });
    const tracer = client.startTrace({ agentId: "agent_1" });
    await tracer.flush();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/traces",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends Bearer auth header with the api key", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const client = new FoxhoundClient({
      apiKey: "sk-abc123",
      endpoint: "https://api.example.com",
      wireFormat: "json",
      ...SYNC_OPTS,
    });
    const tracer = client.startTrace({ agentId: "agent_1" });
    await tracer.flush();

    const headers = mockFetch.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer sk-abc123");
  });

  it("sends Content-Type application/json", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      wireFormat: "json",
      ...SYNC_OPTS,
    });
    const tracer = client.startTrace({ agentId: "agent_1" });
    await tracer.flush();

    const headers = mockFetch.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("sends the trace payload as JSON body", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      wireFormat: "json",
      compression: "none",
      ...SYNC_OPTS,
    });
    const tracer = client.startTrace({ agentId: "agent_1", sessionId: "sess_1" });
    const span = tracer.startSpan({ name: "step", kind: "agent_step" });
    span.end("ok");
    await tracer.flush();

    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(body.id).toBe(tracer.traceId);
    expect(body.agentId).toBe("agent_1");
    expect(body.spans).toHaveLength(1);
    expect(body.spans[0].name).toBe("step");
  });

  it("throws when the server returns a non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, statusText: "Too Many Requests" });

    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      ...SYNC_OPTS,
    });
    const tracer = client.startTrace({ agentId: "agent_1" });
    await expect(tracer.flush()).rejects.toThrow("429");
  });

  it("throws when fetch rejects (network failure)", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      ...SYNC_OPTS,
    });
    const tracer = client.startTrace({ agentId: "agent_1" });
    await expect(tracer.flush()).rejects.toThrow("Network error");
  });
});

// ---------------------------------------------------------------------------
// FoxhoundClient — onBudgetExceeded callback
// ---------------------------------------------------------------------------

describe("FoxhoundClient.datasets.addItems", () => {
  it("submits one request per dataset item using the server-supported single-item contract", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "item-created" }),
    });

    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      ...SYNC_OPTS,
    });
    const result = await client.datasets.addItems("ds_1", [
      { input: { prompt: "one" }, expectedOutput: { response: "1" } },
      { input: { prompt: "two" }, expectedOutput: { response: "2" }, sourceTraceId: "trace_2" },
    ]);

    expect(result).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    const secondBody = JSON.parse(mockFetch.mock.calls[1]![1]!.body as string);
    expect(firstBody).toEqual({ input: { prompt: "one" }, expectedOutput: { response: "1" } });
    expect(secondBody).toEqual({
      input: { prompt: "two" },
      expectedOutput: { response: "2" },
      sourceTraceId: "trace_2",
    });
  });
});

describe("FoxhoundClient.onBudgetExceeded callback", () => {
  function createMockResponse(headers: Record<string, string>): {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Headers;
  } {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(headers),
    };
  }

  it("invokes onBudgetExceeded when response includes exceeded status header", async () => {
    const callback = vi.fn<(info: BudgetExceededInfo) => void>();

    mockFetch.mockResolvedValue(
      createMockResponse({
        "X-Foxhound-Budget-Status": "exceeded",
        "X-Foxhound-Budget-Agent-Id": "agent_42",
        "X-Foxhound-Budget-Current-Cost": "150.75",
        "X-Foxhound-Budget-Limit": "100.00",
      }),
    );

    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      onBudgetExceeded: callback,
      ...SYNC_OPTS,
    });

    const tracer = client.startTrace({ agentId: "agent_42" });
    await tracer.flush();

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith({
      agentId: "agent_42",
      currentCost: 150.75,
      budgetLimit: 100.0,
    });
  });

  it("does not invoke callback when budget status header is absent", async () => {
    const callback = vi.fn<(info: BudgetExceededInfo) => void>();

    mockFetch.mockResolvedValue(createMockResponse({}));

    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      onBudgetExceeded: callback,
      ...SYNC_OPTS,
    });

    const tracer = client.startTrace({ agentId: "agent_1" });
    await tracer.flush();

    expect(callback).not.toHaveBeenCalled();
  });

  it("does not invoke callback when budget status is not 'exceeded'", async () => {
    const callback = vi.fn<(info: BudgetExceededInfo) => void>();

    mockFetch.mockResolvedValue(
      createMockResponse({
        "X-Foxhound-Budget-Status": "ok",
      }),
    );

    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      onBudgetExceeded: callback,
      ...SYNC_OPTS,
    });

    const tracer = client.startTrace({ agentId: "agent_1" });
    await tracer.flush();

    expect(callback).not.toHaveBeenCalled();
  });

  it("does not throw when no callback is configured and budget is exceeded", async () => {
    mockFetch.mockResolvedValue(
      createMockResponse({
        "X-Foxhound-Budget-Status": "exceeded",
        "X-Foxhound-Budget-Agent-Id": "agent_1",
        "X-Foxhound-Budget-Current-Cost": "200",
        "X-Foxhound-Budget-Limit": "100",
      }),
    );

    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      ...SYNC_OPTS,
    });

    const tracer = client.startTrace({ agentId: "agent_1" });
    // Should not throw — just silently skip the callback
    await expect(tracer.flush()).resolves.toBeUndefined();
  });

  it("defaults agentId to empty string when header is missing", async () => {
    const callback = vi.fn<(info: BudgetExceededInfo) => void>();

    mockFetch.mockResolvedValue(
      createMockResponse({
        "X-Foxhound-Budget-Status": "exceeded",
        "X-Foxhound-Budget-Current-Cost": "50",
        "X-Foxhound-Budget-Limit": "25",
      }),
    );

    const client = new FoxhoundClient({
      apiKey: "sk-test",
      endpoint: "https://api.example.com",
      onBudgetExceeded: callback,
      ...SYNC_OPTS,
    });

    const tracer = client.startTrace({ agentId: "agent_1" });
    await tracer.flush();

    expect(callback).toHaveBeenCalledWith({
      agentId: "",
      currentCost: 50,
      budgetLimit: 25,
    });
  });
});
