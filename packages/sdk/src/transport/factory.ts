import type { SpanTransport, TransportConfig } from "./index.js";
import { JsonTransport } from "./json.js";
import { ProtobufTransport } from "./protobuf.js";

/**
 * Construct a transport for the requested wire format. Defaults to Protobuf
 * per RFC-004. JSON is the legacy fallback retained for the transition window.
 */
export function createTransport(cfg: TransportConfig): SpanTransport {
  const wireFormat = cfg.wireFormat ?? "protobuf";
  if (wireFormat === "protobuf") return new ProtobufTransport(cfg);
  if (wireFormat === "json") return new JsonTransport(cfg);
  throw new Error(`unknown wire format: ${wireFormat as string}`);
}
