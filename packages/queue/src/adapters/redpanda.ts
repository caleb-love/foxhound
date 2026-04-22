/**
 * Redpanda / Kafka adapter (via `kafkajs`).
 *
 * Role: the production-scale adapter. Redpanda is Kafka wire-compatible,
 * single-binary, and ships 7-day retention out of the box. `kafkajs` is
 * the mature Node client for the Kafka protocol.
 *
 * Partitioning: Kafka's native `messages[].partition` support. We hash the
 * `key` ourselves so the adapter contract is identical across backends and
 * so NATS / Redis Streams (which do not partition natively) can share the
 * same routing. Passing `key` to Kafka separately preserves key-based
 * auto-partitioning if the broker prefers it.
 *
 * Headers: Kafka headers are `{ name: string, value: Buffer | string }`.
 * We serialise all values as UTF-8 strings on produce and parse back on
 * consume. Same `org_id` contract.
 */
import { Kafka, type Consumer, type EachMessagePayload, type Producer } from "kafkajs";
import {
  type AdapterName,
  type ProduceRecord,
  type QueueConsumer,
  type QueueMessage,
  type QueueProducer,
  type SubscribeOpts,
  HEADER_ORG_ID,
} from "../types.js";

const PARTITIONS = 16;

function partitionFor(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % PARTITIONS;
}

export interface RedpandaAdapterOpts {
  readonly brokers: readonly string[];
  readonly clientId: string;
}

export class RedpandaProducer implements QueueProducer {
  readonly adapterName: AdapterName = "redpanda";
  private readonly kafka: Kafka;
  private producer: Producer | undefined;
  private connected = false;

  constructor(opts: RedpandaAdapterOpts) {
    this.kafka = new Kafka({ clientId: opts.clientId, brokers: [...opts.brokers] });
  }

  private async ensureConnected(): Promise<Producer> {
    if (!this.producer) {
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
        idempotent: true,
      });
    }
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }
    return this.producer;
  }

  async produce(record: ProduceRecord): Promise<void> {
    if (!record.headers[HEADER_ORG_ID]) {
      throw new Error("RedpandaProducer: `headers.org_id` is required by the queue contract");
    }
    const p = await this.ensureConnected();
    const partition = partitionFor(record.key);
    await p.send({
      topic: record.topic,
      messages: [
        {
          key: record.key,
          value: Buffer.from(record.value),
          partition,
          headers: Object.fromEntries(
            Object.entries(record.headers).map(([k, v]) => [k, String(v)]),
          ),
        },
      ],
    });
  }

  async flush(_timeoutMs: number): Promise<void> {
    // kafkajs's producer acks on send() with `idempotent: true`; nothing
    // to flush explicitly.
  }

  async close(): Promise<void> {
    if (this.producer && this.connected) {
      await this.producer.disconnect();
      this.connected = false;
    }
  }
}

export class RedpandaConsumer implements QueueConsumer {
  readonly adapterName: AdapterName = "redpanda";
  private readonly kafka: Kafka;
  private readonly consumers: Consumer[] = [];

  constructor(opts: RedpandaAdapterOpts) {
    this.kafka = new Kafka({ clientId: opts.clientId, brokers: [...opts.brokers] });
  }

  async subscribe(opts: SubscribeOpts): Promise<void> {
    const consumer = this.kafka.consumer({
      groupId: opts.groupId,
      allowAutoTopicCreation: true,
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: opts.topic,
      fromBeginning: opts.fromBeginning !== false,
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(message.headers ?? {})) {
          if (v !== undefined) headers[k] = v.toString("utf8");
        }
        const qmsg: QueueMessage = {
          topic,
          partition,
          offset: message.offset,
          key: message.key ? new Uint8Array(message.key) : new Uint8Array(),
          value: message.value ? new Uint8Array(message.value) : new Uint8Array(),
          headers,
          timestamp: Number(message.timestamp ?? Date.now()),
        };
        try {
          const r = await opts.handler(qmsg);
          if (r === "nack") {
            // Intentional nack: seek back to the message so it redelivers.
            consumer.seek({ topic, partition, offset: message.offset });
          }
        } catch {
          // Let kafkajs treat as retriable; no explicit commit on exception.
          throw new Error("handler threw; will redeliver");
        }
      },
    });

    this.consumers.push(consumer);
  }

  async close(): Promise<void> {
    for (const c of this.consumers) {
      try {
        await c.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.consumers.length = 0;
  }

  async lagSeconds(_opts: { topic: string; groupId: string }): Promise<number> {
    // True lag requires admin-client metadata lookup; kafkajs has `fetchOffsets`
    // + `fetchTopicOffsets`. Left as a follow-up; return -1 to signal unknown,
    // which the metrics gauge treats as "no value available".
    return -1;
  }
}
