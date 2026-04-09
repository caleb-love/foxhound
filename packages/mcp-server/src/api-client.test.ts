import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FoxhoundApiClient } from "@foxhound/api-client";

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
