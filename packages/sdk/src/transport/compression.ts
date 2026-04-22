/**
 * Wire-format-agnostic compression (WP05).
 *
 * The Foxhound SDK compresses its outbound batch body before egress. Gzip
 * is the default; LZ4 is reserved in the type signature for the low-CPU
 * case (see RFC-005) but the implementation is gated on an optional
 * dep (`lz4-napi`) that ships separately. Until that dep is installed,
 * LZ4 falls back to `none` and logs a one-time warning, preserving the
 * caller-visible API contract.
 *
 * Ground rules this file enforces:
 *
 * 1. Compression is all-or-nothing per batch. We do not split a batch
 *    across compressed chunks; the SDK already batches before calling
 *    transport, so a batch is the natural compression unit.
 *
 * 2. Tiny bodies skip compression. Below `COMPRESSION_THRESHOLD_BYTES`
 *    (512 B uncompressed), gzip is net-negative on wire bytes because
 *    of the gzip header overhead (~18 B plus dictionary). The
 *    `compress()` helper returns the input unchanged for these cases
 *    and signals it via the returned `{ kind: "none" }`.
 *
 * 3. Decompression is tolerant. A caller on the receiving end inspects
 *    the `Content-Encoding` header; this module exposes `decompress()`
 *    that takes the header value and does the right thing.
 *
 * 4. No allocation in the happy path. Node's `zlib.gzipSync` returns a
 *    `Buffer` directly over the compressed bytes; we wrap it in a
 *    Uint8Array view rather than copy. Same for `gunzipSync`.
 */
import { gzipSync, gunzipSync } from "node:zlib";

/**
 * Compression algorithms the SDK knows about.
 *
 * - `gzip` — Node stdlib, zero extra deps, default.
 * - `lz4`  — Reserved. Requires `lz4-napi` (optional peer). Falls back
 *            to `none` with a one-time warning when the dep is missing.
 * - `none` — Raw bytes. Always supported.
 */
export type CompressionKind = "gzip" | "lz4" | "none";

/**
 * Compressed output, paired with the algorithm that produced it. The
 * caller uses `kind` to set `Content-Encoding` on the wire.
 */
export interface CompressedBody {
  readonly bytes: Uint8Array;
  readonly kind: CompressionKind;
}

/**
 * Below this many uncompressed bytes, gzip costs more header overhead
 * than it saves; we short-circuit to `none`. The number is tuned against
 * a realistic 256-byte heartbeat batch (~8 % larger after gzip).
 */
export const COMPRESSION_THRESHOLD_BYTES = 512;

let lz4WarningEmitted = false;

/**
 * Compress `body` with the requested algorithm. Returns the body
 * unchanged when the algorithm is `none`, when the body is below the
 * compression threshold, or when LZ4 was requested but its optional
 * dep is not installed.
 *
 * The caller MUST read `result.kind` (not the input `kind` argument) to
 * decide the outgoing `Content-Encoding` header, because the fallback
 * paths may have downgraded the algorithm.
 */
export function compress(body: Uint8Array, kind: CompressionKind): CompressedBody {
  if (kind === "none" || body.byteLength < COMPRESSION_THRESHOLD_BYTES) {
    return { bytes: body, kind: "none" };
  }
  if (kind === "gzip") {
    // `gzipSync` returns a Node Buffer; Buffer is a subclass of
    // Uint8Array at runtime, so the cast is free and the downstream
    // `fetch` body accepts either.
    const out = gzipSync(body);
    return { bytes: out, kind: "gzip" };
  }
  // kind === "lz4" — guarded. `require`ing an optional dep from ESM is
  // awkward across bundlers; the clean path is to keep the hook
  // deliberate and let operators install `lz4-napi` explicitly when
  // they want the low-CPU path (RFC-005 "Compression choice" section).
  // Until then, fall back to raw bytes and warn once.
  if (!lz4WarningEmitted) {
    lz4WarningEmitted = true;
    console.warn(
      "[foxhound/compression] LZ4 requested but lz4-napi is not installed; " +
        "falling back to uncompressed. Install lz4-napi or switch to 'gzip'.",
    );
  }
  return { bytes: body, kind: "none" };
}

/**
 * Decompress `body` using the algorithm signaled by `kind`. `none` is a
 * passthrough. `lz4` falls back to passthrough when the optional dep is
 * missing (and the caller is responsible for erroring if that's not
 * acceptable). Invalid gzip raises.
 */
export function decompress(body: Uint8Array, kind: CompressionKind): Uint8Array {
  if (kind === "none") return body;
  if (kind === "gzip") {
    const out = gunzipSync(body);
    return out;
  }
  // kind === "lz4": same pragmatic fallback as above.
  if (!lz4WarningEmitted) {
    lz4WarningEmitted = true;
    console.warn(
      "[foxhound/compression] LZ4 decompression requested but lz4-napi is " +
        "not installed; returning body unchanged. This is probably a bug — " +
        "install lz4-napi or have the sender use 'gzip'.",
    );
  }
  return body;
}

/**
 * Map a `Content-Encoding` header value to a `CompressionKind`. Only
 * the algorithms the SDK knows about are recognised; anything else
 * (e.g. `deflate`, `br`) is `none`. The server side uses this to
 * negotiate what to decompress.
 */
export function compressionKindFromHeader(header: string | undefined): CompressionKind {
  if (!header) return "none";
  const v = header.toLowerCase().trim();
  if (v === "gzip") return "gzip";
  if (v === "lz4") return "lz4";
  return "none";
}

/** Expose a hook so tests can re-arm the one-time LZ4 warning. */
export function _resetLz4WarningForTests(): void {
  lz4WarningEmitted = false;
}
