/**
 * Redis Streams adapter contract test.
 *
 * Skipped when `REDIS_QUEUE_URL` is not set. Run with:
 *   docker run --rm -p 6379:6379 redis:7
 *   REDIS_QUEUE_URL=redis://localhost:6379 pnpm --filter @foxhound/queue test
 */
import { describe, it } from "vitest";
import { runContract } from "./contract.js";

const REDIS = process.env["REDIS_QUEUE_URL"];

if (!REDIS) {
  describe.skip("queue contract · redis-streams (REDIS_QUEUE_URL unset — skipping)", () => {
    it("requires Redis; set REDIS_QUEUE_URL to enable", () => {});
  });
} else {
  const { RedisStreamsProducer, RedisStreamsConsumer } =
    await import("../src/adapters/redis-streams.js");
  runContract({
    name: "redis-streams",
    settleMs: 500,
    make: async () => {
      const producer = new RedisStreamsProducer({ url: REDIS });
      const consumer = new RedisStreamsConsumer({ url: REDIS });
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
