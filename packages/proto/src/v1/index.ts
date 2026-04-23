/**
 * `foxhound.v1` wire schema — public surface.
 *
 * TypeScript interfaces below mirror the `.proto` messages. Field names use
 * JS-native camelCase (protobufjs default); on-wire field numbers and
 * types are controlled by the descriptor in `./descriptor.ts`.
 */
import { reflection } from "./descriptor.js";
import { createCodec, type WireCodec } from "../codec.js";

// ---------------------------------------------------------------------------
// Enums (value-preserving; integer matches .proto ordinal).
// ---------------------------------------------------------------------------

export const SpanKind = {
  UNSPECIFIED: 0,
  INTERNAL: 1,
  SERVER: 2,
  CLIENT: 3,
  PRODUCER: 4,
  CONSUMER: 5,
} as const;
export type SpanKind = (typeof SpanKind)[keyof typeof SpanKind];

export const StatusCode = {
  UNSET: 0,
  OK: 1,
  ERROR: 2,
} as const;
export type StatusCode = (typeof StatusCode)[keyof typeof StatusCode];

// ---------------------------------------------------------------------------
// Message interfaces. Each mirrors a message in proto/v1/*.proto.
// Optional fields are TypeScript-optional AND protobuf proto3_optional.
// ---------------------------------------------------------------------------

export type AttributeValue =
  | { stringValue: string }
  | { intValue: number | string }
  | { doubleValue: number }
  | { boolValue: boolean }
  | { bytesValue: Uint8Array };

export interface Status {
  code: StatusCode;
  message: string;
}

export interface SpanEvent {
  timeUnixNano: number | string;
  name: string;
  attributes: Record<string, AttributeValue>;
}

export interface Span {
  orgId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTimeUnixNano: number | string;
  endTimeUnixNano: number | string;
  status: Status;
  attributes: Record<string, AttributeValue>;
  events: SpanEvent[];
  agentId?: string;
  costUsdMicros?: number | string;
  sessionId?: string;
}

export interface TraceBatch {
  schemaVersion: "v1";
  batchId: number | string;
  orgId: string;
  spans: Span[];
  sdkLanguage?: string;
  sdkVersion?: string;
  /** Expected values: "gzip", "zstd", "none". Open string for forward-compat. */
  sdkCompressionHint?: string;
}

export interface PricingRowV1Stub {
  model: string;
  inputUsdMicrosPerMillion: number | string;
  outputUsdMicrosPerMillion: number | string;
  effectiveFrom: string;
}

// ---------------------------------------------------------------------------
// Codecs. These are the stable public entry points. `WireCodec<T>` is the
// only interface downstream code (SDK transport in WP04, API ingest) should
// depend on.
// ---------------------------------------------------------------------------

export const SpanCodec: WireCodec<Span> = createCodec<Span>({
  typeName: "foxhound.v1.Span",
  schemaVersion: "v1",
  reflection: reflection.Span,
});

export const TraceBatchCodec: WireCodec<TraceBatch> = createCodec<TraceBatch>({
  typeName: "foxhound.v1.TraceBatch",
  schemaVersion: "v1",
  reflection: reflection.TraceBatch,
});

export const PricingRowV1StubCodec: WireCodec<PricingRowV1Stub> = createCodec<PricingRowV1Stub>({
  typeName: "foxhound.v1.PricingRowV1Stub",
  schemaVersion: "v1",
  reflection: reflection.PricingRowV1Stub,
});

// ---------------------------------------------------------------------------
// Re-export the descriptor for parity tests and for advanced callers that
// need reflection access (e.g. custom decoders in test tooling).
// ---------------------------------------------------------------------------

export { reflection, DESCRIPTOR_JSON } from "./descriptor.js";
