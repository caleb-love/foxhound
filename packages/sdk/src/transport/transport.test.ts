import { describe, it, expect, vi } from "vitest";
import type { Trace } from "@foxhound/types";
import { v1 } from "@foxhound/proto";
import { createTransport, JsonTransport, ProtobufTransport } from "./index.js";

function mkTrace(): Trace {
  return {
    id: "t-001",
    agentId: "agent_a",
    spans: Array.from({ length: 3 }, (_, i) => ({
      traceId: "t-001",
      spanId: `s-${i}`,
      name: `step.${i}`,
      kind: i === 0 ? "llm_call" : "tool_call",
      startTimeMs: 1_700_000_000_000 + i * 10,
      endTimeMs: 1_700_000_000_000 + i * 10 + 5,
      status: "ok",
      attributes: { seq: i, model: "gpt-4o", cached: i % 2 === 0 },
      events: [],
    })),
    startTimeMs: 1_700_000_000_000,
    endTimeMs: 1_700_000_000_050,
    metadata: {},
  };
}

function mockFetch(
  status = 202,
  headers: Record<string, string> = {},
): {
  fetch: typeof fetch;
  calls: Array<{ url: string; init: RequestInit }>;
} {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn: typeof fetch = (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return Promise.resolve(
      new Response(null, {
        status,
        headers: new Headers({ "content-type": "application/json", ...headers }),
      }),
    );
  };
  return { fetch: fn, calls };
}

describe("sdk · transport · factory", () => {
  it("defaults to Protobuf when wireFormat is unspecified", () => {
    const t = createTransport({ endpoint: "http://x", apiKey: "k" });
    expect(t.wireFormat).toBe("protobuf");
    expect(t).toBeInstanceOf(ProtobufTransport);
  });
  it("returns JsonTransport when wireFormat=json", () => {
    const t = createTransport({ endpoint: "http://x", apiKey: "k", wireFormat: "json" });
    expect(t.wireFormat).toBe("json");
    expect(t).toBeInstanceOf(JsonTransport);
  });
  it("rejects unknown wire formats", () => {
    expect(() =>
      createTransport({
        endpoint: "http://x",
        apiKey: "k",
        // @ts-expect-error intentional: testing runtime guard
        wireFormat: "xml",
      }),
    ).toThrow();
  });
});

describe("sdk · transport · JsonTransport", () => {
  it("posts JSON body with the correct content-type and auth", async () => {
    const { fetch: f, calls } = mockFetch();
    const t = new JsonTransport({
      endpoint: "http://api.test/",
      apiKey: "secret-key",
      fetchImpl: f,
      // Legacy body-shape assertion — opt out of WP05 gzip so the
      // fetch body stays a raw JSON string for `JSON.parse`.
      compression: "none",
    });
    const result = await t.send(mkTrace());
    expect(result.wireFormat).toBe("json");
    expect(result.status).toBe(202);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call!.url).toBe("http://api.test/v1/traces");
    const headers = call!.init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Authorization"]).toBe("Bearer secret-key");
    expect(headers["X-Foxhound-Wire"]).toBe("json");
    // Compression=none keeps the body as a string (RFC-005
    // backward-compat path).
    expect(headers["Content-Encoding"]).toBeUndefined();
    const body = call!.init.body as string;
    const parsed = JSON.parse(body);
    expect(parsed.id).toBe("t-001");
    expect(parsed.spans).toHaveLength(3);
  });

  it("throws on non-2xx responses", async () => {
    const { fetch: f } = mockFetch(500);
    const t = new JsonTransport({ endpoint: "http://api.test", apiKey: "k", fetchImpl: f });
    await expect(t.send(mkTrace())).rejects.toThrow(/500/);
  });
});

