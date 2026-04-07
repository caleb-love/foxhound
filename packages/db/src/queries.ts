import { db } from "./client.js";
import { traces } from "./schema.js";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { Trace, Span } from "@foxhound/types";

export interface TraceFilters {
  agentId?: string;
  sessionId?: string;
  /** Unix milliseconds lower bound (inclusive) */
  from?: number;
  /** Unix milliseconds upper bound (inclusive) */
  to?: number;
  page?: number;
  limit?: number;
}

export async function insertTrace(trace: Trace): Promise<void> {
  await db
    .insert(traces)
    .values({
      id: trace.id,
      agentId: trace.agentId,
      sessionId: trace.sessionId ?? null,
      startTimeMs: String(trace.startTimeMs),
      endTimeMs: trace.endTimeMs != null ? String(trace.endTimeMs) : null,
      spans: trace.spans as unknown[],
      metadata: trace.metadata as Record<string, unknown>,
    })
    .onConflictDoNothing();
}

export async function getTrace(id: string) {
  const rows = await db.select().from(traces).where(eq(traces.id, id)).limit(1);
  return rows[0] ?? null;
}

export interface ReplayContext {
  traceId: string;
  spanId: string;
  targetSpan: Span;
  spansUpToPoint: Span[];
  llmCallHistory: Span[];
  toolCallHistory: Span[];
  agentStepHistory: Span[];
}

/**
 * Reconstruct the full agent context at the moment a given span began.
 * Returns all spans that started at or before the target span's startTimeMs,
 * categorised by kind so the UI can render a rich replay panel.
 */
export async function getReplayContext(
  traceId: string,
  spanId: string,
): Promise<ReplayContext | null> {
  const row = await getTrace(traceId);
  if (!row) return null;

  const allSpans = (row.spans as unknown as Span[]).slice().sort(
    (a, b) => a.startTimeMs - b.startTimeMs,
  );

  const target = allSpans.find((s) => s.spanId === spanId);
  if (!target) return null;

  const spansUpToPoint = allSpans.filter(
    (s) => s.startTimeMs <= target.startTimeMs,
  );

  return {
    traceId,
    spanId,
    targetSpan: target,
    spansUpToPoint,
    llmCallHistory: spansUpToPoint.filter((s) => s.kind === "llm_call"),
    toolCallHistory: spansUpToPoint.filter((s) => s.kind === "tool_call"),
    agentStepHistory: spansUpToPoint.filter((s) => s.kind === "agent_step"),
  };
}

export async function queryTraces(filters: TraceFilters = {}) {
  const { agentId, sessionId, from, to, page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (agentId) conditions.push(eq(traces.agentId, agentId));
  if (sessionId) conditions.push(eq(traces.sessionId, sessionId));
  // startTimeMs stored as text; 13-digit ms timestamps sort lexicographically
  if (from != null) conditions.push(gte(traces.startTimeMs, String(from)));
  if (to != null) conditions.push(lte(traces.startTimeMs, String(to)));

  return db
    .select()
    .from(traces)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(traces.createdAt))
    .limit(limit)
    .offset(offset);
}
