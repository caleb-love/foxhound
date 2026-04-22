import type { AdapterName, QueueConsumer, QueueProducer } from "./types.js";
import type { QueueConfig } from "./config.js";
import { InMemoryConsumer, InMemoryProducer } from "./adapters/in-memory.js";

export function createProducer(config: QueueConfig): QueueProducer {
  return instantiateProducer(config.adapter, config);
}

export function createConsumer(config: QueueConfig): QueueConsumer {
  return instantiateConsumer(config.adapter, config);
}

function instantiateProducer(adapter: AdapterName, config: QueueConfig): QueueProducer {
  if (adapter === "in-memory") return new InMemoryProducer();
  if (adapter === "nats") {
    if (!config.nats) throw new Error("NATS_URL required for nats adapter");
    // Lazy-load so the module doesn't fail to import on hosts without the
    // adapter's runtime deps available.
    const { NatsProducer } = loadNats();
    return new NatsProducer(config.nats);
  }
  if (adapter === "redpanda") {
    if (!config.kafka) throw new Error("KAFKA_BROKERS required for redpanda adapter");
    const { RedpandaProducer } = loadRedpanda();
    return new RedpandaProducer(config.kafka);
  }
  if (adapter === "redis-streams") {
    if (!config.redis) throw new Error("REDIS_QUEUE_URL required for redis-streams adapter");
    const { RedisStreamsProducer } = loadRedis();
    return new RedisStreamsProducer(config.redis);
  }
  throw new Error(`unknown adapter: ${adapter as string}`);
}

function instantiateConsumer(adapter: AdapterName, config: QueueConfig): QueueConsumer {
  if (adapter === "in-memory") return new InMemoryConsumer();
  if (adapter === "nats") {
    if (!config.nats) throw new Error("NATS_URL required for nats adapter");
    const { NatsConsumer } = loadNats();
    return new NatsConsumer(config.nats);
  }
  if (adapter === "redpanda") {
    if (!config.kafka) throw new Error("KAFKA_BROKERS required for redpanda adapter");
    const { RedpandaConsumer } = loadRedpanda();
    return new RedpandaConsumer(config.kafka);
  }
  if (adapter === "redis-streams") {
    if (!config.redis) throw new Error("REDIS_QUEUE_URL required for redis-streams adapter");
    const { RedisStreamsConsumer } = loadRedis();
    return new RedisStreamsConsumer(config.redis);
  }
  throw new Error(`unknown adapter: ${adapter as string}`);
}

// Dynamic require helpers. We keep imports at module top-level inside each
// adapter file so types are available for callers; the require wrappers
// defer the actual load to call time so unrelated adapters don't need the
// runtime dependency installed.
function loadNats(): typeof import("./adapters/nats.js") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./adapters/nats.js") as typeof import("./adapters/nats.js");
}
function loadRedpanda(): typeof import("./adapters/redpanda.js") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./adapters/redpanda.js") as typeof import("./adapters/redpanda.js");
}
function loadRedis(): typeof import("./adapters/redis-streams.js") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./adapters/redis-streams.js") as typeof import("./adapters/redis-streams.js");
}
