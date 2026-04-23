import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { v1 } from "@foxhound/proto";
import {
  HEADER_ORG_ID,
  InMemoryProducer,
  InMemoryConsumer,
  TOPIC_SPANS_V1,
  resetInMemoryBus,
} from "@foxhound/queue";
import { RollupConsumer, type Logger } from "./rollup.js";
import type { AnalyticsClient } from "@foxhound/db-analytics";

const silentLog: Logger = { info: () => {}, warn: () => {}, error: () => {} };

function fakeAnalytics(): {
  client: AnalyticsClient;
  inserts: Array<{ table: string; values: unknown[] }>;
  failNext: () => void;
} {
  const inserts: Array<{ table: string; values: unknown[] }> = [];
  let shouldFailNext = false;
  const client: AnalyticsClient = {
    raw: {
      insert: (args: unknown) => {
        if (shouldFailNext) {
          shouldFailNext = false;
          return Promise.reject(new Error("ch down"));
        }
        inserts.push(args as { table: string; values: unknown[] });
        return Promise.resolve({ query_id: "x", executed: true });
      },
      query: () => Promise.resolve({ json: () => Promise.resolve([]) }),
      command: () => Promise.resolve(undefined),
      ping: () => Promise.resolve({ success: true, response: "" }),
      close: () => Promise.resolve(undefined),
    } as unknown as AnalyticsClient["raw"],
    database: "foxhound",
    options: {
      url: "x",
      database: "foxhound",
      username: "default",
      password: "",
      insertBatchRows: 10,
      insertBatchMs: 100,
    },
    close: () => Promise.resolve(undefined),
  };
  return { client, inserts, failNext: () => (shouldFailNext = true) };
}

function mkBatchBytes(opts: {
  orgId: string;
  traceId: string;
  spans: Array<{
    id: string;
    name?: string;
    kind?: v1.SpanKind;
    start: number;
    end: number;
    error?: boolean;
    attrs?: Record<string, v1.AttributeValue>;
  }>;
}): Uint8Array {
  return v1.TraceBatchCodec.encode({
    schemaVersion: "v1",
    batchId: 1,
    orgId: opts.orgId,
    sdkLanguage: "edge",
    sdkVersion: "0.3.0",
    spans: opts.spans.map((s) => ({
      orgId: opts.orgId,
      traceId: opts.traceId,
      spanId: s.id,
      name: s.name ?? "step",
      kind: s.kind ?? v1.SpanKind.CLIENT,
      startTimeUnixNano: String(BigInt(s.start) * 1_000_000n),
      endTimeUnixNano: String(BigInt(s.end) * 1_000_000n),
      status: {
        code: s.error ? v1.StatusCode.ERROR : v1.StatusCode.OK,
        message: "",
      },
      attributes: s.attrs ?? {},
      events: [],
    })),
  });
}

function mkMsg(orgId: string, bytes: Uint8Array) {
  return {
    topic: TOPIC_SPANS_V1,
    partition: 0,
    offset: "1",
    key: new TextEncoder().encode("t"),
    value: bytes,
    headers: { [HEADER_ORG_ID]: orgId, schema_version: "v1" },
    timestamp: Date.now(),
  };
}

