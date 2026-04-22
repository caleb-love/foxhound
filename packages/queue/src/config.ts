/**
 * Environment-driven adapter selection.
 *
 *   FOXHOUND_QUEUE_ADAPTER = "in-memory" | "nats" | "redpanda" | "redis-streams"
 *
 * Adapter-specific vars:
 *   NATS_URL              = "nats://localhost:4222"
 *   NATS_STREAM           = "FOXHOUND_SPANS" (optional)
 *   KAFKA_BROKERS         = "localhost:9092,localhost:9093"
 *   KAFKA_CLIENT_ID       = "foxhound-api" (optional)
 *   REDIS_QUEUE_URL       = "redis://localhost:6379"
 *
 * Default: in-memory. Safe for dev without breaking production hosts.
 */
import type { AdapterName } from "./types.js";

export interface QueueConfig {
  readonly adapter: AdapterName;
  readonly nats: { url: string; stream: string } | undefined;
  readonly kafka: { brokers: readonly string[]; clientId: string } | undefined;
  readonly redis: { url: string } | undefined;
}

const VALID: readonly AdapterName[] = ["in-memory", "nats", "redpanda", "redis-streams"];

export function readQueueConfigFromEnv(env: NodeJS.ProcessEnv = process.env): QueueConfig {
  const raw = env["FOXHOUND_QUEUE_ADAPTER"]?.trim().toLowerCase();
  const adapter: AdapterName =
    raw && (VALID as readonly string[]).includes(raw) ? (raw as AdapterName) : "in-memory";

  const natsUrl = env["NATS_URL"]?.trim();
  const natsStream = env["NATS_STREAM"]?.trim() || "FOXHOUND_SPANS";

  const kafkaBrokers =
    env["KAFKA_BROKERS"]
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const kafkaClientId = env["KAFKA_CLIENT_ID"]?.trim() || "foxhound";

  const redisUrl = env["REDIS_QUEUE_URL"]?.trim();

  return {
    adapter,
    nats: natsUrl ? { url: natsUrl, stream: natsStream } : undefined,
    kafka: kafkaBrokers.length > 0 ? { brokers: kafkaBrokers, clientId: kafkaClientId } : undefined,
    redis: redisUrl ? { url: redisUrl } : undefined,
  };
}
