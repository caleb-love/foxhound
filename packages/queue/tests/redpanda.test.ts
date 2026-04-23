/**
 * Redpanda / Kafka adapter contract test.
 *
 * Skipped when `KAFKA_BROKERS` is not set. Run against a local Redpanda
 * (single-binary) or real Kafka:
 *   docker compose -f infra/compose/queue.yml up redpanda
 *   KAFKA_BROKERS=localhost:9092 pnpm --filter @foxhound/queue test
 */
import { describe, it } from "vitest";
import { runContract } from "./contract.js";

const BROKERS = process.env["KAFKA_BROKERS"];

if (!BROKERS) {
  describe.skip("queue contract · redpanda (KAFKA_BROKERS unset — skipping)", () => {
    it("requires Redpanda/Kafka broker; set KAFKA_BROKERS to enable", () => {});
  });
} else {
  const { RedpandaProducer, RedpandaConsumer } = await import("../src/adapters/redpanda.js");
  const brokers = BROKERS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  runContract({
    name: "redpanda",
    settleMs: 1500,
    make: async () => {
      const producer = new RedpandaProducer({ brokers, clientId: "foxhound-test" });
      const consumer = new RedpandaConsumer({ brokers, clientId: "foxhound-test" });
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
