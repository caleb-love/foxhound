/**
 * Per-span size-cap enforcement (WP05).
 *
 * When a customer sends a span carrying a 2 MB system prompt, a
 * multi-megabyte tool-output blob, or an entire uploaded document as an
 * attribute value, Foxhound keeps the span's *shape* (identifiers,
 * timing, status) and drops the payload. The decision is deliberately
 * metadata-preserving: the span still exists downstream, searches on
 * name/kind/duration still work, and a dashboard user sees a clear
 * "payload dropped" marker rather than a silently-missing record.
 *
 * Resolution order for what counts as "payload":
 *
 *   1. Well-known prompt/response attributes:
 *        - `foxhound.input`, `foxhound.output`
 *        - `gen_ai.prompt`, `gen_ai.completion`
 *        - `tool.parameters`, `tool.output`, `tool.input`
 *      These are expected to carry unbounded user content.
 *
 *   2. Individual attributes whose string value alone exceeds
 *      `HEAVY_ATTRIBUTE_VALUE_BYTES` (8 KB). A span that bundles six
 *      200 KB attributes should not slip through just because none of
 *      them matches a well-known key.
 *
 *   3. Span events whose attributes violate (1) or (2) in aggregate
 *      are trimmed event-by-event. Event names themselves are
 *      preserved.
 *
 * A span is "oversize" once the total byte cost of its payload (sum of
 * string-attribute lengths in (1) and (2), plus the UTF-8-encoded size
 * of event attribute strings) crosses `MAX_SPAN_PAYLOAD_BYTES`
 * (256 KB). The 256 KB threshold is well above a large realistic
 * system prompt (10–30 KB) and well below the chunk-level ceiling
 * enforced separately at the batch encoder.
 *
 * The chunk-level ceiling is `MAX_COMPRESSED_CHUNK_BYTES` (64 KB), a
 * separate invariant used by the transport layer after compression
 * runs. See RFC-005 for the numbers' rationale.
 */
import type { Span } from "@foxhound/types";

/** Maximum uncompressed payload per span before drop. */
export const MAX_SPAN_PAYLOAD_BYTES = 256 * 1024;

/** Maximum compressed chunk (batch) size the SDK sends in one request. */
export const MAX_COMPRESSED_CHUNK_BYTES = 64 * 1024;

/**
 * Single-attribute value that, even without matching a well-known key,
 * is treated as "heavy" and counted toward the payload budget. Small
 * enough to catch a 32 KB JSON snippet, large enough to leave
 * conventional metadata (`model`, `tokens`, `status_message`) alone.
 */
export const HEAVY_ATTRIBUTE_VALUE_BYTES = 8 * 1024;

/** Well-known attribute keys that always count toward the payload budget. */
const WELL_KNOWN_PAYLOAD_KEYS = new Set([
  "foxhound.input",
  "foxhound.output",
  "gen_ai.prompt",
  "gen_ai.completion",
  "gen_ai.request.messages",
  "gen_ai.response.content",
  "tool.parameters",
  "tool.arguments",
  "tool.output",
  "tool.input",
  "input",
  "output",
]);

/**
 * Structured drop record emitted when a span is trimmed. Logged once
 * per drop (rate-limited at the caller to prevent abuse-burst log
 * floods) and also used to increment the `foxhound_ingest_oversize_drops_total`
 * counter exposed by `@foxhound/api`'s self-observability (WP02).
 */
export interface DropRecord {
  readonly orgId: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly reason: "oversize";
  /** Attribute keys and event indices whose payload was removed. */
  readonly droppedFields: readonly string[];
  /** Bytes the span would have carried without the cap. */
  readonly originalBytes: number;
  /** Bytes the span actually carries after the cap. */
  readonly retainedBytes: number;
  /** ISO-8601 timestamp of the drop decision at the SDK. */
  readonly timestamp: string;
}

/** Cheap UTF-8 length probe. */
function stringValueBytes(v: string | number | boolean | null): number {
  if (typeof v !== "string") return 0;
  // `Buffer.byteLength` is exact for UTF-8; slower alternatives exist
  // but this runs once per attribute, not per character, so it is well
  // under the 0.1 ms/span SDK-overhead budget.
  return Buffer.byteLength(v, "utf8");
}

/**
 * Walk a span and build the list of "payload" field references plus
 * their byte cost. Pure — does not mutate the span.
 */
