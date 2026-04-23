/**
 * Legacy JSON transport.
 *
 * Preserves the exact wire shape the API has always accepted at
 * `POST /v1/traces` with `Content-Type: application/json`. This transport
 * exists for the WP04 transition window; once the deprecation period in
 * RFC-004 ends, it will be removed in favour of the Protobuf-only default.
 *
 * WP05: size-cap and gzip compression apply here too, because some
 * legacy clients may still be on this path and dropping a 2 MB prompt
 * silently would corrupt downstream analytics. The pipeline mirrors
 * Protobuf's:
 *
 *   enforceCapOnSpans → JSON.stringify → compress → chunk ceiling
 */
import type { Trace } from "@foxhound/types";
import type { SendResult, SpanTransport, TransportConfig, WireFormat } from "./index.js";
import { compress, type CompressionKind } from "./compression.js";
import { enforceCapOnSpans, MAX_COMPRESSED_CHUNK_BYTES, type DropRecord } from "./size-cap.js";

export class JsonTransport implements SpanTransport {
  readonly wireFormat: WireFormat = "json";
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly orgId: string | undefined;
  private readonly compression: CompressionKind;
  private readonly onDrop: (record: DropRecord) => void;

  constructor(cfg: TransportConfig) {
    this.endpoint = cfg.endpoint.replace(/\/$/, "");
    this.apiKey = cfg.apiKey;
    this.timeoutMs = cfg.timeoutMs ?? 10_000;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
    this.orgId = cfg.orgId;
    this.compression = cfg.compression ?? "gzip";
    this.onDrop = cfg.onDrop ?? defaultOnDrop;
  }

  async send(trace: Trace): Promise<SendResult> {
    // WP05: apply per-span cap before stringify. A 2 MB prompt becomes
    // metadata-only with a `foxhound.payload_dropped: true` marker.
    const cappedSpans = enforceCapOnSpans(trace.spans, this.orgId ?? "", this.onDrop);
    const cappedTrace: Trace =
      cappedSpans === trace.spans ? trace : { ...trace, spans: cappedSpans };

    const jsonString = JSON.stringify(cappedTrace);
    // Preserve the legacy string-body shape when no compression is in
    // effect (the common case: `compression: "none"` or a tiny batch
    // below the compression threshold). Existing consumers that
    // introspect `fetch` call arguments as strings keep working.
    // Encoding + compression is the gzip path; the result is a
    // Uint8Array that fetch accepts too.
    const uncompressed = new TextEncoder().encode(jsonString);
    const { bytes, kind: actualCompression } = compress(uncompressed, this.compression);
    const body: string | Uint8Array = actualCompression === "none" ? jsonString : bytes;
    const payloadBytes = bytes.byteLength;

    if (payloadBytes > MAX_COMPRESSED_CHUNK_BYTES) {
      throw new Error(
        `Foxhound SDK (JSON): compressed batch for trace ${trace.id} is ` +
          `${payloadBytes} B > ${MAX_COMPRESSED_CHUNK_BYTES} B ceiling. ` +
          `See RFC-005.`,
      );
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.endpoint}/v1/traces`, {
        method: "POST",
        headers: {
          // Capitalised header names preserved for byte-for-byte backward
          // compat with the legacy custom-JSON transport shipped before WP04.
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "X-Foxhound-Wire": "json",
          ...(actualCompression !== "none" ? { "Content-Encoding": actualCompression } : {}),
        },
        body,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(
        `Foxhound SDK (JSON): failed to send trace ${trace.id}: ` +
          `${response.status} ${response.statusText}`,
      );
    }
    return {
      status: response.status,
      wireFormat: "json",
      payloadBytes,
      headers: response.headers,
    };
  }

  async close(): Promise<void> {
    // No persistent connection to close for fetch-based transport.
  }
}

function defaultOnDrop(record: DropRecord): void {
  console.warn(
    `[foxhound/size-cap] (json) dropped payload for span ${record.spanId} ` +
      `(trace ${record.traceId}, org ${record.orgId}): ` +
      `${record.originalBytes} B → ${record.retainedBytes} B retained; ` +
      `fields=${record.droppedFields.join(",")}`,
  );
}
