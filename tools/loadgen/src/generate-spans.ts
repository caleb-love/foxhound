/**
 * Synthetic span generator producing OTLP/HTTP JSON payloads matching the
 * current Foxhound ingest contract at `POST /v1/traces/otlp`.
 *
 * Output shape is intentionally aligned with `apps/api/src/load-test.ts` so
 * the k6 scenarios and the Node orchestrator share one wire contract.
 *
 * Tenant scoping note: multiple `orgIds` are emitted in one batch so the
 * harness itself would catch a cross-tenant leak if one were ever introduced.
 * The generator does NOT embed `orgId` in the payload — authentication (API
 * key) is what scopes the ingest. `orgId` flows through the harness CLI as
 * the per-request auth header selector.
 */

export type SpanKind = 1 | 2 | 3; // OTel SpanKind: INTERNAL=1, SERVER=2, CLIENT=3

export interface OtelAttributeKV {
  readonly key: string;
  readonly value:
    | { stringValue: string }
    | { intValue: number | string }
    | { doubleValue: number }
    | { boolValue: boolean };
}

export interface OtelEvent {
  readonly timeUnixNano: string;
  readonly name: string;
  readonly attributes: readonly OtelAttributeKV[];
}

export interface OtelSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTimeUnixNano: string;
  readonly endTimeUnixNano: string;
  readonly status: { code: 0 | 1 | 2 }; // UNSET=0, OK=1, ERROR=2
  readonly attributes: readonly OtelAttributeKV[];
  readonly events: readonly OtelEvent[];
}

export interface OtelScopeSpans {
  readonly spans: readonly OtelSpan[];
}

export interface OtelResource {
  readonly attributes: readonly OtelAttributeKV[];
}

export interface OtelResourceSpans {
  readonly resource: OtelResource;
  readonly scopeSpans: readonly OtelScopeSpans[];
}

export interface OtlpRequestBody {
  readonly resourceSpans: readonly OtelResourceSpans[];
}

// ---------------------------------------------------------------------------
// Realistic span templates. Mirrors `apps/api/src/load-test.ts` so the
// baseline we capture on the current code path is directly comparable.
// ---------------------------------------------------------------------------

interface SpanTemplate {
  readonly name: string;
  readonly kind: SpanKind;
  readonly attrs: Readonly<Record<string, string | number | boolean>>;
  readonly errorRate: number; // [0, 1]
}

const SPAN_TEMPLATES: readonly SpanTemplate[] = [
  {
    name: "llm.generate",
    kind: 3,
    attrs: {
      "gen_ai.system": "openai",
      "gen_ai.request.model": "gpt-4o",
      "gen_ai.usage.input_tokens": 512,
      "gen_ai.usage.output_tokens": 256,
    },
    errorRate: 0.02,
  },
  {
    name: "llm.embed",
    kind: 3,
    attrs: {
      "gen_ai.system": "openai",
      "gen_ai.request.model": "text-embedding-3-small",
      "gen_ai.usage.input_tokens": 128,
    },
    errorRate: 0.005,
  },
  {
    name: "tool.search",
    kind: 3,
    attrs: { "tool.name": "vector_search", "tool.result_count": 5 },
    errorRate: 0.01,
  },
  {
    name: "tool.sql_query",
    kind: 3,
    attrs: {
      "tool.name": "sql_query",
      "db.system": "postgresql",
      "db.statement": "SELECT * FROM docs WHERE id = $1",
    },
    errorRate: 0.03,
  },
  {
    name: "agent.step",
    kind: 1,
    attrs: { "agent.step_index": 0, "agent.reasoning": "Analyzing user request" },
    errorRate: 0.0,
  },
  {
    name: "agent.plan",
    kind: 1,
    attrs: { "agent.step_index": 1, "agent.reasoning": "Creating execution plan" },
    errorRate: 0.0,
  },
  {
    name: "workflow.orchestrate",
    kind: 2,
    attrs: { "workflow.name": "rag_pipeline", "workflow.version": "1.2.0" },
    errorRate: 0.005,
  },
  {
    name: "retrieval.rerank",
    kind: 1,
    attrs: { "retrieval.strategy": "cohere_rerank", "retrieval.top_k": 10 },
    errorRate: 0.01,
  },
] as const;

