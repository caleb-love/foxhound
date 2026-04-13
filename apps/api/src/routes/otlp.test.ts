import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { otlpRoutes } from "./otlp.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  touchApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
  insertTrace: vi.fn(),
  insertSpans: vi.fn(),
}));

vi.mock("@foxhound/billing", () => ({
  checkSpanLimit: vi.fn(),
  incrementSpanCount: vi.fn(),
}));

vi.mock("../trace-buffer.js", () => ({
  initTraceBuffer: vi.fn(),
  bufferTrace: vi.fn(),
}));

import * as db from "@foxhound/db";
import * as billing from "@foxhound/billing";
import { bufferTrace } from "../trace-buffer.js";

/** Helper to get the trace passed to bufferTrace in the last call */
function getBufferedTrace() {
  const calls = vi.mocked(bufferTrace).mock.calls;
  if (calls.length === 0) throw new Error("bufferTrace was not called");
  return calls[calls.length - 1]![0]; // first arg is the trace
}

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(otlpRoutes);
  return app;
}

function mockApiKey(orgId = "org_1") {
  vi.mocked(db.resolveApiKey).mockResolvedValue({
    apiKey: {
      id: "key_1",
      orgId,
      keyHash: "hash",
      prefix: "sk-test",
      name: "Test Key",
      createdByUserId: null,
      revokedAt: null,
      expiresAt: null,
      scopes: null,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    org: {
      id: orgId,
      name: "Test Org",
      slug: "test-org",
      plan: "free" as const,
      stripeCustomerId: null,
      retentionDays: 90,
      samplingRate: 1.0,
      llmEvaluationEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

function mockSpanLimit(allowed = true) {
  vi.mocked(billing.checkSpanLimit).mockResolvedValue({
    allowed,
    spansUsed: allowed ? 100 : 10_000,
    spansLimit: 10_000,
    isOverage: !allowed,
  });
}

/** Minimal OTLP ExportTraceServiceRequest JSON. */
function makeOtlpRequest({
  traceId = "5b8efff798038103d269b633813fc60c",
  spanId = "eee19b7ec3c1b174",
  serviceName = "my-agent",
  spanKind = 1,
  attributes = [] as { key: string; value: { stringValue?: string; intValue?: number } }[],
  startNano = "1617981203000000000",
  endNano = "1617981203500000000",
} = {}) {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: serviceName } },
            { key: "service.instance.id", value: { stringValue: "inst-1" } },
          ],
        },
        scopeSpans: [
          {
            spans: [
              {
                traceId,
                spanId,
                name: "test-span",
                kind: spanKind,
                startTimeUnixNano: startNano,
                endTimeUnixNano: endNano,
                status: { code: 1 },
                attributes,
                events: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("POST /v1/traces/otlp — basic ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without API key", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces/otlp",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(makeOtlpRequest()),
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 202 for valid OTLP JSON payload", async () => {
    mockApiKey();
    mockSpanLimit(true);
    const app = buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/v1/traces/otlp",
      headers: {
        authorization: "Bearer sk-test-key",
        "content-type": "application/json",
      },
      body: JSON.stringify(makeOtlpRequest()),
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ partialSuccess: {} });
  });

  it("returns 400 for non-OTLP JSON body", async () => {
    mockApiKey();
    const app = buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/v1/traces/otlp",
      headers: {
        authorization: "Bearer sk-test-key",
        "content-type": "application/json",
      },
      body: JSON.stringify({ invalid: true }),
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 202 for empty resourceSpans array (OTLP spec compliance)", async () => {
    mockApiKey();
    const app = buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/v1/traces/otlp",
      headers: {
        authorization: "Bearer sk-test-key",
        "content-type": "application/json",
      },
      body: JSON.stringify({ resourceSpans: [] }),
    });

    expect(res.statusCode).toBe(202);
  });

  it("returns 429 when span limit is exceeded", async () => {
    mockApiKey();
    mockSpanLimit(false);
    const app = buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/v1/traces/otlp",
      headers: {
        authorization: "Bearer sk-test-key",
        "content-type": "application/json",
      },
      body: JSON.stringify(makeOtlpRequest()),
    });

    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe("span_limit_exceeded");
  });

  it("calls checkSpanLimit with orgId and correct span count", async () => {
    mockApiKey("org_abc");
    mockSpanLimit(true);
    const app = buildApp();

    await app.inject({
      method: "POST",
      url: "/v1/traces/otlp",
      headers: {
        authorization: "Bearer sk-test-key",
        "content-type": "application/json",
      },
      body: JSON.stringify(makeOtlpRequest()),
    });

    expect(billing.checkSpanLimit).toHaveBeenCalledWith("org_abc", 1);
  });
});

describe("POST /v1/traces/otlp — content negotiation", () => {
  beforeEach(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
    vi.clearAllMocks();
  });

  it("returns 415 for binary protobuf content-type", async () => {
    mockApiKey();
    const app = buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/v1/traces/otlp",
      headers: {
        authorization: "Bearer sk-test-key",
        "content-type": "application/x-protobuf",
      },
      // Send empty buffer to simulate binary proto
      payload: Buffer.alloc(0),
    });

    expect(res.statusCode).toBe(415);
    expect(res.json().error).toBe("Unsupported Media Type");
  });
});

