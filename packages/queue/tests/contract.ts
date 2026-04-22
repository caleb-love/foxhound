/**
 * Shared contract test suite. Every adapter must pass these cases.
 *
 * Adapters that need an external service (NATS, Redpanda, Redis) wrap this
 * suite in their own test file and call `runContract()` only when the
 * service is reachable; otherwise the file's top-level `describe.skip` or
 * `it.skip` triggers.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  HEADER_ORG_ID,
  TOPIC_SPANS_V1,
  type QueueConsumer,
  type QueueMessage,
  type QueueProducer,
} from "../src/index.js";

export interface ContractHarness {
  readonly name: string;
  /** Called before every `it`. Must return a fresh producer + consumer. */
  readonly make: () => Promise<{
    producer: QueueProducer;
    consumer: QueueConsumer;
    /** Called after every `it` to drop any queue-side state. */
    teardown: () => Promise<void>;
  }>;
  /** Give the adapter time to deliver after produce. In-memory is instant. */
  readonly settleMs: number;
}

export function runContract(h: ContractHarness): void {
  describe(`queue contract · ${h.name}`, () => {
    let producer: QueueProducer;
    let consumer: QueueConsumer;
    let teardown: () => Promise<void>;

    beforeEach(async () => {
      ({ producer, consumer, teardown } = await h.make());
    });

    afterEach(async () => {
      await consumer.close().catch(() => {});
      await producer.close().catch(() => {});
      await teardown().catch(() => {});
    });

    const topic = TOPIC_SPANS_V1 + "_contract";

    it("produce→subscribe delivers a message with the right body and headers", async () => {
      const received: QueueMessage[] = [];
      await consumer.subscribe({
        topic,
        groupId: "test-g1",
        handler: async (m) => {
          received.push(m);
        },
      });

      await producer.produce({
        topic,
        key: "trace-1",
        value: new TextEncoder().encode("hello"),
        headers: { [HEADER_ORG_ID]: "org_a", schema_version: "v1" },
      });

      await waitUntil(() => received.length >= 1, h.settleMs + 2000);
      expect(received).toHaveLength(1);
      const msg = received[0]!;
      expect(new TextDecoder().decode(msg.value)).toBe("hello");
      expect(msg.headers[HEADER_ORG_ID]).toBe("org_a");
      expect(msg.headers["schema_version"]).toBe("v1");
    });

    it("refuses to produce without org_id header (tenant contract)", async () => {
      await expect(
        producer.produce({
          topic,
          key: "trace-2",
          value: new Uint8Array(),
          headers: {},
        }),
      ).rejects.toThrow();
    });

    it("same partition key → same logical partition (ordering invariant)", async () => {
      const delivered: QueueMessage[] = [];
      await consumer.subscribe({
        topic,
        groupId: "test-g2",
        handler: async (m) => {
          delivered.push(m);
        },
      });

      // Emit N messages with the same key.
      for (let i = 0; i < 10; i++) {
        await producer.produce({
          topic,
          key: "same-trace",
          value: new TextEncoder().encode(`m${i}`),
          headers: { [HEADER_ORG_ID]: "org_a", seq: String(i) },
        });
      }

      await waitUntil(() => delivered.length >= 10, h.settleMs + 3000);
      expect(delivered).toHaveLength(10);
      // All same partition.
      const partitions = new Set(delivered.map((m) => m.partition));
      expect(partitions.size).toBe(1);
      // Order preserved.
      for (let i = 0; i < 10; i++) {
        expect(delivered[i]!.headers["seq"]).toBe(String(i));
      }
    });

    it("redelivers a message after the handler throws (at-least-once)", async () => {
      let attempt = 0;
      const delivered: QueueMessage[] = [];
      await consumer.subscribe({
        topic,
        groupId: "test-g3",
        handler: async (m) => {
          attempt += 1;
          if (attempt === 1) throw new Error("boom on first try");
          delivered.push(m);
        },
      });

      await producer.produce({
        topic,
        key: "retry-1",
        value: new TextEncoder().encode("v"),
        headers: { [HEADER_ORG_ID]: "org_a" },
      });

      await waitUntil(() => delivered.length >= 1, h.settleMs + 5000);
      expect(attempt).toBeGreaterThanOrEqual(2);
      expect(delivered).toHaveLength(1);
    });

    it("lagSeconds returns a non-negative number (or -1 for unsupported)", async () => {
      await consumer.subscribe({
        topic,
        groupId: "test-g4",
        handler: async () => {},
      });
      await producer.produce({
        topic,
        key: "lag-k",
        value: new Uint8Array([1, 2, 3]),
        headers: { [HEADER_ORG_ID]: "org_a" },
      });
      const lag = await consumer.lagSeconds({ topic, groupId: "test-g4" });
      expect(typeof lag).toBe("number");
      expect(lag === -1 || lag >= 0).toBe(true);
    });

    it("close is idempotent", async () => {
      await producer.close();
      await producer.close();
      await consumer.close();
      await consumer.close();
    });
  });
}

async function waitUntil(cond: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) return;
    await new Promise((r) => setTimeout(r, 20));
  }
}