// ---------------------------------------------------------------------------
// Seeded pseudo-random helpers. Deterministic generation is required by tests
// and by CI-reproducible regression tracking. Using mulberry32 for speed.
// ---------------------------------------------------------------------------

export interface Rng {
  nextFloat(): number;
  nextInt(maxExclusive: number): number;
  nextHex(bytes: number): string;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const nextFloat = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const nextInt = (max: number): number => Math.floor(nextFloat() * max);
  const nextHex = (bytes: number): string => {
    const chars = "0123456789abcdef";
    let out = "";
    for (let i = 0; i < bytes * 2; i++) out += chars[nextInt(16)];
    return out;
  };
  return { nextFloat, nextInt, nextHex };
}

// ---------------------------------------------------------------------------
// Public generator interface.
// ---------------------------------------------------------------------------

export interface GenerateSpanOpts {
  readonly rng: Rng;
  readonly traceId: string;
  readonly spanId?: string;
  readonly parentSpanId?: string;
  readonly kind?: "generation" | "tool" | "chain";
  readonly sizeBytesTarget?: number; // soft target; default 2048
  readonly startOffsetMs?: number;
  readonly nowMs?: number;
}

function pickTemplate(rng: Rng, kindHint?: "generation" | "tool" | "chain"): SpanTemplate {
  if (!kindHint) {
    const t = SPAN_TEMPLATES[rng.nextInt(SPAN_TEMPLATES.length)];
    if (!t) throw new Error("empty span templates");
    return t;
  }
  const filtered = SPAN_TEMPLATES.filter((t) => {
    if (kindHint === "generation") return t.name.startsWith("llm.");
    if (kindHint === "tool") return t.name.startsWith("tool.");
    return (
      t.name.startsWith("agent.") ||
      t.name.startsWith("workflow.") ||
      t.name.startsWith("retrieval.")
    );
  });
  const pool = filtered.length > 0 ? filtered : SPAN_TEMPLATES;
  const t = pool[rng.nextInt(pool.length)];
  if (!t) throw new Error("empty template pool");
  return t;
}

function attrsFromTemplate(template: SpanTemplate): OtelAttributeKV[] {
  return Object.entries(template.attrs).map(([key, value]) => {
    if (typeof value === "number") return { key, value: { intValue: value } };
    if (typeof value === "boolean") return { key, value: { boolValue: value } };
    return { key, value: { stringValue: String(value) } };
  });
}

function nanoTs(rng: Rng, offsetMs: number, nowMs: number): string {
  // Introduce small jitter so timestamps are not perfectly aligned.
  const jitter = rng.nextInt(1000);
  return String(BigInt(nowMs + offsetMs) * 1_000_000n + BigInt(jitter));
}

/**
 * Generate a single span targeted at `sizeBytesTarget`. Extra padding is added
 * as a `payload.filler` string attribute to approximate realistic variance.
 */
