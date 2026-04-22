import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { v1 } from "@foxhound/proto";
import {
  HEADER_ORG_ID,
  HEADER_SCHEMA_VERSION,
  HEADER_WIRE_FORMAT,
  HEADER_IDEMPOTENCY_KEY,
  TOPIC_SPANS_V1,
  resetInMemoryBus,
  InMemoryConsumer,
  type QueueMessage,
} from "@foxhound/queue";
import {
  buildIngestPayload,
  closeIngestProducer,
  enqueueTrace,
  isQueueIngestEnabled,
} from "./ingest-producer.js";
import type { Trace } from "@foxhound/types";

const mkTrace = (overrides: Partial<Trace> = {}): Trace => ({
  id: "t-ingest-1",
  agentId: "agent_a",
  spans: [
    {
      traceId: "t-ingest-1",
      spanId: "s-0",
      name: "llm.generate",
      kind: "llm_call",
      startTimeMs: 1_700_000_000_000,
      endTimeMs: 1_700_000_000_100,
      status: "ok",
      attributes: { model: "gpt-4o", tokens: 512, cached: true, nullable: null },
      events: [],
    },
    {
      traceId: "t-ingest-1",
      spanId: "s-1",
      parentSpanId: "s-0",
      name: "tool.search",
      kind: "tool_call",
      startTimeMs: 1_700_000_000_020,
      endTimeMs: 1_700_000_000_080,
      status: "error",
      attributes: {},
      events: [],
    },
  ],
  startTimeMs: 1_700_000_000_000,
  endTimeMs: 1_700_000_000_100,
  metadata: {},
  ...overrides,
});

describe("api · ingest-producer · isQueueIngestEnabled", () => {
  it("is off by default", () => {
    expect(isQueueIngestEnabled({})).toBe(false);
  });
  it("accepts truthy flag values", () => {
    expect(isQueueIngestEnabled({ FOXHOUND_USE_QUEUE: "true" })).toBe(true);
    expect(isQueueIngestEnabled({ FOXHOUND_USE_QUEUE: "in-memory" })).toBe(true);
    expect(isQueueIngestEnabled({ FOXHOUND_USE_QUEUE: "nats" })).toBe(true);
  });
  it("treats 'false', '0', 'off' as disabled", () => {
    for (const v of ["false", "0", "off"]) {
      expect(isQueueIngestEnabled({ FOXHOUND_USE_QUEUE: v })).toBe(false);
    }
  });
});

describe("api · ingest-producer · buildIngestPayload", () => {
  it("emits a v1 TraceBatch whose body decodes back to the original trace shape", () => {
    const trace = mkTrace();
    const { key, value, headers } = buildIngestPayload(trace, "org_a");
    expect(key).toBe("t-ingest-1");
    expect(headers[HEADER_ORG_ID]).toBe("org_a");
    expect(headers[HEADER_SCHEMA_VERSION]).toBe("v1");
    expect(headers[HEADER_WIRE_FORMAT]).toBe("protobuf");
    expect(headers[HEADER_IDEMPOTENCY_KEY]).toMatch(/^t-ingest-1:\d+$/);

    const batch = v1.TraceBatchCodec.decode(value);
    expect(batch.schemaVersion).toBe("v1");
    expect(batch.orgId).toBe("org_a");
    expect(batch.spans).toHaveLength(2);
    expect(batch.spans[0]!.name).toBe("llm.generate");
    expect(batch.spans[0]!.kind).toBe(v1.SpanKind.CLIENT);
    expect(batch.spans[0]!.status.code).toBe(v1.StatusCode.OK);
    expect(batch.spans[1]!.parentSpanId).toBe("s-0");
    expect(batch.spans[1]!.status.code).toBe(v1.StatusCode.ERROR);
  });

  it("stamps every span with the authenticated orgId (guardrail)", () => {
    const { value } = buildIngestPayload(mkTrace(), "org_auth");
    const batch = v1.TraceBatchCodec.decode(value);
    for (const s of batch.spans) {
      expect(s.orgId).toBe("org_auth");
    }
  });

  it("maps int attributes to intValue and float attributes to doubleValue", () => {
    const tr = mkTrace({
      spans: [
        {
          traceId: "t",
          spanId: "s",
          name: "x",
          kind: "agent_step",
          startTimeMs: 0,
          endTimeMs: 1,
          status: "ok",
          attributes: { ints: 42, floats: 3.14, flag: true, s: "hi", missing: null },
          events: [],
        },
      ],
    });
    const { value } = buildIngestPayload(tr, "o");
    const batch = v1.TraceBatchCodec.decode(value);
    const attrs = batch.spans[0]!.attributes;
    expect(attrs["ints"]).toEqual({ intValue: "42" });
    expect(attrs["floats"]).toEqual({ doubleValue: 3.14 });
    expect(attrs["flag"]).toEqual({ boolValue: true });
    expect(attrs["s"]).toEqual({ stringValue: "hi" });
    expect(attrs["missing"]).toBeUndefined();
  });
});

describe("api · ingest-producer · enqueueTrace → InMemory bus round-trip", () => {
  beforeEach(() => {
    resetInMemoryBus();
    process.env["FOXHOUND_QUEUE_ADAPTER"] = "in-memory";
  });
  afterEach(async () => {
    await closeIngestProducer();
    delete process.env["FOXHOUND_QUEUE_ADAPTER"];
  });

  it("produces a message a consumer sees with the expected headers + body", async () => {
    const consumer = new InMemoryConsumer();
    const received: QueueMessage[] = [];
    await consumer.subscribe({
      topic: TOPIC_SPANS_V1,
      groupId: "test-e2e",
      handler: async (m) => {
        received.push(m);
      },
    });

    await enqueueTrace(mkTrace(), "org_e2e");

    // Wait for in-memory delivery.
    for (let i = 0; i < 50 && received.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(received).toHaveLength(1);
    const msg = received[0]!;
    expect(msg.topic).toBe(TOPIC_SPANS_V1);
    expect(msg.headers[HEADER_ORG_ID]).toBe("org_e2e");
    expect(msg.headers[HEADER_SCHEMA_VERSION]).toBe("v1");
    expect(new TextDecoder().decode(msg.key)).toBe("t-ingest-1");
    // Body round-trips through the proto codec.
    const batch = v1.TraceBatchCodec.decode(msg.value);
    expect(batch.orgId).toBe("org_e2e");
    expect(batch.spans).toHaveLength(2);

    await consumer.close();
  });

  it("tenant guardrail: every produced span carries the authenticated org_id", async () => {
    const consumer = new InMemoryConsumer();
    const bodies: Uint8Array[] = [];
    await consumer.subscribe({
      topic: TOPIC_SPANS_V1,
      groupId: "test-tenant",
      handler: async (m) => {
        bodies.push(m.value);
      },
    });
    await enqueueTrace(mkTrace(), "org_strict");
    for (let i = 0; i < 50 && bodies.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    const batch = v1.TraceBatchCodec.decode(bodies[0]!);
    for (const s of batch.spans) expect(s.orgId).toBe("org_strict");

    await consumer.close();
  });
});
