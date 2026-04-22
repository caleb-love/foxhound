import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { v1 } from "@foxhound/proto";
import {
  HEADER_ORG_ID,
  TOPIC_SPANS_V1,
  resetInMemoryBus,
  InMemoryProducer,
  type QueueMessage,
} from "@foxhound/queue";
import type { Trace } from "@foxhound/types";
import {
  IngestPersistenceConsumer,
  groupBatchIntoTraces,
  type Logger,
} from "./ingest-persistence.js";

const fakeLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

function mkBatch(orgId: string, spanOrg = orgId, count = 2): Uint8Array {
  return v1.TraceBatchCodec.encode({
    schemaVersion: "v1",
    batchId: 1,
    orgId,
    sdkLanguage: "edge",
    sdkVersion: "ingest-enqueue",
    spans: Array.from({ length: count }, (_, i) => ({
      orgId: spanOrg,
      traceId: "t".repeat(32),
      spanId: `${i}`.padStart(16, "s"),
      name: `step.${i}`,
      kind: v1.SpanKind.INTERNAL,
      startTimeUnixNano: String(1_700_000_000_000_000_000n + BigInt(i)),
      endTimeUnixNano: String(1_700_000_000_050_000_000n + BigInt(i)),
      status: { code: v1.StatusCode.OK, message: "" },
      attributes: {},
      events: [],
    })),
  });
}

describe("worker · ingest-persistence · groupBatchIntoTraces", () => {
  it("groups spans by traceId and converts timestamps back to ms", () => {
    const bytes = mkBatch("org_a", "org_a", 3);
    const decoded = v1.TraceBatchCodec.decode(bytes);
    const traces = groupBatchIntoTraces(decoded);
    expect(traces).toHaveLength(1);
    expect(traces[0]!.spans).toHaveLength(3);
    expect(traces[0]!.spans[0]!.startTimeMs).toBe(1_700_000_000_000);
    expect(traces[0]!.metadata["foxhound.wire_format"]).toBe("protobuf");
  });

  // ── WP15 · agent_id recovery ────────────────────────────────────────

  const mkSpan = (opts: {
    spanId: string;
    parentSpanId?: string;
    agentId?: string;
  }): v1.Span => ({
    orgId: "org_a",
    traceId: "t".repeat(32),
    spanId: opts.spanId,
    name: "s",
    kind: v1.SpanKind.INTERNAL,
    startTimeUnixNano: "1700000000000000000",
    endTimeUnixNano: "1700000000050000000",
    status: { code: v1.StatusCode.OK, message: "" },
    attributes: {},
    events: [],
    ...(opts.parentSpanId !== undefined ? { parentSpanId: opts.parentSpanId } : {}),
    ...(opts.agentId !== undefined ? { agentId: opts.agentId } : {}),
  });

  it("WP15 recovers trace.agentId from the root span's agent_id", () => {
    const batch: v1.TraceBatch = {
      schemaVersion: "v1",
      batchId: 1,
      orgId: "org_a",
      spans: [
        mkSpan({ spanId: "root", agentId: "planner" }),
        mkSpan({ spanId: "child1", parentSpanId: "root", agentId: "researcher" }),
        mkSpan({ spanId: "child2", parentSpanId: "root", agentId: "coder" }),
      ],
    };
    const traces = groupBatchIntoTraces(batch);
    expect(traces).toHaveLength(1);
    expect(traces[0]!.agentId).toBe("planner");
  });

  it("WP15 root-agent wins even when a non-root span arrives first", () => {
    const batch: v1.TraceBatch = {
      schemaVersion: "v1",
      batchId: 1,
      orgId: "org_a",
      spans: [
        // Non-root arrives first (out-of-order delivery).
        mkSpan({ spanId: "child", parentSpanId: "root", agentId: "researcher" }),
        // Root lands later; should upgrade the trace-level agentId.
        mkSpan({ spanId: "root", agentId: "planner" }),
      ],
    };
    const traces = groupBatchIntoTraces(batch);
    expect(traces[0]!.agentId).toBe("planner");
  });

  it("WP15 falls back to first non-empty agentId when no root span has one", () => {
    const batch: v1.TraceBatch = {
      schemaVersion: "v1",
      batchId: 1,
      orgId: "org_a",
      spans: [
        mkSpan({ spanId: "root" }), // no agent_id on root
        mkSpan({ spanId: "child", parentSpanId: "root", agentId: "researcher" }),
      ],
    };
    const traces = groupBatchIntoTraces(batch);
    expect(traces[0]!.agentId).toBe("researcher");
  });

  it("WP15 preserves per-span agentId on the internal Span objects", () => {
    const batch: v1.TraceBatch = {
      schemaVersion: "v1",
      batchId: 1,
      orgId: "org_a",
      spans: [
        mkSpan({ spanId: "root", agentId: "planner" }),
        mkSpan({ spanId: "child", parentSpanId: "root", agentId: "researcher" }),
      ],
    };
    const traces = groupBatchIntoTraces(batch);
    const spans = traces[0]!.spans;
    const root = spans.find((s) => s.spanId === "root")!;
    const child = spans.find((s) => s.spanId === "child")!;
    expect(root.agentId).toBe("planner");
    expect(child.agentId).toBe("researcher");
  });

  it("WP15 leaves trace.agentId empty when no span carries an agent_id", () => {
    const batch: v1.TraceBatch = {
      schemaVersion: "v1",
      batchId: 1,
      orgId: "org_a",
      spans: [
        mkSpan({ spanId: "root" }),
        mkSpan({ spanId: "child", parentSpanId: "root" }),
      ],
    };
    const traces = groupBatchIntoTraces(batch);
    expect(traces[0]!.agentId).toBe("");
    for (const s of traces[0]!.spans) {
      expect(s.agentId).toBeUndefined();
    }
  });
});

