/**
 * Unit tests for the WP05 per-span size-cap enforcement.
 *
 * Covers:
 *   - Below-threshold spans pass through unchanged (identity).
 *   - Oversize well-known attributes are dropped; metadata retained.
 *   - Heavy ad-hoc attributes (≥ 8 KB, not well-known) are also dropped.
 *   - Events with heavy attributes are trimmed, event names preserved.
 *   - `foxhound.payload_dropped` + `foxhound.payload_original_bytes`
 *     markers land on the trimmed span.
 *   - `enforceCapOnSpans` is referentially transparent when nothing
 *     was dropped (returns the same array reference).
 *   - Drop records carry correct field lists and byte counts.
 */
import { describe, it, expect, vi } from "vitest";
import type { Span } from "@foxhound/types";
import {
  enforceCap,
  enforceCapOnSpans,
  HEAVY_ATTRIBUTE_VALUE_BYTES,
  MAX_SPAN_PAYLOAD_BYTES,
  type DropRecord,
} from "./size-cap.js";

function mkSpan(overrides: Partial<Span> = {}): Span {
  return {
    traceId: "t1",
    spanId: "s1",
    name: "llm.generate",
    kind: "llm_call",
    startTimeMs: 1_700_000_000_000,
    endTimeMs: 1_700_000_000_100,
    status: "ok",
    attributes: {},
    events: [],
    ...overrides,
  };
}

describe("sdk · size-cap · below threshold", () => {
  it("returns the input span unchanged when under the cap", () => {
    const span = mkSpan({
      attributes: {
        "gen_ai.prompt": "short prompt",
        "gen_ai.completion": "short reply",
        model: "gpt-4o",
      },
    });
    const drops: DropRecord[] = [];
    const result = enforceCap(span, "org_a", (r) => drops.push(r));
    expect(result).toBe(span);
    expect(drops).toHaveLength(0);
  });

  it("enforceCapOnSpans returns the same array reference when no span was trimmed", () => {
    const spans = [mkSpan(), mkSpan({ spanId: "s2" })];
    const out = enforceCapOnSpans(spans, "org_a", () => {});
    expect(out).toBe(spans);
  });
});

describe("sdk · size-cap · oversize well-known attributes", () => {
  it("drops `gen_ai.prompt` when it alone exceeds the cap", () => {
    const bigPrompt = "a".repeat(MAX_SPAN_PAYLOAD_BYTES + 1);
    const span = mkSpan({
      attributes: {
        "gen_ai.prompt": bigPrompt,
        model: "gpt-4o",
        tokens: 512,
      },
    });
    const drops: DropRecord[] = [];
    const result = enforceCap(span, "org_a", (r) => drops.push(r));

    expect(result).not.toBe(span);
    expect(result.attributes["gen_ai.prompt"]).toBeUndefined();
    // Metadata preserved.
    expect(result.attributes["model"]).toBe("gpt-4o");
    expect(result.attributes["tokens"]).toBe(512);
    // Drop markers present.
    expect(result.attributes["foxhound.payload_dropped"]).toBe(true);
    expect(result.attributes["foxhound.payload_original_bytes"]).toBe(bigPrompt.length);
    // Span shape otherwise preserved.
    expect(result.traceId).toBe(span.traceId);
    expect(result.spanId).toBe(span.spanId);
    expect(result.name).toBe(span.name);
    expect(result.kind).toBe(span.kind);
    expect(result.startTimeMs).toBe(span.startTimeMs);
    expect(result.endTimeMs).toBe(span.endTimeMs);
    expect(result.status).toBe(span.status);
    // Drop record correct.
    expect(drops).toHaveLength(1);
    expect(drops[0]!.droppedFields).toContain("gen_ai.prompt");
    expect(drops[0]!.originalBytes).toBe(bigPrompt.length);
    expect(drops[0]!.reason).toBe("oversize");
    expect(drops[0]!.orgId).toBe("org_a");
  });

  it("drops tool.* payload fields alongside gen_ai.* when oversize in aggregate", () => {
    const span = mkSpan({
      attributes: {
        "tool.parameters": "x".repeat(150 * 1024),
        "tool.output": "y".repeat(120 * 1024),
        model: "gpt-4o",
      },
    });
    const drops: DropRecord[] = [];
    const result = enforceCap(span, "org_a", (r) => drops.push(r));

    expect(result.attributes["tool.parameters"]).toBeUndefined();
    expect(result.attributes["tool.output"]).toBeUndefined();
    expect(result.attributes["model"]).toBe("gpt-4o");
    expect(drops[0]!.droppedFields).toEqual(
      expect.arrayContaining(["tool.parameters", "tool.output"]),
    );
  });
});

