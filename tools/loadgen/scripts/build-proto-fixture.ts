/**
 * Precompute a Protobuf-encoded TraceBatch fixture for the k6 scenario.
 *
 * Why this exists: k6 runs under a Goja JS runtime that cannot import npm
 * packages, so it cannot invoke `@foxhound/proto` at scenario time. Instead,
 * we pre-encode a realistic batch once and ship the bytes as a base64 blob
 * in `tools/loadgen/scenarios/fixtures/trace-batch.v1.b64`. The k6 script
 * decodes the base64 per iteration and POSTs the bytes.
 *
 * Running this script is a one-time operator action; the checked-in fixture
 * is the input to `ingest-otlp.js`.
 *
 * Run: `pnpm --filter @foxhound/loadgen tsx scripts/build-proto-fixture.ts`
 * or   `tsx tools/loadgen/scripts/build-proto-fixture.ts` from the repo root.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { v1 } from "@foxhound/proto";

const SPANS_PER_TRACE = 4;
const TRACES = 1;

const traceId = "a".repeat(32);
const spans: v1.Span[] = [];
for (let t = 0; t < TRACES; t++) {
  let prev: string | undefined;
  for (let i = 0; i < SPANS_PER_TRACE; i++) {
    const spanId = `${t}`.padStart(2, "0") + `${i}`.padStart(14, "s");
    const start = 1_700_000_000_000 + i * 50;
    const end = start + 20 + i;
    spans.push({
      orgId: "org_loadgen",
      traceId,
      spanId,
      ...(prev !== undefined ? { parentSpanId: prev } : {}),
      name: i === 0 ? "llm.generate" : i === 1 ? "tool.search" : `agent.step.${i}`,
      kind: i === 0 || i === 1 ? v1.SpanKind.CLIENT : v1.SpanKind.INTERNAL,
      startTimeUnixNano: (BigInt(start) * 1_000_000n).toString(),
      endTimeUnixNano: (BigInt(end) * 1_000_000n).toString(),
      status: { code: v1.StatusCode.OK, message: "" },
      attributes:
        i === 0
          ? {
              "gen_ai.system": { stringValue: "openai" },
              "gen_ai.request.model": { stringValue: "gpt-4o" },
              "gen_ai.usage.input_tokens": { intValue: 512 },
              "gen_ai.usage.output_tokens": { intValue: 256 },
            }
          : i === 1
            ? {
                "tool.name": { stringValue: "vector_search" },
                "tool.result_count": { intValue: 5 },
              }
            : {
                "agent.step_index": { intValue: i },
                "agent.reasoning": { stringValue: "synthetic load" },
              },
      events: [],
    });
    prev = spanId;
  }
}

const batch: v1.TraceBatch = {
  schemaVersion: "v1",
  batchId: Date.now(),
  orgId: "org_loadgen",
  sdkLanguage: "ts",
  sdkVersion: "0.3.0",
  spans,
};

const bytes = v1.TraceBatchCodec.encode(batch);
const b64 = Buffer.from(bytes).toString("base64");

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../scenarios/fixtures");
const outPath = resolve(outDir, "trace-batch.v1.b64");
mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, b64 + "\n", "utf8");

// eslint-disable-next-line no-console
console.log(
  `wrote ${outPath} (${bytes.byteLength} wire bytes, ${b64.length} base64 chars, ${spans.length} spans)`,
);
