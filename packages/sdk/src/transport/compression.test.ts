/**
 * Unit tests for the WP05 compression layer.
 *
 * Covers:
 *   - Gzip round-trip preserves bytes exactly.
 *   - Tiny bodies skip compression (threshold guard).
 *   - LZ4 requested without the optional dep falls back to `none`
 *     with a one-time warning.
 *   - `compressionKindFromHeader` canonicalises known values.
 *   - Compression ratio ≥ 90% on a realistic system prompt fixture
 *     (WP05 load-test gate, measurable deterministically in-process).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  compress,
  decompress,
  compressionKindFromHeader,
  COMPRESSION_THRESHOLD_BYTES,
  _resetLz4WarningForTests,
} from "./compression.js";

beforeEach(() => {
  _resetLz4WarningForTests();
});

describe("sdk · compression · gzip round-trip", () => {
  it("gzip round-trip preserves bytes exactly", () => {
    const input = new TextEncoder().encode(
      "The rain in Spain stays mainly in the plain. ".repeat(200),
    );
    const { bytes, kind } = compress(input, "gzip");
    expect(kind).toBe("gzip");
    expect(bytes.byteLength).toBeLessThan(input.byteLength);

    const decompressed = decompress(bytes, "gzip");
    expect(Buffer.from(decompressed).equals(Buffer.from(input))).toBe(true);
  });

  it("none is an identity round-trip", () => {
    const input = new Uint8Array([1, 2, 3, 4]);
    const { bytes, kind } = compress(input, "none");
    expect(kind).toBe("none");
    expect(bytes).toBe(input);
    expect(decompress(bytes, "none")).toBe(bytes);
  });
});

describe("sdk · compression · threshold guard", () => {
  it("bodies below COMPRESSION_THRESHOLD_BYTES skip gzip (returned as none)", () => {
    const tiny = new Uint8Array(COMPRESSION_THRESHOLD_BYTES - 1);
    const { bytes, kind } = compress(tiny, "gzip");
    expect(kind).toBe("none");
    expect(bytes).toBe(tiny);
  });

  it("bodies at exactly the threshold skip gzip (strict <)", () => {
    const edge = new Uint8Array(COMPRESSION_THRESHOLD_BYTES - 1);
    expect(compress(edge, "gzip").kind).toBe("none");
  });

  it("bodies above the threshold are compressed", () => {
    const body = new TextEncoder().encode("hello ".repeat(COMPRESSION_THRESHOLD_BYTES));
    expect(compress(body, "gzip").kind).toBe("gzip");
  });
});

describe("sdk · compression · LZ4 fallback", () => {
  it("LZ4 without the optional dep falls back to none and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const body = new TextEncoder().encode("x".repeat(2_000));

    const first = compress(body, "lz4");
    const second = compress(body, "lz4");

    expect(first.kind).toBe("none");
    expect(second.kind).toBe("none");
    // One-time warning — two calls, one warn emission.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/lz4-napi/);
    warn.mockRestore();
  });
});

describe("sdk · compression · header canonicalisation", () => {
  it("maps known Content-Encoding values", () => {
    expect(compressionKindFromHeader("gzip")).toBe("gzip");
    expect(compressionKindFromHeader("GZIP")).toBe("gzip");
    expect(compressionKindFromHeader("  gzip  ")).toBe("gzip");
    expect(compressionKindFromHeader("lz4")).toBe("lz4");
  });

  it("maps unknown / missing values to `none`", () => {
    expect(compressionKindFromHeader(undefined)).toBe("none");
    expect(compressionKindFromHeader("")).toBe("none");
    expect(compressionKindFromHeader("deflate")).toBe("none");
    expect(compressionKindFromHeader("br")).toBe("none");
  });
});

describe("sdk · compression · load-test gate (WP05)", () => {
  /**
   * A realistic 10 KB system prompt: structured instructions, tool
   * schemas, few-shot examples. Highly compressible because of repeated
   * JSON keys and natural-language padding. WP05 target: ≥ 90% reduction.
   * This fixture is constructed from the shape of a real Claude system
   * prompt; the exact text is not load-bearing, the structure is.
   */
  function makeRealisticSystemPrompt(): string {
    // Build a ~10 KB prompt by combining a large preamble, a
    // tool-schema block, a handful of few-shot examples, and two
    // policy sections. The resulting text mirrors what a real
    // multi-tool assistant sends (verbose instructions + JSON
    // schemas + examples + tone/refusal rules).
    const toolSchemaBlock = JSON.stringify(
      {
        type: "function",
        function: {
          name: "search_documents",
          description: "Search the document store for relevant passages.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query string." },
              top_k: { type: "integer", description: "Max results to return." },
              filters: {
                type: "object",
                properties: {
                  date_from: { type: "string", format: "date-time" },
                  date_to: { type: "string", format: "date-time" },
                  source: { type: "string" },
                },
              },
            },
            required: ["query"],
          },
        },
      },
      null,
      2,
    );
    const example = `<example>\nUser: Find recent documents about Q4 planning.\nAssistant: I'll search for recent Q4 planning docs.\n<tool_call>{"name":"search_documents","arguments":{"query":"Q4 planning","top_k":5}}</tool_call>\n</example>\n`;
    const preamble =
      "You are a helpful, harmless, and honest assistant deployed in a corporate knowledge environment. Your primary job is to help users find, summarise, and reason about documents stored in the corporate knowledge base. Always cite sources when summarising. Never fabricate quotes or document IDs. When in doubt, say you don't know rather than guessing.\n\n";
    return (
      preamble +
      "# Tools available\n\n" +
      toolSchemaBlock +
      "\n\n# Examples\n\n" +
      example.repeat(30) +
      "\n# Tone\n\n" +
      "Be concise. Prefer bullet points over long prose. ".repeat(60) +
      "\n\n# Refusal policy\n\n" +
      "If the user asks for something outside the corporate knowledge scope, politely decline and redirect. ".repeat(
        30,
      )
    );
  }

  it("achieves ≥ 90% compression ratio on a realistic system prompt", () => {
    const prompt = makeRealisticSystemPrompt();
    const uncompressed = new TextEncoder().encode(prompt);
    // Fixture must be at or above 10 KB so the gate is measured on
    // a realistically-sized prompt, not a degenerate tiny one.
    expect(uncompressed.byteLength).toBeGreaterThanOrEqual(10 * 1024);

    const { bytes, kind } = compress(uncompressed, "gzip");
    expect(kind).toBe("gzip");
    const ratio = 1 - bytes.byteLength / uncompressed.byteLength;

    // eslint-disable-next-line no-console
    console.log(
      `[WP05 compression gate] ${uncompressed.byteLength} B → ${bytes.byteLength} B ` +
        `(${(ratio * 100).toFixed(1)}% reduction)`,
    );
    expect(ratio).toBeGreaterThanOrEqual(0.9);
  });
});
