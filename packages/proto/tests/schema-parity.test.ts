/**
 * Schema parity test.
 *
 * Parses the .proto files directly via protobufjs and diffs the message /
 * field / enum shape against the in-memory descriptor in
 * `src/v1/descriptor.ts`. This guards against drift between the authoring
 * surface (`.proto` files) and the runtime surface (TS descriptor).
 *
 * If a human edits a `.proto` but forgets to update `descriptor.ts`, this
 * test fails with a precise diff. That is the intended failure mode.
 */
import { describe, it, expect } from "vitest";
import protobuf from "protobufjs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { reflection } from "../src/v1/descriptor.js";

const here = dirname(fileURLToPath(import.meta.url));
const PROTO_ROOT = resolve(here, "../proto/v1");

interface FieldShape {
  readonly id: number;
  readonly type: string;
  readonly rule: "required" | "optional" | "repeated" | "singular" | "map";
  readonly keyType?: string;
}
type MessageShape = Readonly<Record<string, FieldShape>>;

function shapeFromType(t: protobuf.Type): MessageShape {
  const out: Record<string, FieldShape> = {};
  for (const [name, field] of Object.entries(t.fields)) {
    const anyField = field as protobuf.Field & { keyType?: string };
    const shape: FieldShape = {
      id: field.id,
      type: field.type,
      rule: field.repeated
        ? "repeated"
        : field.map
          ? "map"
          : field.optional
            ? "optional"
            : "singular",
      ...(anyField.keyType ? { keyType: anyField.keyType } : {}),
    };
    out[name] = shape;
  }
  return out;
}

describe("foxhound.v1 · schema parity (.proto ↔ descriptor.ts)", () => {
  it("parses proto/v1/*.proto and matches descriptor", async () => {
    const root = new protobuf.Root();
    root.resolvePath = (_origin, target) => resolve(PROTO_ROOT, target.replace(/^v1\//, ""));
    await root.load(
      [
        resolve(PROTO_ROOT, "span.proto"),
        resolve(PROTO_ROOT, "trace_batch.proto"),
        resolve(PROTO_ROOT, "pricing.proto"),
      ],
      { keepCase: false }, // protobufjs camelCases field names by default
    );

    const fromProto = {
      Span: root.lookupType("foxhound.v1.Span"),
      SpanEvent: root.lookupType("foxhound.v1.SpanEvent"),
      Status: root.lookupType("foxhound.v1.Status"),
      AttributeValue: root.lookupType("foxhound.v1.AttributeValue"),
      TraceBatch: root.lookupType("foxhound.v1.TraceBatch"),
      PricingRowV1Stub: root.lookupType("foxhound.v1.PricingRowV1Stub"),
    };

    for (const name of Object.keys(fromProto) as Array<keyof typeof fromProto>) {
      const protoShape = shapeFromType(fromProto[name]);
      const descShape = shapeFromType(reflection[name]);
      // Key diff: if this fails, print the whole thing for easy debugging.
      if (JSON.stringify(protoShape) !== JSON.stringify(descShape)) {
        // eslint-disable-next-line no-console
        console.error(`[schema-parity] MISMATCH for ${name}:`);
        // eslint-disable-next-line no-console
        console.error("from .proto:", JSON.stringify(protoShape, null, 2));
        // eslint-disable-next-line no-console
        console.error("from descriptor:", JSON.stringify(descShape, null, 2));
      }
      expect(protoShape).toEqual(descShape);
    }
  });

  it("enum values match between .proto and descriptor", async () => {
    const root = new protobuf.Root();
    root.resolvePath = (_origin, target) => resolve(PROTO_ROOT, target.replace(/^v1\//, ""));
    await root.load([resolve(PROTO_ROOT, "span.proto")], { keepCase: false });

    const kindFromProto = root.lookupEnum("foxhound.v1.SpanKind");
    const statusFromProto = root.lookupEnum("foxhound.v1.StatusCode");

    expect(kindFromProto.values).toEqual(reflection.SpanKind.values);
    expect(statusFromProto.values).toEqual(reflection.StatusCode.values);
  });
});