export function generateSpan(opts: GenerateSpanOpts): OtelSpan {
  const { rng } = opts;
  const sizeTarget = opts.sizeBytesTarget ?? 2048;
  const template = pickTemplate(rng, opts.kind);
  const spanId = opts.spanId ?? rng.nextHex(8);
  const startOffsetMs = opts.startOffsetMs ?? 0;
  const nowMs = opts.nowMs ?? Date.now();
  const durationMs = 20 + rng.nextInt(200);

  const attributes: OtelAttributeKV[] = attrsFromTemplate(template);

  // Pad with a filler attribute to approximate the size target. Overhead of
  // surrounding JSON is ~600 bytes per span with this template set.
  const bodyEstimate = JSON.stringify({ name: template.name, attributes }).length + 600;
  const fillerSize = Math.max(0, sizeTarget - bodyEstimate);
  if (fillerSize > 0) {
    attributes.push({
      key: "payload.filler",
      value: { stringValue: "x".repeat(fillerSize) },
    });
  }

  const events: OtelEvent[] =
    startOffsetMs === 0
      ? [
          {
            timeUnixNano: nanoTs(rng, startOffsetMs + 5, nowMs),
            name: "request.start",
            attributes: [],
          },
        ]
      : [];

  const errored = rng.nextFloat() < template.errorRate;

  const span: OtelSpan = {
    traceId: opts.traceId,
    spanId,
    ...(opts.parentSpanId !== undefined ? { parentSpanId: opts.parentSpanId } : {}),
    name: template.name,
    kind: template.kind,
    startTimeUnixNano: nanoTs(rng, startOffsetMs, nowMs),
    endTimeUnixNano: nanoTs(rng, startOffsetMs + durationMs, nowMs),
    status: { code: errored ? 2 : 1 },
    attributes,
    events,
  };
  return span;
}

export interface GenerateTraceOpts {
  readonly rng: Rng;
  readonly orgId: string;
  readonly spansPerTrace: number;
  readonly sizeBytesTarget?: number;
  readonly nowMs?: number;
}

/**
 * Generate one complete OTLP resourceSpans bundle for a single trace with
 * `spansPerTrace` spans chained root → child → grandchild…
 */
export function generateTrace(opts: GenerateTraceOpts): OtelResourceSpans {
  const { rng, orgId, spansPerTrace } = opts;
  const traceId = rng.nextHex(16);
  const rootSpanId = rng.nextHex(8);
  const spans: OtelSpan[] = [];
  let prevSpanId = rootSpanId;
  const nowMs = opts.nowMs ?? Date.now();

  for (let i = 0; i < spansPerTrace; i++) {
    const span = generateSpan({
      rng,
      traceId,
      spanId: i === 0 ? rootSpanId : rng.nextHex(8),
      ...(i === 0 ? {} : { parentSpanId: prevSpanId }),
      sizeBytesTarget: opts.sizeBytesTarget ?? 2048,
      startOffsetMs: i * 50,
      nowMs,
    });
    spans.push(span);
    prevSpanId = span.spanId;
  }

  return {
    resource: {
      attributes: [
        { key: "service.name", value: { stringValue: `loadgen-agent-${orgId}` } },
        { key: "service.instance.id", value: { stringValue: `session-${rng.nextHex(4)}` } },
        { key: "service.version", value: { stringValue: "0.1.0" } },
        { key: "foxhound.loadgen.org_id", value: { stringValue: orgId } },
      ],
    },
    scopeSpans: [{ spans }],
  };
}

export interface GenerateBatchOpts {
  readonly rng: Rng;
  readonly orgIds: readonly string[];
  readonly tracesPerOrg: number;
  readonly spansPerTrace: number;
  readonly sizeBytesTarget?: number;
  readonly nowMs?: number;
}

/**
 * Generate one OTLP request body containing `tracesPerOrg × orgIds.length`
 * traces. Tenant scoping: each trace carries one org's resource attributes;
 * no trace crosses orgs.
 */
export function generateBatch(opts: GenerateBatchOpts): OtlpRequestBody {
  const { rng, orgIds, tracesPerOrg } = opts;
  const resourceSpans: OtelResourceSpans[] = [];
  for (const orgId of orgIds) {
    for (let i = 0; i < tracesPerOrg; i++) {
      resourceSpans.push(
        generateTrace({
          rng,
          orgId,
          spansPerTrace: opts.spansPerTrace,
          ...(opts.sizeBytesTarget !== undefined ? { sizeBytesTarget: opts.sizeBytesTarget } : {}),
          ...(opts.nowMs !== undefined ? { nowMs: opts.nowMs } : {}),
        }),
      );
    }
  }
  return { resourceSpans };
}
