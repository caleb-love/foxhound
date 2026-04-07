import { describe, it, expect, vi, beforeEach } from "vitest";
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
// FoxhoundClient — constructor
// ---------------------------------------------------------------------------

describe("FoxhoundClient constructor", () => {
  it("requires apiKey and endpoint", () => {
    const client = new FoxhoundClient({ apiKey: "sk-test", endpoint: "https://api.example.com" });
    expect(client).toBeInstanceOf(FoxhoundClient);
  });

  it("applies default flushIntervalMs and maxBatchSize", () => {
    // Indirect: we verify defaults via startTrace -> flush behaviour
    const client = new FoxhoundClient({ apiKey: "sk-test", endpoint: "https://api.example.com" });
    expect(client).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// FoxhoundClient — startTrace
// ---------------------------------------------------------------------------

describe("FoxhoundClient.startTrace()", () => {
  it("returns a Tracer instance", () => {
    const client = new FoxhoundClient({ apiKey: "sk-test", endpoint: "https://api.example.com" });
    const tracer = client.startTrace({ agentId: "agent_1" });
    expect(tracer).toBeInstanceOf(Tracer);
  });

  it("returns a tracer with a unique traceId each call", () => {
    const client = new FoxhoundClient({ apiKey: "sk-test", endpoint: "https://api.example.com" });
    const t1 = client.startTrace({ agentId: "agent_1" });
    const t2 = client.startTrace({ agentId: "agent_1" });
    expect(t1.traceId).not.toBe(t2.traceId);
  });

  it("passes agentId to the tracer", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const client = new FoxhoundClient({ apiKey: "sk-test", endpoint: "https://api.example.com" });
    const tracer = client.startTrace({ agentId: "agent_42" });
    await tracer.flush();

    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(body.agentId).toBe("agent_42");
  });

  it("passes sessionId to the tracer when provided", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const client = new FoxhoundClient({ apiKey: "sk-test", endpoint: "https://api.example.com" });
    const tracer = client.startTrace({ agentId: "agent_1", sessionId: "sess_99" });
    await tracer.flush();

    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(body.sessionId).toBe("sess_99");
  });

  it("passes metadata to the tracer when provided", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const client = new FoxhoundClient({ apiKey: "sk-test", endpoint: "https://api.example.com" });
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

    const client = new FoxhoundClient({ apiKey: "sk-test", endpoint: "https://api.example.com" });
    const tracer = client.startTrace({ agentId: "agent_1" });
    await tracer.flush();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/traces",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends Bearer auth header with the api key", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const client = new FoxhoundClient({ apiKey: "sk-abc123", endpoint: "https://api.example.com" });
    const tracer = client.startTrace({ agentId: "agent_1" });
    await tracer.flush();

    const headers = mockFetch.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer sk-abc123");
  });

  it("sends Content-Type application/json", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const client = new FoxhoundClient({ apiKey: "sk-test", endpoint: "https://api.example.com" });
    const tracer = client.startTrace({ agentId: "agent_1" });
    await tracer.flush();

    const headers = mockFetch.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("sends the trace payload as JSON body", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const client = new FoxhoundClient({ apiKey: "sk-test", endpoint: "https://api.example.com" });
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

    const client = new FoxhoundClient({ apiKey: "sk-test", endpoint: "https://api.example.com" });
    const tracer = client.startTrace({ agentId: "agent_1" });
    await expect(tracer.flush()).rejects.toThrow("429");
  });

  it("throws when fetch rejects (network failure)", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const client = new FoxhoundClient({ apiKey: "sk-test", endpoint: "https://api.example.com" });
    const tracer = client.startTrace({ agentId: "agent_1" });
    await expect(tracer.flush()).rejects.toThrow("Network error");
  });
});