interface PayloadInventory {
  readonly attrKeys: string[];
  readonly eventIndices: number[];
  readonly totalBytes: number;
}

function inventoryPayload(span: Span): PayloadInventory {
  const attrKeys: string[] = [];
  const eventIndices: number[] = [];
  let totalBytes = 0;

  for (const [k, v] of Object.entries(span.attributes)) {
    const bytes = stringValueBytes(v);
    const isWellKnown = WELL_KNOWN_PAYLOAD_KEYS.has(k);
    const isHeavy = bytes >= HEAVY_ATTRIBUTE_VALUE_BYTES;
    if (isWellKnown || isHeavy) {
      attrKeys.push(k);
      totalBytes += bytes;
    }
  }

  for (let i = 0; i < span.events.length; i++) {
    const ev = span.events[i]!;
    let evBytes = 0;
    for (const [, v] of Object.entries(ev.attributes)) {
      evBytes += stringValueBytes(v);
    }
    if (evBytes >= HEAVY_ATTRIBUTE_VALUE_BYTES) {
      eventIndices.push(i);
      totalBytes += evBytes;
    }
  }

  return { attrKeys, eventIndices, totalBytes };
}

/**
 * Enforce the per-span payload cap.
 *
 * If the span's payload stays under the cap, the function returns the
 * input span unchanged and `onDrop` is never called.
 *
 * If the cap is exceeded, a new span is returned with the payload
 * fields removed (well-known keys deleted from `attributes`; events
 * whose attributes were heavy replaced by a minimal shape that
 * preserves the event name). The drop record carries the list of
 * removed fields plus before/after byte counts so operators can reason
 * about what was lost. The original span is not mutated.
 *
 * The caller supplies `orgId` because the internal `Span` type does
 * not carry org context (the wire encoder adds it separately); drop
 * records must stay org-scoped for the metrics counter.
 */
export function enforceCap(
  span: Span,
  orgId: string,
  onDrop: (record: DropRecord) => void,
): Span {
  const inventory = inventoryPayload(span);
  if (inventory.totalBytes < MAX_SPAN_PAYLOAD_BYTES) {
    return span;
  }

  // Over the cap. Strip payload attributes and trim heavy events.
  const retainedAttrs: Record<string, string | number | boolean | null> = {};
  let retainedBytes = 0;
  for (const [k, v] of Object.entries(span.attributes)) {
    if (inventory.attrKeys.includes(k)) continue;
    retainedAttrs[k] = v;
    retainedBytes += stringValueBytes(v);
  }
  // Mark the span so downstream readers know the drop happened and
  // can surface it in a dashboard.
  retainedAttrs["foxhound.payload_dropped"] = true;
  retainedAttrs["foxhound.payload_original_bytes"] = inventory.totalBytes;

  const trimmedEvents = span.events.map((ev, i) => {
    if (!inventory.eventIndices.includes(i)) return ev;
    return {
      timeMs: ev.timeMs,
      name: ev.name,
      attributes: {
        "foxhound.event_payload_dropped": true as const,
      },
    };
  });

  const trimmedSpan: Span = {
    ...span,
    attributes: retainedAttrs,
    events: trimmedEvents,
  };

  const record: DropRecord = {
    orgId,
    traceId: span.traceId,
    spanId: span.spanId,
    reason: "oversize",
    droppedFields: [
      ...inventory.attrKeys,
      ...inventory.eventIndices.map((i) => `events[${i}].attributes`),
    ],
    originalBytes: inventory.totalBytes,
    retainedBytes,
    timestamp: new Date().toISOString(),
  };
  onDrop(record);

  return trimmedSpan;
}

/**
 * Convenience: apply `enforceCap` to every span in a trace,
 * short-circuiting allocation when nothing was dropped. Used by the
 * SDK transport layer (`protobuf.ts` / `json.ts`) pre-encode.
 */
export function enforceCapOnSpans(
  spans: readonly Span[],
  orgId: string,
  onDrop: (record: DropRecord) => void,
): Span[] {
  let changed = false;
  const out: Span[] = [];
  for (let i = 0; i < spans.length; i++) {
    const original = spans[i]!;
    const capped = enforceCap(original, orgId, onDrop);
    if (capped !== original) changed = true;
    out.push(capped);
  }
  return changed ? out : (spans as Span[]);
}
