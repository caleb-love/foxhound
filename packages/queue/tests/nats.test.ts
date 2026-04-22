/**
 * NATS JetStream adapter contract test.
 *
 * Skipped when `NATS_URL` is not set. Run against a local NATS JetStream
 * with:
 *   docker run --rm -p 4222:4222 nats -js
 *   NATS_URL=nats://localhost:4222 pnpm --filter @foxhound/queue test
 */
import { describe, it } from "vitest";
import { runContract } from "./contract.js";

const NATS_URL = process.env["NATS_URL"];

if (!NATS_URL) {
  describe.skip("queue contract · nats (NATS_URL unset — skipping)", () => {
    it("requires nats-server running; set NATS_URL to enable", () => {});
  });
} else {
  // Lazy import so a missing `nats` dep doesn't crash the test run on
  // hosts that never use this adapter.
  const { NatsProducer, NatsConsumer } = await import("../src/adapters/nats.js");
  const stream = `FOXHOUND_TEST_${Date.now()}`;
  runContract({
    name: "nats",
    settleMs: 500,
    make: async () => {
      const producer = new NatsProducer({ url: NATS_URL, stream });
      const consumer = new NatsConsumer({ url: NATS_URL, stream });
      return {
        producer,
        consumer,
        teardown: async () => {
          await consumer.close().catch(() => {});
          await producer.close().catch(() => {});
        },
      };
    },
  });
}
