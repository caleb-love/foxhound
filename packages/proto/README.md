# `@foxhound/proto` — Foxhound Wire Schema

Canonical Protobuf schema and TypeScript runtime bindings for the Foxhound
data plane. This is the contract between the SDKs (`@foxhound/sdk`,
`foxhound_sdk` Python), the ingest API (`apps/api`), and the analytics
tier (WP09+).

This package is **WP03** of the [Scale Readiness Program](../../docs/plans/active/2026-04-20-scale-readiness-program/README.md).
The adoption of these types in the SDK transport happens in **WP04**.

## Layout

```
packages/proto/
├── proto/v1/           # Canonical .proto sources — the source of truth.
│   ├── span.proto
│   ├── trace_batch.proto
│   └── pricing.proto   # stub; expanded in WP16
├── buf.yaml            # buf module + lint + breaking-change rules
├── buf.gen.yaml        # codegen config (TS + Python) for operators with buf installed
├── generate.sh         # operator-runnable regen script
├── src/
│   ├── index.ts        # public entry; re-exports v1
│   ├── codec.ts        # WireCodec<T> abstraction (stable interface)
│   └── v1/
│       ├── descriptor.ts  # in-memory protobufjs descriptor (runtime truth)
│       └── index.ts    # TS types + codecs (Span, TraceBatch, ...)
└── tests/
    ├── v1-roundtrip.test.ts    # encode → decode parity
    ├── backward-compat.test.ts # v1.0 fixture must always decode
    ├── schema-parity.test.ts   # .proto ↔ descriptor.ts must match
    └── fixtures/               # frozen binary fixtures (committed)
```

## Why two sources of truth

Authoring happens in `.proto` files because that is the cross-language
contract. At runtime, TypeScript consumers load an in-memory JSON
descriptor (`src/v1/descriptor.ts`) to avoid bundling a `.proto` parser
into the SDK. A **schema-parity test** enforces that the two match; drift
fails the build, not silently.

Operators with `buf` installed can regenerate both the TS descriptor and
Python bindings by running `./generate.sh`. Without `buf`, the hand-aligned
descriptor remains authoritative and the parity test is the guard.

## Versioning policy (RFC-003)

- **`v1` is additive-only.** Add new `optional` fields or append new enum
  values; never change a field's number, type, or name; never remove.
- **Breaking changes bump the major version.** Create `proto/v2/` in a
  sibling directory, add a `v2` namespace, and run both in parallel during
  migration. RFC-003 describes the cutover process.
- **Reserved ranges.** Every message declares `reserved 100 to 199;` so
  future additions can never collide with a rename or delete.
- **`buf breaking`** runs on every PR that touches `.proto` files and
  fails the build on a violation. Local runs: `./generate.sh` → catches it
  before push.

## Using the codec

```ts
import { v1 } from "@foxhound/proto";

const span: v1.Span = {
  orgId: "org_123",
  traceId: "a".repeat(32),
  spanId: "b".repeat(16),
  name: "llm.generate",
  kind: v1.SpanKind.CLIENT,
  startTimeUnixNano: BigInt(Date.now()) * 1_000_000n,
  endTimeUnixNano: BigInt(Date.now() + 150) * 1_000_000n,
  status: { code: v1.StatusCode.OK, message: "" },
  attributes: { "gen_ai.system": { stringValue: "openai" } },
  events: [],
};

const bytes = v1.SpanCodec.encode(span);  // Uint8Array, ready for HTTP body
const back = v1.SpanCodec.decode(bytes);  // typed Span
```

The `WireCodec<T>` interface is intentionally minimal so swapping protobufjs
for `@bufbuild/protobuf` in a future cycle touches only `codec.ts` and the
per-message exports.

## Regenerating bindings (operator action)

```bash
# macOS
brew install bufbuild/buf/buf

# From the repo root:
pnpm proto:gen
```

`buf breaking` runs first against `main` and blocks a breaking change. If
you intentionally want to land a v2 schema, create `proto/v2/` and update
`buf.yaml` to include both — do not edit `proto/v1/` to break compat.

## Python bindings

Deferred to operator. Today the TS bindings are code-complete; the Python
SDK will pick up generated bindings under `packages/sdk-py/foxhound_sdk/_proto/`
once an operator runs `./generate.sh` with `buf` installed. RFC-003 tracks
this as an open question (no runtime dependency on Python bindings until
WP04 lands Protobuf transport for `sdk-py`).

## Testing

```bash
pnpm --filter @foxhound/proto test       # 20+ test cases, zero external deps
pnpm --filter @foxhound/proto typecheck  # strict TS, exactOptional, no any
```

The three test suites collectively enforce:

1. **Round-trip fidelity** — every message encodes and decodes losslessly.
2. **Backward compatibility** — frozen v1.0 binary fixtures must always
   decode under current code. Breaking compat → loud red test.
3. **Schema parity** — `.proto` ↔ `src/v1/descriptor.ts` drift is caught
   before it can ship.
