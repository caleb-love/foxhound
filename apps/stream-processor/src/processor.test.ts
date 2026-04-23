/**
 * Processor integration tests — the WP14 "Integration" bucket.
 *
 * Uses the `@foxhound/queue` in-memory adapter as a faithful bus so the
 * producer → consumer path mirrors production. The test confirms:
 *
 *  1. End-to-end budget breach fires a `cost_budget_exceeded` alert
 *     within wall-clock 5 s of the breaching span being produced
 *     (WP14 latency gate).
 *  2. Cross-tenant batches (`batch.orgId !== headers.org_id`) are nacked
 *     without touching handler state (guardrail).
 *  3. Trace-close fanout fires handler `onTraceClose` when idle passes,
 *     driven by the processor's own accumulator clock (Pattern 9).
 *  4. Handler `onTick` is invoked by the processor sweep.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { v1 } from "@foxhound/proto";
import {
  HEADER_ORG_ID,
  HEADER_SCHEMA_VERSION,
  HEADER_WIRE_FORMAT,
  TOPIC_SPANS_V1,
  createProducer,
  createConsumer,
} from "@foxhound/queue";
import { resetInMemoryBus } from "@foxhound/queue/testing";
import { StreamProcessor } from "./processor.js";
import { BudgetHandler } from "./handlers/budget.js";
import { SlaHandler } from "./handlers/sla.js";
import { COST_ATTR } from "./handlers/types.js";
import { setConfig, spyEmitter, stubData } from "./handlers/test-utils.js";
import type { SpanHandler, SpanObservation, TraceCloseObservation } from "./handlers/types.js";

const SILENT_LOG = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

function buildTraceBatch(input: {
  orgId: string;
  agentId: string;
  traceId: string;
  spans: Array<{ spanId: string; name?: string; costUsd?: number; status?: "ok" | "error" }>;
}): Uint8Array {
  const baseTime = BigInt(Date.now()) * 1_000_000n;
  const batch: v1.TraceBatch = {
    orgId: input.orgId,
    schemaVersion: "v1",
    sdkLanguage: "node",
    sdkVersion: "test",
    spans: input.spans.map((s, i) => {
      const attrs: Record<string, v1.AttributeValue> = {
        "agent.id": { stringValue: input.agentId },
      };
      if (s.costUsd !== undefined) {
        attrs[COST_ATTR] = { doubleValue: s.costUsd };
      }
      const span: v1.Span = {
        orgId: input.orgId,
        traceId: input.traceId,
        spanId: s.spanId,
        parentSpanId: "",
        name: s.name ?? "llm.chat",
        kind: v1.SpanKind.CLIENT,
        startTimeUnixNano: String(baseTime + BigInt(i) * 1_000_000n),
        endTimeUnixNano: String(baseTime + BigInt(i + 1) * 1_000_000n),
        status: {
          code: s.status === "error" ? v1.StatusCode.ERROR : v1.StatusCode.OK,
          message: "",
        },
        attributes: attrs,
        events: [],
      };
      return span;
    }),
  };
  return v1.TraceBatchCodec.encode(batch);
}

describe("StreamProcessor", () => {
  beforeEach(() => resetInMemoryBus());

  it("drives end-to-end: a breaching span produces a cost_budget_exceeded alert", async () => {
    const data = stubData();
    setConfig(data, {
      orgId: "org-a",
      agentId: "agent-a",
      costBudgetUsd: 5,
      budgetPeriod: "daily",
      costAlertThresholdPct: 80,
    });
    const emitter = spyEmitter();
    const budget = new BudgetHandler({ data, emitter, now: () => Date.now() });

    const consumer = createConsumer({ adapter: "in-memory" });
    const processor = new StreamProcessor({
      log: SILENT_LOG,
      handlers: [budget],
      _consumer: consumer,
      tickMs: 50,
      idleMs: 500,
      periodicMs: 2_000,
    });
    await processor.start();

    const producer = createProducer({ adapter: "in-memory" });
    const t0 = Date.now();
    // 6 spans of $1 each → crosses 80 %, then crosses 100 %.
    for (let i = 0; i < 6; i++) {
      const bytes = buildTraceBatch({
        orgId: "org-a",
        agentId: "agent-a",
        traceId: "trace-1",
        spans: [{ spanId: `s-${i}`, costUsd: 1 }],
      });
      await producer.produce({
        topic: TOPIC_SPANS_V1,
        key: "trace-1",
        value: bytes,
        headers: {
          [HEADER_ORG_ID]: "org-a",
          [HEADER_SCHEMA_VERSION]: "v1",
          [HEADER_WIRE_FORMAT]: "protobuf",
        },
      });
    }
    await producer.flush(1_000);

    // Poll until either we see both a warning and a critical, or the
    // 5 s budget-breach latency gate elapses.
    const deadline = t0 + 5_000;
    while (Date.now() < deadline) {
      const hasWarn = emitter.events.some((e) => e.severity === "high");
      const hasCrit = emitter.events.some((e) => e.severity === "critical");
      if (hasWarn && hasCrit) break;
      await sleep(25);
    }

    const latency = Date.now() - t0;
    expect(emitter.events.some((e) => e.severity === "high")).toBe(true);
    expect(emitter.events.some((e) => e.severity === "critical")).toBe(true);
    expect(latency).toBeLessThan(5_000);

    await processor.stop();
    await producer.close();
  });

  it("nacks cross-tenant batches without touching handler state", async () => {
    const data = stubData();
    setConfig(data, {
      orgId: "org-a",
      agentId: "agent-a",
      costBudgetUsd: 5,
      budgetPeriod: "daily",
      costAlertThresholdPct: 80,
    });
    const emitter = spyEmitter();
    const budget = new BudgetHandler({ data, emitter, now: () => Date.now() });

    const consumer = createConsumer({ adapter: "in-memory" });
    const processor = new StreamProcessor({
      log: SILENT_LOG,
      handlers: [budget],
      _consumer: consumer,
      tickMs: 50,
    });
    await processor.start();

    const producer = createProducer({ adapter: "in-memory" });
    // Batch claims org-a inside the payload but ships under org-b header.
    const bytes = buildTraceBatch({
      orgId: "org-a",
      agentId: "agent-a",
      traceId: "trace-x",
      spans: [{ spanId: "s-bad", costUsd: 1000 }],
    });
    await producer.produce({
      topic: TOPIC_SPANS_V1,
      key: "trace-x",
      value: bytes,
      headers: {
        [HEADER_ORG_ID]: "org-b", // mismatch!
        [HEADER_SCHEMA_VERSION]: "v1",
        [HEADER_WIRE_FORMAT]: "protobuf",
      },
    });
    await producer.flush(500);
    await sleep(200);

    // Cross-tenant batch must be rejected — no budget accumulator touched.
    expect(emitter.events).toHaveLength(0);
    expect(budget.snapshot("org-a", "agent-a")).toBeUndefined();
    expect(budget.snapshot("org-b", "agent-a")).toBeUndefined();

    await processor.stop();
    await producer.close();
  });

  it("fires onTraceClose when the idle window elapses", async () => {
    const data = stubData();
    setConfig(data, {
      orgId: "org-a",
      agentId: "agent-a",
      maxDurationMs: 10,
      minSampleSize: 1,
    });
    const emitter = spyEmitter();
    const sla = new SlaHandler({ data, emitter, now: () => Date.now() });
    const consumer = createConsumer({ adapter: "in-memory" });

    const processor = new StreamProcessor({
      log: SILENT_LOG,
      handlers: [sla],
      _consumer: consumer,
      tickMs: 25,
      idleMs: 100,
      periodicMs: 10_000,
      horizonMs: 60_000,
    });
    await processor.start();

    const producer = createProducer({ adapter: "in-memory" });
    // One span, 1 s of duration inside the payload → beyond 10 ms threshold.
    const baseMs = Date.now();
    const base = BigInt(baseMs) * 1_000_000n;
    const batch: v1.TraceBatch = {
      orgId: "org-a",
      schemaVersion: "v1",
      sdkLanguage: "node",
      sdkVersion: "test",
      spans: [
        {
          orgId: "org-a",
          traceId: "trace-sla",
          spanId: "s-1",
          parentSpanId: "",
          name: "llm.chat",
          kind: v1.SpanKind.CLIENT,
          startTimeUnixNano: String(base),
          endTimeUnixNano: String(base + 1_000_000_000n), // +1 s
          status: { code: v1.StatusCode.OK, message: "" },
          attributes: { "agent.id": { stringValue: "agent-a" } },
          events: [],
        },
      ],
    };
    await producer.produce({
      topic: TOPIC_SPANS_V1,
      key: "trace-sla",
      value: v1.TraceBatchCodec.encode(batch),
      headers: {
        [HEADER_ORG_ID]: "org-a",
        [HEADER_SCHEMA_VERSION]: "v1",
        [HEADER_WIRE_FORMAT]: "protobuf",
      },
    });
    await producer.flush(500);

    // Wait for idle close to fire.
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      if (emitter.events.some((e) => e.type === "sla_duration_breach")) break;
      await sleep(25);
    }
    expect(emitter.events.some((e) => e.type === "sla_duration_breach")).toBe(true);

    await processor.stop();
    await producer.close();
  });

  it("invokes onTick on every handler during the sweep", async () => {
    const ticks: number[] = [];
    const handler: SpanHandler = {
      name: "tick-spy",
      async onSpan(_o: SpanObservation) {},
      async onTraceClose(_o: TraceCloseObservation) {},
      onTick(now) {
        ticks.push(now);
      },
    };
    const processor = new StreamProcessor({
      log: SILENT_LOG,
      handlers: [handler],
      _consumer: createConsumer({ adapter: "in-memory" }),
      tickMs: 25,
    });
    await processor.start();
    await sleep(120);
    await processor.stop();
    expect(ticks.length).toBeGreaterThanOrEqual(3);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
