/**
 * `@foxhound/queue` — durable ingestion queue abstraction.
 *
 * Public surface: four adapters behind one interface.
 *
 * Usage (edge API):
 *   import { createProducer, readQueueConfigFromEnv, TOPIC_SPANS_V1, HEADER_ORG_ID } from "@foxhound/queue";
 *   const producer = createProducer(readQueueConfigFromEnv());
 *   await producer.produce({
 *     topic: TOPIC_SPANS_V1,
 *     key: traceId,
 *     value: protobufBytes,
 *     headers: { [HEADER_ORG_ID]: orgId, schema_version: "v1", wire_format: "protobuf" },
 *   });
 *
 * Usage (worker):
 *   import { createConsumer, readQueueConfigFromEnv } from "@foxhound/queue";
 *   const consumer = createConsumer(readQueueConfigFromEnv());
 *   await consumer.subscribe({
 *     topic: "foxhound.spans.v1",
 *     groupId: "persistence",
 *     handler: async (msg) => { ... },
 *   });
 */
export * from "./types.js";
export * from "./config.js";
export { createProducer, createConsumer } from "./factory.js";
export { InMemoryProducer, InMemoryConsumer, resetInMemoryBus } from "./adapters/in-memory.js";
