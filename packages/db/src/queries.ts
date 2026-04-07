import { db } from "./client.js";
import { traces } from "./schema.js";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { Trace } from "@foxhound/types";

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