describe("worker · RollupConsumer · handleMessage", () => {
  let rc: RollupConsumer;
  let fa: ReturnType<typeof fakeAnalytics>;

  beforeEach(() => {
    resetInMemoryBus();
    fa = fakeAnalytics();
    rc = new RollupConsumer({
      log: silentLog,
      analytics: fa.client,
      _consumer: new InMemoryConsumer(),
      idleMs: 100,
      periodicFlushMs: 5_000,
      horizonMs: 60_000,
      tickMs: 5_000,
      maxOpen: 50,
    });
  });

  afterEach(async () => {
    await rc.stop();
  });

  it("ACKs a well-formed batch and creates an in-memory accumulator", async () => {
    const bytes = mkBatchBytes({
      orgId: "org_a",
      traceId: "t-1",
      spans: [{ id: "s-0", start: 1_700_000_000_000, end: 1_700_000_000_100 }],
    });
    const res = await rc.handleMessage(mkMsg("org_a", bytes));
    expect(res).toBe("ack");
    expect(rc.openCount()).toBe(1);
  });

  it("NACKs when header org_id is missing", async () => {
    const bytes = mkBatchBytes({
      orgId: "org_a",
      traceId: "t-2",
      spans: [{ id: "s", start: 1, end: 2 }],
    });
    const msg = mkMsg("", bytes);
    const res = await rc.handleMessage(msg);
    expect(res).toBe("nack");
    expect(rc.openCount()).toBe(0);
  });

  it("NACKs when batch.org_id != caller (cross-tenant guardrail)", async () => {
    const bytes = mkBatchBytes({
      orgId: "org_leaked",
      traceId: "t-3",
      spans: [{ id: "s", start: 1, end: 2 }],
    });
    const res = await rc.handleMessage(mkMsg("org_me", bytes));
    expect(res).toBe("nack");
  });

  it("NACKs when a span org_id mismatches (per-span cross-tenant guardrail)", async () => {
    // Build a batch with matching batch.orgId but a span carrying a different one.
    const bytes = v1.TraceBatchCodec.encode({
      schemaVersion: "v1",
      batchId: 1,
      orgId: "org_a",
      spans: [
        {
          orgId: "org_LEAK",
          traceId: "t-leak",
          spanId: "s",
          name: "x",
          kind: v1.SpanKind.INTERNAL,
          startTimeUnixNano: "1",
          endTimeUnixNano: "2",
          status: { code: v1.StatusCode.OK, message: "" },
          attributes: {},
          events: [],
        },
      ],
    });
    const res = await rc.handleMessage(mkMsg("org_a", bytes));
    expect(res).toBe("nack");
  });

  it("NACKs a malformed payload", async () => {
    const res = await rc.handleMessage(mkMsg("org_a", new Uint8Array([0xff, 0xff])));
    expect(res).toBe("nack");
  });

  it("dedupes span_id on redelivery (same span arriving twice is counted once)", async () => {
    const bytes = mkBatchBytes({
      orgId: "org_a",
      traceId: "t-dup",
      spans: [{ id: "dup", start: 10, end: 20 }],
    });
    await rc.handleMessage(mkMsg("org_a", bytes));
    await rc.handleMessage(mkMsg("org_a", bytes)); // redelivery
    const now = 1_700_000_001_000;
    const rc2 = new RollupConsumer({
      log: silentLog,
      analytics: fa.client,
      _consumer: new InMemoryConsumer(),
      idleMs: 100,
      _now: () => now,
    });
    // Re-use the accumulator state by calling sweep via the same instance:
    await rc.sweep({ force: true });
    const firstInsert = fa.inserts[0] as { values: Array<{ total_spans: number }> };
    expect(firstInsert.values[0].total_spans).toBe(1);
    await rc2.stop();
  });

  it("partitions state by (org_id, trace_id); two orgs keep separate accumulators", async () => {
    await rc.handleMessage(
      mkMsg("org_a", mkBatchBytes({
        orgId: "org_a",
        traceId: "t-shared",
        spans: [{ id: "s", start: 1, end: 2 }],
      })),
    );
    await rc.handleMessage(
      mkMsg("org_b", mkBatchBytes({
        orgId: "org_b",
        traceId: "t-shared", // intentionally same trace id across orgs
        spans: [{ id: "s", start: 1, end: 2 }],
      })),
    );
    expect(rc.openCount()).toBe(2);
  });
});

