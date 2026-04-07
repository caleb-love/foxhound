import type { Span, Trace } from "@foxhound/types";

const API_URL = process.env.FOXHOUND_API_URL ?? "http://localhost:4000";
const API_KEY = process.env.FOXHOUND_API_KEY ?? "";

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
  };
}

export interface TraceRow {
  id: string;
  agentId: string;
  sessionId: string | null;
  startTimeMs: string;
  endTimeMs: string | null;
  spans: Span[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TraceListResponse {
  data: TraceRow[];
  pagination: { page: number; limit: number; count: number };
}

export async function listTraces(params: {
  agentId?: string;
  page?: number;
  limit?: number;
} = {}): Promise<TraceListResponse> {
  const qs = new URLSearchParams();
  if (params.agentId) qs.set("agentId", params.agentId);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));

  const res = await fetch(`${API_URL}/v1/traces?${qs}`, {
    headers: headers(),
    next: { revalidate: 5 },
  });
  if (!res.ok) throw new Error(`Failed to list traces: ${res.status}`);
  return res.json();
}

export async function getTrace(id: string): Promise<TraceRow | null> {
  const res = await fetch(`${API_URL}/v1/traces/${encodeURIComponent(id)}`, {
    headers: headers(),
    next: { revalidate: 0 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get trace ${id}: ${res.status}`);
  return res.json();
}

// ---- Span utilities --------------------------------------------------------

export function spanDurationMs(span: Span): number {
  if (!span.endTimeMs) return 0;
  return span.endTimeMs - span.startTimeMs;
}

export function traceDurationMs(row: TraceRow): number {
  if (!row.endTimeMs) return 0;
  return Number(row.endTimeMs) - Number(row.startTimeMs);
}

/** Build a depth-first ordered list of spans with nesting depth. */
export function buildSpanTree(spans: Span[]): Array<{ span: Span; depth: number }> {
  const byId = new Map<string, Span>(spans.map((s) => [s.spanId, s]));
  const childrenOf = new Map<string, Span[]>();
  const roots: Span[] = [];

  for (const span of spans) {
    if (span.parentSpanId && byId.has(span.parentSpanId)) {
      const siblings = childrenOf.get(span.parentSpanId) ?? [];
      siblings.push(span);
      childrenOf.set(span.parentSpanId, siblings);
    } else {
      roots.push(span);
    }
  }

  const result: Array<{ span: Span; depth: number }> = [];

  function visit(span: Span, depth: number) {
    result.push({ span, depth });
    const kids = (childrenOf.get(span.spanId) ?? []).sort(
      (a, b) => a.startTimeMs - b.startTimeMs,
    );
    for (const kid of kids) visit(kid, depth + 1);
  }

  roots.sort((a, b) => a.startTimeMs - b.startTimeMs);
  for (const root of roots) visit(root, 0);

  return result;
}