describe("POST /v1/traces/otlp — OTel to Foxhound mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpanLimit(true);
  });

  it("maps gen_ai.* attributes to llm_call span kind", async () => {
    mockApiKey("org_1");
    const app = buildApp();

    await app.inject({
      method: "POST",
      url: "/v1/traces/otlp",
      headers: {
        authorization: "Bearer sk-test-key",
        "content-type": "application/json",
      },
      body: JSON.stringify(
        makeOtlpRequest({
          spanKind: 1, // INTERNAL — normally agent_step
          attributes: [
            { key: "gen_ai.system", value: { stringValue: "openai" } },
            { key: "gen_ai.operation.name", value: { stringValue: "chat" } },
          ],
        }),
      ),
    });

    const insertedTrace = getBufferedTrace();
    expect(insertedTrace.spans[0]?.kind).toBe("llm_call");
  });

  it("maps OTel CLIENT spans to tool_call", async () => {
    mockApiKey("org_1");
    const app = buildApp();

    await app.inject({
      method: "POST",
      url: "/v1/traces/otlp",
      headers: {
        authorization: "Bearer sk-test-key",
        "content-type": "application/json",
      },
      body: JSON.stringify(makeOtlpRequest({ spanKind: 3 })), // CLIENT
    });

    const insertedTrace = getBufferedTrace();
    expect(insertedTrace.spans[0]?.kind).toBe("tool_call");
  });

  it("maps OTel SERVER spans to workflow", async () => {
    mockApiKey("org_1");
    const app = buildApp();

    await app.inject({
      method: "POST",
      url: "/v1/traces/otlp",
      headers: {
        authorization: "Bearer sk-test-key",
        "content-type": "application/json",
      },
      body: JSON.stringify(makeOtlpRequest({ spanKind: 2 })), // SERVER
    });

    const insertedTrace = getBufferedTrace();
    expect(insertedTrace.spans[0]?.kind).toBe("workflow");
  });

  it("maps OTel INTERNAL spans to agent_step", async () => {
    mockApiKey("org_1");
    const app = buildApp();

    await app.inject({
      method: "POST",
      url: "/v1/traces/otlp",
      headers: {
        authorization: "Bearer sk-test-key",
        "content-type": "application/json",
      },
      body: JSON.stringify(makeOtlpRequest({ spanKind: 1 })), // INTERNAL
    });

    const insertedTrace = getBufferedTrace();
    expect(insertedTrace.spans[0]?.kind).toBe("agent_step");
  });

  it("extracts service.name as agentId", async () => {
    mockApiKey("org_1");
    const app = buildApp();

    await app.inject({
      method: "POST",
      url: "/v1/traces/otlp",
      headers: {
        authorization: "Bearer sk-test-key",
        "content-type": "application/json",
      },
      body: JSON.stringify(makeOtlpRequest({ serviceName: "payment-agent" })),
    });

    const insertedTrace = getBufferedTrace();
    expect(insertedTrace.agentId).toBe("payment-agent");
  });

  it("converts nanosecond timestamps to milliseconds", async () => {
    mockApiKey("org_1");
    const app = buildApp();

    await app.inject({
      method: "POST",
      url: "/v1/traces/otlp",
      headers: {
        authorization: "Bearer sk-test-key",
        "content-type": "application/json",
      },
      body: JSON.stringify(
        makeOtlpRequest({
          startNano: "1617981203000000000",
          endNano: "1617981203500000000",
        }),
      ),
    });

    const insertedTrace = getBufferedTrace();
    expect(insertedTrace.spans[0]?.startTimeMs).toBe(1617981203000);
    expect(insertedTrace.spans[0]?.endTimeMs).toBe(1617981203500);
  });

  it("groups multiple spans with the same traceId into one trace", async () => {
    mockApiKey("org_1");
    const app = buildApp();
    const sharedTraceId = "aaaabbbbccccddddeeeeffff00001111";

    const payload = {
      resourceSpans: [
        {
          resource: {
            attributes: [{ key: "service.name", value: { stringValue: "my-svc" } }],
          },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: sharedTraceId,
                  spanId: "1111111111111111",
                  name: "span-a",
                  kind: 1,
                  startTimeUnixNano: "1000000000",
                  endTimeUnixNano: "2000000000",
                  status: { code: 1 },
                  attributes: [],
                  events: [],
                },
                {
                  traceId: sharedTraceId,
                  spanId: "2222222222222222",
                  name: "span-b",
                  kind: 1,
                  startTimeUnixNano: "2000000000",
                  endTimeUnixNano: "3000000000",
                  status: { code: 1 },
                  attributes: [],
                  events: [],
                },
              ],
            },
          ],
        },
      ],
    };

    await app.inject({
      method: "POST",
      url: "/v1/traces/otlp",
      headers: {
        authorization: "Bearer sk-test-key",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Should produce exactly one bufferTrace call with 2 spans
    expect(bufferTrace).toHaveBeenCalledTimes(1);
    const insertedTrace = getBufferedTrace();
    expect(insertedTrace.spans).toHaveLength(2);
    expect(insertedTrace.id).toBe(sharedTraceId);
  });

  it("handles base64-encoded traceId and spanId from OTLP proto-JSON", async () => {
    mockApiKey("org_1");
    const app = buildApp();

    // Base64-encoded 16-byte trace ID and 8-byte span ID
    const traceIdHex = "5b8efff798038103d269b633813fc60c";
    const spanIdHex = "eee19b7ec3c1b174";
    const traceIdBase64 = Buffer.from(traceIdHex, "hex").toString("base64");
    const spanIdBase64 = Buffer.from(spanIdHex, "hex").toString("base64");

    await app.inject({
      method: "POST",
      url: "/v1/traces/otlp",
      headers: {
        authorization: "Bearer sk-test-key",
        "content-type": "application/json",
      },
      body: JSON.stringify(makeOtlpRequest({ traceId: traceIdBase64, spanId: spanIdBase64 })),
    });

    const insertedTrace = getBufferedTrace();
    expect(insertedTrace.id).toBe(traceIdHex);
    expect(insertedTrace.spans[0]?.spanId).toBe(spanIdHex);
  });
});