describe("worker · ingest-persistence · handleMessage", () => {
  let persistCalls: Array<{ trace: Trace; orgId: string }>;
  let consumer: IngestPersistenceConsumer;

  beforeEach(() => {
    resetInMemoryBus();
    process.env["FOXHOUND_QUEUE_ADAPTER"] = "in-memory";
    persistCalls = [];
    consumer = new IngestPersistenceConsumer({
      log: fakeLogger,
      persist: async (_log, trace, orgId) => {
        persistCalls.push({ trace, orgId });
      },
    });
  });

  afterEach(async () => {
    await consumer.stop();
    delete process.env["FOXHOUND_QUEUE_ADAPTER"];
  });

  const makeMsg = (orgHeader: string, bytes: Uint8Array): QueueMessage => ({
    topic: TOPIC_SPANS_V1,
    partition: 0,
    offset: "1",
    key: new TextEncoder().encode("t".repeat(32)),
    value: bytes,
    headers: { [HEADER_ORG_ID]: orgHeader, schema_version: "v1" },
    timestamp: Date.now(),
  });

  it("persists a valid batch and acks", async () => {
    const res = await consumer.handleMessage(makeMsg("org_a", mkBatch("org_a")));
    expect(res).toBe("ack");
    expect(persistCalls).toHaveLength(1);
    expect(persistCalls[0]!.orgId).toBe("org_a");
    expect(persistCalls[0]!.trace.spans).toHaveLength(2);
  });

  it("NACKS when header org_id is missing", async () => {
    const msg: QueueMessage = {
      topic: TOPIC_SPANS_V1,
      partition: 0,
      offset: "1",
      key: new Uint8Array(),
      value: mkBatch("org_a"),
      headers: {},
      timestamp: Date.now(),
    };
    const res = await consumer.handleMessage(msg);
    expect(res).toBe("nack");
    expect(persistCalls).toHaveLength(0);
  });

  it("NACKS when batch.org_id mismatches header (cross-tenant guardrail)", async () => {
    const res = await consumer.handleMessage(makeMsg("org_me", mkBatch("org_leaked")));
    expect(res).toBe("nack");
    expect(persistCalls).toHaveLength(0);
  });

  it("NACKS when a single span org_id mismatches (per-span cross-tenant guardrail)", async () => {
    const res = await consumer.handleMessage(
      makeMsg("org_me", mkBatch("org_me", "org_leaked")),
    );
    expect(res).toBe("nack");
    expect(persistCalls).toHaveLength(0);
  });

  it("NACKS a malformed payload", async () => {
    const res = await consumer.handleMessage(
      makeMsg("org_me", new Uint8Array([0xff, 0xff])),
    );
    expect(res).toBe("nack");
    expect(persistCalls).toHaveLength(0);
  });

  it("throws through to the consumer adapter when persist fails (redelivery)", async () => {
    consumer = new IngestPersistenceConsumer({
      log: fakeLogger,
      persist: async () => {
        throw new Error("db down");
      },
    });
    await expect(
      consumer.handleMessage(makeMsg("org_a", mkBatch("org_a"))),
    ).rejects.toThrow("db down");
  });
});

describe("worker · ingest-persistence · end-to-end through InMemory bus", () => {
  beforeEach(() => {
    resetInMemoryBus();
    process.env["FOXHOUND_QUEUE_ADAPTER"] = "in-memory";
  });
  afterEach(() => {
    delete process.env["FOXHOUND_QUEUE_ADAPTER"];
  });

  it("a producer→consumer loop persists the decoded trace", async () => {
    const persisted: Trace[] = [];
    const c = new IngestPersistenceConsumer({
      log: fakeLogger,
      persist: async (_l, trace) => {
        persisted.push(trace);
      },
      metrics: vi.fn(),
    });
    await c.start();

    const producer = new InMemoryProducer();
    await producer.produce({
      topic: TOPIC_SPANS_V1,
      key: "t".repeat(32),
      value: mkBatch("org_loop"),
      headers: { [HEADER_ORG_ID]: "org_loop", schema_version: "v1" },
    });

    for (let i = 0; i < 50 && persisted.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.spans).toHaveLength(2);
    await c.stop();
    await producer.close();
  });
});
