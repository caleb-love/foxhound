/**
 * Schema-agnostic encode/decode surface.
 *
 * Each versioned message exposes a `WireCodec<T>` that packages a TS-native
 * type, its protobuf descriptor, and encode/decode routines. Callers
 * (`packages/sdk`, `apps/api`) depend on this interface, not on protobufjs
 * directly, so a future swap to `@bufbuild/protobuf` is localised to this
 * file plus the per-message modules.
 */
import type { Type } from "protobufjs";

export interface WireCodec<T> {
  /** Stable wire identifier, e.g. `"foxhound.v1.Span"`. */
  readonly typeName: string;
  /** Schema family, e.g. `"v1"`. */
  readonly schemaVersion: "v1";
  /** Encode a TS value into Protobuf wire bytes. */
  encode(value: T): Uint8Array;
  /** Decode wire bytes back into a TS value. */
  decode(bytes: Uint8Array): T;
  /** Validate without encoding; returns null on success, an error message otherwise. */
  verify(value: T): string | null;
}

export function createCodec<T>(opts: {
  typeName: string;
  schemaVersion: "v1";
  reflection: Type;
  /** Optional coercion from TS shape to protobufjs plain-object shape. */
  toWire?: (value: T) => Record<string, unknown>;
  /** Optional coercion from protobufjs plain-object back to TS shape. */
  fromWire?: (obj: Record<string, unknown>) => T;
}): WireCodec<T> {
  const { reflection, toWire, fromWire } = opts;
  return {
    typeName: opts.typeName,
    schemaVersion: opts.schemaVersion,
    encode(value: T): Uint8Array {
      const plain = toWire ? toWire(value) : (value as unknown as Record<string, unknown>);
      // Intentionally skip `verify()` here: it rejects string-encoded int64
      // values (e.g. `startTimeUnixNano: "1700000000000000000"`) even though
      // `create()` coerces them via Long. Callers wanting strict validation
      // can call `verify()` explicitly. `create()` + `encode()` will throw
      // on genuinely malformed input (wrong field types, unknown fields in
      // strict mode, etc.).
      const message = reflection.create(plain);
      return reflection.encode(message).finish();
    },
    decode(bytes: Uint8Array): T {
      const message = reflection.decode(bytes);
      const plain = reflection.toObject(message, {
        // Decode int64 as string to preserve full 64-bit precision. JS Number
        // cannot represent integers above 2^53; Unix-nano timestamps and
        // cost-usd-micros both exceed that ceiling routinely. Callers that
        // want a Number coerce via `Number(v)` where precision is acceptable;
        // callers that need full precision (ingest timestamps) use BigInt.
        longs: String,
        enums: Number,
        bytes: Array,
        defaults: false,
        arrays: true,
        objects: true,
      });
      return fromWire ? fromWire(plain) : (plain as T);
    },
    verify(value: T): string | null {
      // protobufjs `verify` is stricter than `create`: int64 fields must be
      // numbers or Long instances here, even though encode() accepts strings.
      // Callers who pass string-typed int64 values should coerce first or
      // rely on round-trip via encode() + decode() as their validation.
      const plain = toWire ? toWire(value) : (value as unknown as Record<string, unknown>);
      return reflection.verify(plain);
    },
  };
}