describe("sdk · transport · ProtobufTransport", () => {
  it("posts binary protobuf body with correct headers", async () => {
    const { fetch: f, calls } = mockFetch();
    const t = new ProtobufTransport({
      endpoint: "http://api.test",
      apiKey: "k",
      fetchImpl: f,
      orgId: "org_pb",
    });
    const result = await t.send(mkTrace());
    expect(result.wireFormat).toBe("protobuf");
    expect(result.payloadBytes).toBeGreaterThan(0);
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/x-protobuf");
    expect(headers["x-foxhound-wire"]).toBe("protobuf");
    expect(headers["x-foxhound-schema"]).toBe("v1");
  });

  it("produces a wire payload that round-trips through the v1 codec", async () => {
    const { fetch: f, calls } = mockFetch();
    const t = new ProtobufTransport({
      endpoint: "http://api.test",
      apiKey: "k",
      fetchImpl: f,
      orgId: "org_rt",
    });
    await t.send(mkTrace());
    const bytes = calls[0]!.init.body as Uint8Array;
    expect(bytes).toBeInstanceOf(Uint8Array);
    const decoded = v1.TraceBatchCodec.decode(bytes);
    expect(decoded.schemaVersion).toBe("v1");
    expect(decoded.orgId).toBe("org_rt");
    expect(decoded.spans).toHaveLength(3);
    expect(decoded.spans[0]!.name).toBe("step.0");
    // int64 schema_version-adjacent fields: batchId decodes as string
    // (see `@foxhound/proto` codec.ts `longs: String` rationale).
    expect(Number(decoded.batchId)).toBeGreaterThan(0);
    expect(decoded.sdkLanguage).toBe("ts");
  });
});

describe("sdk · transport · Protobuf vs JSON payload size", () => {
  it("on a 50-span batch, Protobuf is ≥ 30% smaller than JSON", async () => {
    const big: Trace = {
      id: "t-big",
      agentId: "a",
      spans: Array.from({ length: 50 }, (_, i) => ({
        traceId: "t-big",
        spanId: `sp-${i}`,
        name: "llm.generate",
        kind: "llm_call" as const,
        startTimeMs: 1_700_000_000_000 + i,
        endTimeMs: 1_700_000_000_000 + i + 50,
        status: "ok" as const,
        attributes: {
          "gen_ai.system": "openai",
          "gen_ai.request.model": "gpt-4o",
          "gen_ai.usage.input_tokens": 512,
          "gen_ai.usage.output_tokens": 256,
          "tool.name": "vector_search",
          "retry.count": i % 3,
        },
        events: [{ timeMs: 1_700_000_000_000 + i, name: "request.start", attributes: { seq: i } }],
      })),
      startTimeMs: 1_700_000_000_000,
      endTimeMs: 1_700_000_000_100,
      metadata: {},
    };

    // JSON size
    const { fetch: fJ, calls: cJ } = mockFetch();
    const tJ = new JsonTransport({ endpoint: "http://x", apiKey: "k", fetchImpl: fJ });
    await tJ.send(big);
    const jsonBytes = new TextEncoder().encode(cJ[0]!.init.body as string).length;

    // Protobuf size
    const { fetch: fP, calls: cP } = mockFetch();
    const tP = new ProtobufTransport({ endpoint: "http://x", apiKey: "k", fetchImpl: fP });
    await tP.send(big);
    const protoBytes = (cP[0]!.init.body as Uint8Array).byteLength;

    const reduction = 1 - protoBytes / jsonBytes;
    // eslint-disable-next-line no-console
    console.log(
      `[WP04 size gate] JSON=${jsonBytes}B  Protobuf=${protoBytes}B  ` +
        `reduction=${(reduction * 100).toFixed(1)}%`,
    );
    expect(reduction).toBeGreaterThanOrEqual(0.3);
  });
});

describe("sdk · transport · timeout", () => {
  it("aborts a slow request via AbortController", async () => {
    let abortSignal: AbortSignal | undefined;
    const slowFetch: typeof fetch = (_input, init) => {
      abortSignal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        abortSignal?.addEventListener("abort", () => reject(new Error("AbortError")));
      });
    };
    const t = new ProtobufTransport({
      endpoint: "http://x",
      apiKey: "k",
      fetchImpl: slowFetch,
      timeoutMs: 5,
    });
    const send = t.send(mkTrace());
    await expect(send).rejects.toThrow();
    expect(abortSignal?.aborted).toBe(true);
  });
});

describe("sdk · transport · close is a no-op", () => {
  it("JsonTransport.close resolves", async () => {
    const t = new JsonTransport({ endpoint: "http://x", apiKey: "k", fetchImpl: vi.fn() });
    await expect(t.close()).resolves.toBeUndefined();
  });
  it("ProtobufTransport.close resolves", async () => {
    const t = new ProtobufTransport({ endpoint: "http://x", apiKey: "k", fetchImpl: vi.fn() });
    await expect(t.close()).resolves.toBeUndefined();
  });
});
