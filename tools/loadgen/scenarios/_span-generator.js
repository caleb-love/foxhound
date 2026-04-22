// Shared k6 span generator. Kept as plain JS (not TS) because k6 runs its own
// Goja-based JS runtime and cannot import TypeScript. The shape MUST remain
// wire-compatible with `src/generate-spans.ts`; any change here requires a
// matching change there, and vice versa.

// Generate N random lowercase hex chars.
export function hex(nBytes) {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < nBytes * 2; i++) out += chars[Math.floor(Math.random() * 16)];
  return out;
}

export function nanoTs(offsetMs) {
  return String(BigInt(Date.now() + offsetMs) * 1000000n);
}

const TEMPLATES = [
  {
    name: "llm.generate",
    kind: 3,
    attrs: [
      { key: "gen_ai.system", value: { stringValue: "openai" } },
      { key: "gen_ai.request.model", value: { stringValue: "gpt-4o" } },
      { key: "gen_ai.usage.input_tokens", value: { intValue: 512 } },
      { key: "gen_ai.usage.output_tokens", value: { intValue: 256 } },
    ],
    errorRate: 0.02,
  },
  {
    name: "llm.embed",
    kind: 3,
    attrs: [
      { key: "gen_ai.system", value: { stringValue: "openai" } },
      { key: "gen_ai.request.model", value: { stringValue: "text-embedding-3-small" } },
      { key: "gen_ai.usage.input_tokens", value: { intValue: 128 } },
    ],
    errorRate: 0.005,
  },
  {
    name: "tool.search",
    kind: 3,
    attrs: [
      { key: "tool.name", value: { stringValue: "vector_search" } },
      { key: "tool.result_count", value: { intValue: 5 } },
    ],
    errorRate: 0.01,
  },
  {
    name: "tool.sql_query",
    kind: 3,
    attrs: [
      { key: "tool.name", value: { stringValue: "sql_query" } },
      { key: "db.system", value: { stringValue: "postgresql" } },
      { key: "db.statement", value: { stringValue: "SELECT * FROM docs WHERE id = $1" } },
    ],
    errorRate: 0.03,
  },
  {
    name: "agent.step",
    kind: 1,
    attrs: [
      { key: "agent.step_index", value: { intValue: 0 } },
      { key: "agent.reasoning", value: { stringValue: "Analyzing user request" } },
    ],
    errorRate: 0.0,
  },
  {
    name: "workflow.orchestrate",
    kind: 2,
    attrs: [
      { key: "workflow.name", value: { stringValue: "rag_pipeline" } },
      { key: "workflow.version", value: { stringValue: "1.2.0" } },
    ],
    errorRate: 0.005,
  },
];

export function pickTemplate() {
  return TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
}

/**
 * Build one OTLP/HTTP JSON request body for a single trace.
 * `orgId` is embedded in resource attributes for trace-level tenant tagging;
 * authentication scoping is applied via the Authorization header at send time.
 */
export function buildPayload(opts) {
  const orgId = opts.orgId;
  const spansPerTrace = opts.spansPerTrace || 4;
  const sizeBytesTarget = opts.sizeBytesTarget || 2048;

  const traceId = hex(16);
  const rootSpanId = hex(8);
  const spans = [];
  let prevSpanId = rootSpanId;

  for (let i = 0; i < spansPerTrace; i++) {
    const t = pickTemplate();
    const spanId = i === 0 ? rootSpanId : hex(8);
    const parentSpanId = i === 0 ? undefined : prevSpanId;
    const startOffset = i * 50;
    const durationMs = 20 + Math.floor(Math.random() * 200);

    const attrs = t.attrs.slice();
    const bodyEstimate = JSON.stringify({ name: t.name, attributes: attrs }).length + 600;
    const fillerSize = Math.max(0, sizeBytesTarget - bodyEstimate);
    if (fillerSize > 0) {
      attrs.push({ key: "payload.filler", value: { stringValue: "x".repeat(fillerSize) } });
    }

    const errored = Math.random() < t.errorRate;
    const span = {
      traceId,
      spanId,
      name: t.name,
      kind: t.kind,
      startTimeUnixNano: nanoTs(startOffset),
      endTimeUnixNano: nanoTs(startOffset + durationMs),
      status: { code: errored ? 2 : 1 },
      attributes: attrs,
      events:
        i === 0
          ? [{ timeUnixNano: nanoTs(startOffset + 5), name: "request.start", attributes: [] }]
          : [],
    };
    if (parentSpanId) span.parentSpanId = parentSpanId;
    spans.push(span);
    prevSpanId = spanId;
  }

  return JSON.stringify({
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "loadgen-agent-" + orgId } },
            { key: "service.instance.id", value: { stringValue: "session-" + hex(4) } },
            { key: "service.version", value: { stringValue: "0.1.0" } },
            { key: "foxhound.loadgen.org_id", value: { stringValue: orgId } },
          ],
        },
        scopeSpans: [{ spans }],
      },
    ],
  });
}

export function envInt(name, def) {
  const v = __ENV[name];
  return v ? parseInt(v, 10) : def;
}

export function envStr(name, def) {
  return __ENV[name] || def;
}

export function envCsv(name, def) {
  const v = __ENV[name];
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : def;
}
