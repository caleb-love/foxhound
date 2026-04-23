/**
 * Protobuf (OTLP-aligned) transport.
 *
 * Encodes the Foxhound internal `Trace` into a `foxhound.v1.TraceBatch` via
 * `@foxhound/proto` and POSTs the resulting binary to the API at
 * `POST /v1/traces` with `Content-Type: application/x-protobuf`.
 *
 * See RFC-004 for the wire-format decision and RFC-005 for the
 * compression + size-cap pipeline wired in here:
 *
 *   trace.spans
 *     └─▶ enforceCapOnSpans()         (WP05 drop policy)
 *            └─▶ traceToTraceBatch()
 *                   └─▶ v1.encode()
 *                          └─▶ compress()                 (WP05 gzip)
 *                                 └─▶ chunk-ceiling check (WP05 64 KB)
 *                                        └─▶ fetch()
 *
 * Order matters: size-cap runs *before* encode so the dropped-payload
 * markers make it onto the wire; compression runs *after* encode so
 * we're compressing the actual payload bytes rather than a JS object
 * graph.
 */
import type { Trace } from "@foxhound/types";
import { v1 } from "@foxhound/proto";
import type { SendResult, SpanTransport, TransportConfig, WireFormat } from "./index.js";
import { traceToTraceBatch } from "./map.js";
import { compress, type CompressionKind } from "./compression.js";
import { enforceCapOnSpans, MAX_COMPRESSED_CHUNK_BYTES, type DropRecord } from "./size-cap.js";

export class ProtobufTransport implements SpanTransport {
  readonly wireFormat: WireFormat = "protobuf";
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
    // WP05 step 1: apply per-span payload cap. Mutates (produces a new
    // trace shape) only when at least one span was trimmed.
    const cappedSpans = enforceCapOnSpans(trace.spans, this.orgId ?? "", this.onDrop);
    const cappedTrace: Trace =
      cappedSpans === trace.spans ? trace : { ...trace, spans: cappedSpans };

    const batch = traceToTraceBatch(cappedTrace, {
      ...(this.orgId !== undefined ? { orgId: this.orgId } : {}),
      sdkLanguage: "ts",
      sdkVersion: SDK_VERSION,
    });
    const uncompressed = v1.TraceBatchCodec.encode(batch);

    // WP05 step 2: compress. `compress()` may downgrade the algorithm
    // (tiny bodies → "none"; LZ4 without dep → "none"), so read the
    // result's `kind` for the header.
    const { bytes, kind: actualCompression } = compress(uncompressed, this.compression);

    // WP05 step 3: chunk ceiling. Post-compression body > 64 KB is
    // almost always a sign of a batch the SDK should have split; fail
    // loudly so the operator sees it rather than silently dropping.
    if (bytes.byteLength > MAX_COMPRESSED_CHUNK_BYTES) {
      throw new Error(
        `Foxhound SDK: compressed batch for trace ${trace.id} is ` +
          `${bytes.byteLength} B > ${MAX_COMPRESSED_CHUNK_BYTES} B ceiling. ` +
          `Reduce the batch size or use a smaller flush interval. ` +
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
          "content-type": "application/x-protobuf",
          authorization: `Bearer ${this.apiKey}`,
          "x-foxhound-wire": "protobuf",
          "x-foxhound-schema": "v1",
          ...(actualCompression !== "none" ? { "content-encoding": actualCompression } : {}),
        },
        body: bytes,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(
        `Foxhound SDK (Protobuf): failed to send trace ${trace.id}: ` +
          `${response.status} ${response.statusText}`,
      );
    }
    return {
      status: response.status,
      wireFormat: "protobuf",
      payloadBytes: bytes.byteLength,
      headers: response.headers,
    };
  }

  async close(): Promise<void> {
    // No persistent connection to close.
  }
}

function defaultOnDrop(record: DropRecord): void {
  // Single-line warning per drop. Callers that need structured logs
  // supply their own `onDrop` in `TransportConfig`.
  console.warn(
    `[foxhound/size-cap] dropped payload for span ${record.spanId} ` +
      `(trace ${record.traceId}, org ${record.orgId}): ` +
      `${record.originalBytes} B → ${record.retainedBytes} B retained; ` +
      `fields=${record.droppedFields.join(",")}`,
  );
}

// SDK version pin; kept in source so it is visible in bundled output. If the
// package.json version changes, update this constant in the same commit.
const SDK_VERSION = "0.3.0";
