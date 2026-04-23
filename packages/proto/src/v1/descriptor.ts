/**
 * Runtime-loaded protobufjs Root for the `foxhound.v1` package.
 *
 * The descriptor below is an in-memory JSON representation of the
 * `proto/v1/*.proto` files. It is the single source of truth at runtime;
 * the `.proto` files remain the single source of truth for *authoring*.
 *
 * Keeping these two in sync is enforced by `tests/schema-parity.test.ts`,
 * which parses the `.proto` files directly and diffs the message shape
 * against this descriptor.
 *
 * Why this shape (JSON descriptor) and not `parse(protoText)` at module
 * init: loading from a JSON descriptor is allocation-free after first
 * parse and avoids reading `.proto` files at runtime, which matters once
 * the bindings are bundled into the SDK.
 */
import protobuf from "protobufjs";

// ---------------------------------------------------------------------------
// JSON descriptor. Hand-aligned to proto/v1/*.proto. Parity test enforces
// the alignment; do not edit this descriptor directly when evolving the
// schema — change the .proto file first, then run generate.sh (or update
// this descriptor and let the parity test catch any drift).
// ---------------------------------------------------------------------------

const DESCRIPTOR = {
  nested: {
    foxhound: {
      nested: {
        v1: {
          options: { go_package: "foxhoundpb/v1" },
          nested: {
            AttributeValue: {
              oneofs: {
                value: {
                  oneof: ["stringValue", "intValue", "doubleValue", "boolValue", "bytesValue"],
                },
              },
              fields: {
                stringValue: { type: "string", id: 1 },
                intValue: { type: "int64", id: 2 },
                doubleValue: { type: "double", id: 3 },
                boolValue: { type: "bool", id: 4 },
                bytesValue: { type: "bytes", id: 5 },
              },
            },
            SpanKind: {
              values: {
                SPAN_KIND_UNSPECIFIED: 0,
                SPAN_KIND_INTERNAL: 1,
                SPAN_KIND_SERVER: 2,
                SPAN_KIND_CLIENT: 3,
                SPAN_KIND_PRODUCER: 4,
                SPAN_KIND_CONSUMER: 5,
              },
            },
            StatusCode: {
              values: { STATUS_CODE_UNSET: 0, STATUS_CODE_OK: 1, STATUS_CODE_ERROR: 2 },
            },
            Status: {
              fields: {
                code: { type: "StatusCode", id: 1 },
                message: { type: "string", id: 2 },
              },
            },
            SpanEvent: {
              fields: {
                timeUnixNano: { type: "int64", id: 1 },
                name: { type: "string", id: 2 },
                attributes: { keyType: "string", type: "AttributeValue", id: 3 },
              },
            },
            Span: {
              fields: {
                orgId: { type: "string", id: 1 },
                traceId: { type: "string", id: 2 },
                spanId: { type: "string", id: 3 },
                parentSpanId: { type: "string", id: 4, options: { proto3_optional: true } },
                name: { type: "string", id: 5 },
                kind: { type: "SpanKind", id: 6 },
                startTimeUnixNano: { type: "int64", id: 7 },
                endTimeUnixNano: { type: "int64", id: 8 },
                status: { type: "Status", id: 9 },
                attributes: { keyType: "string", type: "AttributeValue", id: 10 },
                events: { rule: "repeated", type: "SpanEvent", id: 11 },
                agentId: { type: "string", id: 12, options: { proto3_optional: true } },
                costUsdMicros: { type: "int64", id: 13, options: { proto3_optional: true } },
                sessionId: { type: "string", id: 14, options: { proto3_optional: true } },
              },
              reserved: [[100, 199]],
            },
            TraceBatch: {
              fields: {
                schemaVersion: { type: "string", id: 1 },
                batchId: { type: "int64", id: 2 },
                orgId: { type: "string", id: 3 },
                spans: { rule: "repeated", type: "Span", id: 4 },
                sdkLanguage: { type: "string", id: 5, options: { proto3_optional: true } },
                sdkVersion: { type: "string", id: 6, options: { proto3_optional: true } },
                sdkCompressionHint: { type: "string", id: 7, options: { proto3_optional: true } },
              },
              reserved: [[100, 199]],
            },
            PricingRowV1Stub: {
              fields: {
                model: { type: "string", id: 1 },
                inputUsdMicrosPerMillion: { type: "int64", id: 2 },
                outputUsdMicrosPerMillion: { type: "int64", id: 3 },
                effectiveFrom: { type: "string", id: 4 },
              },
              reserved: [[100, 199]],
            },
          },
        },
      },
    },
  },
};

export const root: protobuf.Root = protobuf.Root.fromJSON(DESCRIPTOR);

export const reflection = {
  Span: root.lookupType("foxhound.v1.Span"),
  SpanEvent: root.lookupType("foxhound.v1.SpanEvent"),
  Status: root.lookupType("foxhound.v1.Status"),
  AttributeValue: root.lookupType("foxhound.v1.AttributeValue"),
  TraceBatch: root.lookupType("foxhound.v1.TraceBatch"),
  PricingRowV1Stub: root.lookupType("foxhound.v1.PricingRowV1Stub"),
  SpanKind: root.lookupEnum("foxhound.v1.SpanKind"),
  StatusCode: root.lookupEnum("foxhound.v1.StatusCode"),
};

export const DESCRIPTOR_JSON = DESCRIPTOR;
