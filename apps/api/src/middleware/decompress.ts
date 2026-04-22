/**
 * Request-body decompression for the ingest routes (WP05).
 *
 * The SDK now compresses outbound batches (gzip by default, LZ4 gated
 * on an optional dep). The API mirror-implements the server side:
 *
 *   - `Content-Encoding: gzip` → `zlib.gunzipSync(body)`
 *   - `Content-Encoding: lz4`  → returned unchanged with a structured
 *                                error path (no server-side lz4 today)
 *   - absent / unknown         → returned unchanged
 *
 * Oversize guard: after decompression, bodies larger than
 * `MAX_DECOMPRESSED_BYTES` return a 413 error via the structured
 * return shape. The caller is expected to respond with HTTP 413 and
 * increment `recordOversizeDrop({ orgId, reason: "payload" })`.
 *
 * Kept as its own module so `traces-proto.ts`, the JSON parser
 * registered in `index.ts`, and any future ingest surface can share
 * one implementation. Tenancy is out of scope here; tenant-mismatch
 * checks still run in `decodeProtoBatch` after decompression.
 */
import { gunzipSync } from "node:zlib";

/** Hard ceiling on a single ingest request post-decompression. */
export const MAX_DECOMPRESSED_BYTES = 1 * 1024 * 1024; // 1 MiB

export type DecompressResult =
  | { ok: true; body: Buffer; encoding: "gzip" | "none" }
  | { ok: false; status: 413 | 415; error: string; message: string };

/**
 * Decompress `body` based on the `contentEncoding` header value.
 * Returns a structured result so the caller (a route handler, a
 * content-type parser, or a preHandler hook) can translate into the
 * right HTTP status without the decompression layer needing to know
 * about Fastify.
 */
export function decompressIfNeeded(
  body: Buffer,
  contentEncoding: string | undefined,
): DecompressResult {
  const enc = (contentEncoding ?? "").toLowerCase().trim();

  if (enc === "" || enc === "identity") {
    if (body.byteLength > MAX_DECOMPRESSED_BYTES) {
      return {
        ok: false,
        status: 413,
        error: "Payload Too Large",
        message:
          `request body of ${body.byteLength} B exceeds ` +
          `${MAX_DECOMPRESSED_BYTES} B ingest ceiling`,
      };
    }
    return { ok: true, body, encoding: "none" };
  }

  if (enc === "gzip") {
    let decompressed: Buffer;
    try {
      decompressed = gunzipSync(body);
    } catch (err) {
      return {
        ok: false,
        status: 415,
        error: "Unsupported Media Type",
        message: `invalid gzip payload: ${(err as Error).message}`,
      };
    }
    if (decompressed.byteLength > MAX_DECOMPRESSED_BYTES) {
      return {
        ok: false,
        status: 413,
        error: "Payload Too Large",
        message:
          `decompressed body of ${decompressed.byteLength} B exceeds ` +
          `${MAX_DECOMPRESSED_BYTES} B ingest ceiling`,
      };
    }
    return { ok: true, body: decompressed, encoding: "gzip" };
  }

  // Unknown or unsupported encoding (e.g. `lz4` without the server
  // dep, `deflate`, `br`). Reject with 415 so clients get a clear
  // signal instead of a silent mis-decode.
  return {
    ok: false,
    status: 415,
    error: "Unsupported Media Type",
    message: `unsupported Content-Encoding: ${enc}`,
  };
}