describe("sdk · size-cap · heavy ad-hoc attributes", () => {
  it("drops individual attributes whose value exceeds the heavy-threshold (≥ 8 KB)", () => {
    // One attribute big enough to trigger heavy-threshold but not cross
    // the per-span cap on its own.
    const heavyValue = "h".repeat(HEAVY_ATTRIBUTE_VALUE_BYTES + 100);
    // Then pad with several more heavy attributes so the aggregate
    // crosses `MAX_SPAN_PAYLOAD_BYTES`.
    const span = mkSpan({
      attributes: {
        heavy_doc_1: heavyValue,
        heavy_doc_2: heavyValue,
        heavy_doc_3: heavyValue,
        heavy_doc_4: heavyValue,
        heavy_doc_5: heavyValue,
        heavy_doc_6: heavyValue,
        heavy_doc_7: heavyValue,
        heavy_doc_8: heavyValue,
        heavy_doc_9: heavyValue,
        heavy_doc_10: heavyValue,
        heavy_doc_11: heavyValue,
        heavy_doc_12: heavyValue,
        heavy_doc_13: heavyValue,
        heavy_doc_14: heavyValue,
        heavy_doc_15: heavyValue,
        heavy_doc_16: heavyValue,
        heavy_doc_17: heavyValue,
        heavy_doc_18: heavyValue,
        heavy_doc_19: heavyValue,
        heavy_doc_20: heavyValue,
        heavy_doc_21: heavyValue,
        heavy_doc_22: heavyValue,
        heavy_doc_23: heavyValue,
        heavy_doc_24: heavyValue,
        heavy_doc_25: heavyValue,
        heavy_doc_26: heavyValue,
        heavy_doc_27: heavyValue,
        heavy_doc_28: heavyValue,
        heavy_doc_29: heavyValue,
        heavy_doc_30: heavyValue,
        heavy_doc_31: heavyValue,
        heavy_doc_32: heavyValue, // ~32 × 8 KB ≈ 256 KB → crosses cap
        small_metadata: "keep me",
      },
    });
    const drops: DropRecord[] = [];
    const result = enforceCap(span, "org_a", (r) => drops.push(r));

    for (let i = 1; i <= 32; i++) {
      expect(result.attributes[`heavy_doc_${i}`]).toBeUndefined();
    }
    expect(result.attributes["small_metadata"]).toBe("keep me");
    expect(drops[0]!.droppedFields.length).toBeGreaterThanOrEqual(32);
  });

  it("leaves small attributes (including non-string) alone", () => {
    // Span just below the cap with a heavy well-known field; ad-hoc
    // metadata (string < 8 KB, numbers, booleans) should survive.
    const span = mkSpan({
      attributes: {
        "gen_ai.prompt": "p".repeat(MAX_SPAN_PAYLOAD_BYTES + 100),
        model: "gpt-4o",
        temperature: 0.7,
        streaming: true,
        short_description: "x".repeat(1_000), // 1 KB, under heavy-threshold
      },
    });
    const result = enforceCap(span, "org_a", () => {});
    expect(result.attributes["short_description"]).toBe("x".repeat(1_000));
    expect(result.attributes["temperature"]).toBe(0.7);
    expect(result.attributes["streaming"]).toBe(true);
    expect(result.attributes["model"]).toBe("gpt-4o");
  });
});

describe("sdk · size-cap · events", () => {
  it("trims events whose attributes are heavy while preserving event name + time", () => {
    const span = mkSpan({
      attributes: {
        "gen_ai.prompt": "p".repeat(MAX_SPAN_PAYLOAD_BYTES),
      },
      events: [
        {
          timeMs: 1_700_000_000_010,
          name: "llm.chunk",
          attributes: { chunk: "c".repeat(HEAVY_ATTRIBUTE_VALUE_BYTES + 100) },
        },
        {
          timeMs: 1_700_000_000_020,
          name: "llm.done",
          attributes: { reason: "stop" },
        },
      ],
    });
    const result = enforceCap(span, "org_a", () => {});
    // Heavy event trimmed.
    expect(result.events[0]!.name).toBe("llm.chunk");
    expect(result.events[0]!.attributes["chunk"]).toBeUndefined();
    expect(result.events[0]!.attributes["foxhound.event_payload_dropped"]).toBe(true);
    // Light event untouched.
    expect(result.events[1]!.attributes["reason"]).toBe("stop");
  });
});

describe("sdk · size-cap · enforceCapOnSpans", () => {
  it("applies cap per-span and returns a new array only if something changed", () => {
    const oversize = mkSpan({
      spanId: "oversize",
      attributes: { "gen_ai.prompt": "p".repeat(MAX_SPAN_PAYLOAD_BYTES + 10) },
    });
    const small = mkSpan({ spanId: "small", attributes: { model: "gpt-4o" } });
    const onDrop = vi.fn();
    const out = enforceCapOnSpans([oversize, small], "org_a", onDrop);
    expect(out).not.toBe([oversize, small]); // new array
    expect(out[0]!.attributes["gen_ai.prompt"]).toBeUndefined();
    expect(out[1]).toBe(small); // untouched span is the same reference
    expect(onDrop).toHaveBeenCalledTimes(1);
  });
});