describe("worker · RollupConsumer · sweep + close detection", () => {
  it("flushes idle accumulators", async () => {
    const fa = fakeAnalytics();
    let now = 1_700_000_000_000;
    const rc = new RollupConsumer({
      log: silentLog,
      analytics: fa.client,
      _consumer: new InMemoryConsumer(),
      idleMs: 50,
      periodicFlushMs: 10_000,
      horizonMs: 10_000,
      tickMs: 10_000,
      _now: () => now,
    });

    await rc.handleMessage(
      mkMsg(
        "org_a",
        mkBatchBytes({
          orgId: "org_a",
          traceId: "t-idle",
          spans: [{ id: "s", start: 1, end: 100 }],
        }),
      ),
    );
    expect(rc.openCount()).toBe(1);

    // Advance clock past idleMs and sweep.
    now += 200;
    await rc.sweep();

    expect(fa.inserts).toHaveLength(1);
    const call = fa.inserts[0];
    expect(call.table).toBe("conversation_rows");
    expect((call.values[0] as { trace_id: string }).trace_id).toBe("t-idle");
    expect(rc.openCount()).toBe(0); // idle-closed accumulators are removed
    await rc.stop();
  });

  it("upserts periodically for long-running traces without removing them", async () => {
    const fa = fakeAnalytics();
    let now = 1_700_000_000_000;
    const rc = new RollupConsumer({
      log: silentLog,
      analytics: fa.client,
      _consumer: new InMemoryConsumer(),
      idleMs: 100_000, // far in the future
      periodicFlushMs: 50,
      horizonMs: 100_000,
      tickMs: 10_000,
      _now: () => now,
    });

    await rc.handleMessage(
      mkMsg(
        "org_a",
        mkBatchBytes({
          orgId: "org_a",
          traceId: "t-long",
          spans: [{ id: "s0", start: 1, end: 10 }],
        }),
      ),
    );
    // Advance past periodicFlushMs (50); first sweep upserts via the
    // `referenceMs = createdMs` fallback path.
    now += 60;
    await rc.sweep();
    expect(fa.inserts).toHaveLength(1);
    expect(rc.openCount()).toBe(1); // not idle, stays in memory

    // Add another span, advance past periodicFlushMs again, sweep.
    await rc.handleMessage(
      mkMsg(
        "org_a",
        mkBatchBytes({
          orgId: "org_a",
          traceId: "t-long",
          spans: [{ id: "s1", start: 20, end: 30 }],
        }),
      ),
    );
    now += 60;
    await rc.sweep();
    expect(fa.inserts).toHaveLength(2);
    expect(rc.openCount()).toBe(1); // still open

    // The second row must have more spans than the first (post-dedup).
    const first = fa.inserts[0].values[0] as { total_spans: number; updated_at: string };
    const second = fa.inserts[1].values[0] as { total_spans: number; updated_at: string };
    expect(second.total_spans).toBeGreaterThan(first.total_spans);
    expect(second.updated_at > first.updated_at).toBe(true); // ReplacingMergeTree contract
    await rc.stop();
  });

  it("forces flush + removes everything on stop()", async () => {
    const fa = fakeAnalytics();
    const rc = new RollupConsumer({
      log: silentLog,
      analytics: fa.client,
      _consumer: new InMemoryConsumer(),
      idleMs: 100_000,
      periodicFlushMs: 100_000,
      horizonMs: 100_000,
      tickMs: 10_000,
    });
    await rc.handleMessage(
      mkMsg(
        "org_a",
        mkBatchBytes({
          orgId: "org_a",
          traceId: "t-stop",
          spans: [{ id: "s", start: 1, end: 2 }],
        }),
      ),
    );
    expect(rc.openCount()).toBe(1);
    await rc.stop();
    expect(fa.inserts).toHaveLength(1); // flushed on stop
    expect(rc.openCount()).toBe(0);
  });

  it("pressure-relief flushes oldest when maxOpen is exceeded", async () => {
    const fa = fakeAnalytics();
    const rc = new RollupConsumer({
      log: silentLog,
      analytics: fa.client,
      _consumer: new InMemoryConsumer(),
      idleMs: 100_000,
      periodicFlushMs: 100_000,
      horizonMs: 100_000,
      tickMs: 10_000,
      maxOpen: 2,
    });
    // Three distinct traces → one pressure-relief flush of the oldest.
    for (const tid of ["t-a", "t-b", "t-c"]) {
      await rc.handleMessage(
        mkMsg(
          "org_a",
          mkBatchBytes({
            orgId: "org_a",
            traceId: tid,
            spans: [{ id: "s", start: 1, end: 2 }],
          }),
        ),
      );
    }
    expect(fa.inserts.length).toBeGreaterThanOrEqual(1);
    expect(rc.openCount()).toBeLessThanOrEqual(2);
    await rc.stop();
  });
});

describe("worker · RollupConsumer · end-to-end through the in-memory bus", () => {
  it("a producer → consumer loop produces a ConversationRow upsert", async () => {
    resetInMemoryBus();
    const fa = fakeAnalytics();
    let now = 1_700_000_000_000;
    const rc = new RollupConsumer({
      log: silentLog,
      analytics: fa.client,
      _consumer: new InMemoryConsumer(),
      idleMs: 50,
      periodicFlushMs: 10_000,
      horizonMs: 10_000,
      tickMs: 10_000,
      _now: () => now,
    });
    await rc.start();

    const producer = new InMemoryProducer();
    await producer.produce({
      topic: TOPIC_SPANS_V1,
      key: "t-loop",
      value: mkBatchBytes({
        orgId: "org_loop",
        traceId: "t-loop",
        spans: [
          {
            id: "s-0",
            kind: v1.SpanKind.CLIENT,
            start: 1_700_000_000_000,
            end: 1_700_000_000_100,
          },
        ],
      }),
      headers: { [HEADER_ORG_ID]: "org_loop", schema_version: "v1" },
    });

    // Wait for the consumer to receive.
    for (let i = 0; i < 50 && rc.openCount() === 0; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(rc.openCount()).toBe(1);

    // Advance past idle, sweep.
    now += 200;
    await rc.sweep();

    expect(fa.inserts).toHaveLength(1);
    const row = fa.inserts[0].values[0] as {
      trace_id: string;
      total_llm_calls: number;
      status: string;
    };
    expect(row.trace_id).toBe("t-loop");
    expect(row.total_llm_calls).toBe(1);
    expect(row.status).toBe("ok");

    await rc.stop();
    await producer.close();
  });
});
