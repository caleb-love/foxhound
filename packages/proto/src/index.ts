/**
 * Foxhound wire-format Protobuf package entry.
 *
 * The `.proto` files under `../proto/v1/` are the canonical source of truth.
 * Hand-aligned TypeScript bindings live in `./v1/`. The bindings use
 * `protobufjs` at runtime so regeneration does NOT require `buf` or `protoc`
 * on the operator host; `buf` is only required for canonical codegen of the
 * Python SDK bindings (see `../generate.sh`).
 *
 * Version policy:
 *   - `v1` is additive-only. New optional fields may be appended.
 *   - Breaking changes bump to `v2` in a sibling directory.
 *   - See RFC-003 for the complete policy and RFC-004 for transport.
 */

export * as v1 from "./v1/index.js";
export type { WireCodec } from "./codec.js";
export { createCodec } from "./codec.js";
