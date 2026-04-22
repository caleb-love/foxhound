/**
 * Wire-format-agnostic span transport for the Foxhound SDK.
 *
 * Two concrete implementations:
 *   - `protobuf` (default) — encodes `TraceBatch` via `@foxhound/proto` and
 *     sends `application/x-protobuf` to `POST /v1/traces` on the Foxhound API.
 *   - `json` — preserves the legacy custom-JSON shape. Retained for the
 *     transition window; will be removed in a future cycle after the RFC-004
 *     deprecation grace period.
 *
 * Only this module and its siblings know which wire format is in use. The
 * rest of the SDK depends on `SpanTransport` + `TransportConfig`, so adding
 * a future transport (e.g. gRPC) is a localised change.
 */
import type { Trace } from "@foxhound/types";
import type { CompressionKind } from "./compression.js";
import type { DropRecord } from "./size-cap.js";

export type WireFormat = "protobuf" | "json";

export interface TransportConfig {
  readonly endpoint: string;
  readonly apiKey: string;
  /** Wire format. Default is `"protobuf"` for WP04. */
  readonly wireFormat?: WireFormat;
  /** Default 10 000 ms. */
  readonly timeoutMs?: number;
  /** Optional custom fetch (tests inject this). */
  readonly fetchImpl?: typeof fetch;
  /** Organization ID — optional hint used for on-wire batch scoping when non-empty. */
  readonly orgId?: string;
  /**
   * WP05: compression algorithm for outbound batches. Default `"gzip"`.
   * Set `"none"` to disable (useful for debugging or constrained
   * environments). `"lz4"` is reserved and gated on an optional
   * `lz4-napi` peer dep; absent the dep, it falls back to `"none"`
   * with a one-time warning. See `compression.ts`.
   */
  readonly compression?: CompressionKind;
  /**
   * WP05: callback invoked for each span whose payload was dropped
   * because it exceeded `MAX_SPAN_PAYLOAD_BYTES`. The SDK caps at the
   * per-span level pre-encode so the batch stays within the chunk
   * ceiling. When omitted, a one-line `console.warn` is emitted per
   * drop.
   */
  readonly onDrop?: (record: DropRecord) => void;
}

export interface SendResult {
  readonly status: number;
  readonly wireFormat: WireFormat;
  readonly payloadBytes: number;
  /** Response headers preserved so the caller can check budget headers. */
  readonly headers: Headers;
}

export interface SpanTransport {
  readonly wireFormat: WireFormat;
  /** Send a single trace as a one-trace batch. */
  send(trace: Trace): Promise<SendResult>;
  /** Close any underlying connection. No-op for fetch-based transports. */
  close(): Promise<void>;
}

export { createTransport } from "./factory.js";
export { JsonTransport } from "./json.js";
export { ProtobufTransport } from "./protobuf.js";
export { traceToTraceBatch, spanToProtoSpan } from "./map.js";
export {
  compress,
  decompress,
  compressionKindFromHeader,
  COMPRESSION_THRESHOLD_BYTES,
} from "./compression.js";
export type { CompressionKind, CompressedBody } from "./compression.js";
export {
  enforceCap,
  enforceCapOnSpans,
  MAX_SPAN_PAYLOAD_BYTES,
  MAX_COMPRESSED_CHUNK_BYTES,
  HEAVY_ATTRIBUTE_VALUE_BYTES,
} from "./size-cap.js";
export type { DropRecord } from "./size-cap.js";
