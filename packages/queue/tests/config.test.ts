import { describe, it, expect } from "vitest";
import { readQueueConfigFromEnv } from "../src/config.js";

describe("queue · config · env parsing", () => {
  it("defaults to in-memory when no env is set", () => {
    const c = readQueueConfigFromEnv({});
    expect(c.adapter).toBe("in-memory");
    expect(c.nats).toBeUndefined();
    expect(c.kafka).toBeUndefined();
    expect(c.redis).toBeUndefined();
  });

  it("reads NATS config", () => {
    const c = readQueueConfigFromEnv({
      FOXHOUND_QUEUE_ADAPTER: "nats",
      NATS_URL: "nats://localhost:4222",
      NATS_STREAM: "CUSTOM",
    });
    expect(c.adapter).toBe("nats");
    expect(c.nats).toEqual({ url: "nats://localhost:4222", stream: "CUSTOM" });
  });

  it("splits KAFKA_BROKERS on commas", () => {
    const c = readQueueConfigFromEnv({
      FOXHOUND_QUEUE_ADAPTER: "redpanda",
      KAFKA_BROKERS: "a:9092, b:9092 , c:9092",
      KAFKA_CLIENT_ID: "test-id",
    });
    expect(c.kafka?.brokers).toEqual(["a:9092", "b:9092", "c:9092"]);
    expect(c.kafka?.clientId).toBe("test-id");
  });

  it("reads Redis URL", () => {
    const c = readQueueConfigFromEnv({
      FOXHOUND_QUEUE_ADAPTER: "redis-streams",
      REDIS_QUEUE_URL: "redis://localhost:6379",
    });
    expect(c.adapter).toBe("redis-streams");
    expect(c.redis).toEqual({ url: "redis://localhost:6379" });
  });

  it("falls back to in-memory on an unknown adapter value", () => {
    const c = readQueueConfigFromEnv({ FOXHOUND_QUEUE_ADAPTER: "bogus" });
    expect(c.adapter).toBe("in-memory");
  });
});
