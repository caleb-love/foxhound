import { and, asc, desc, eq, gte, isNull, lte, lt, sql } from "drizzle-orm";
import type { Span, Trace } from "@foxhound/types";
import { db } from "./client.js";
import { organizations, spans, traces } from "./schema.js";

export interface TraceFilters {
  orgId: string;
  agentId?: string;
  sessionId?: string;
  /** Unix milliseconds lower bound (inclusive) */
  from?: number;
  /** Unix milliseconds upper bound (inclusive) */
  to?: number;
  page?: number;
  limit?: number;
}

export async function insertTrace(trace: Trace, orgId: string): Promise<void> {
  await db
    .insert(traces)
    .values({
      id: trace.id,
      orgId,
      agentId: trace.agentId,
      sessionId: trace.sessionId ?? null,
      startTimeMs: trace.startTimeMs,
      endTimeMs: trace.endTimeMs ?? null,
      parentAgentId: trace.parentAgentId ?? null,
      correlationId: trace.correlationId ?? null,
      spans: [],
      metadata: trace.metadata as Record<string, unknown>,
    })
    .onConflictDoNothing();
}

export async function getTrace(id: string, orgId: string) {
  const rows = await db
    .select()
    .from(traces)
    .where(and(eq(traces.id, id), eq(traces.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTraceWithSpans(id: string, orgId: string) {
  const row = await getTrace(id, orgId);
  if (!row) return null;
  const resolvedSpans = await resolveSpans(id, orgId, row);
  return { ...row, spans: resolvedSpans };
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

async function resolveSpans(
  traceId: string,
  orgId: string,
  existingRow?: { spans: unknown },
): Promise<Span[]> {
  const normalized = await getSpansByTraceId(traceId, orgId);
  if (normalized.length > 0) return normalized;

  const row = existingRow ?? (await getTrace(traceId, orgId));
  if (!row) return [];
  return (row.spans as unknown as Span[]).slice().sort((a, b) => a.startTimeMs - b.startTimeMs);
}

export async function getReplayContext(
  traceId: string,
  spanId: string,
  orgId: string,
): Promise<ReplayContext | null> {
  const row = await getTrace(traceId, orgId);
  if (!row) return null;

  const allSpans = await resolveSpans(traceId, orgId, row);

  const target = allSpans.find((s) => s.spanId === spanId);
  if (!target) return null;

  const spansUpToPoint = allSpans.filter((s) => s.startTimeMs <= target.startTimeMs);

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

export type DivergenceReason =
  | "status_changed"
  | "attributes_changed"
  | "span_added"
  | "span_removed"
  | "name_changed";

export interface SpanDiff {
  position: number;
  kind: "matched" | "added" | "removed";
  spanA?: Span;
  spanB?: Span;
  diverged: boolean;
  divergenceReasons: DivergenceReason[];
  explanation: string;
}

export interface RunDiffResult {
  traceIdA: string;
  traceIdB: string;
  totalSpansA: number;
  totalSpansB: number;
  alignedSpans: SpanDiff[];
  divergenceCount: number;
  summary: string;
}

function lcsAlign(spansA: Span[], spansB: Span[]): Array<[number, number]> {
  const m = spansA.length;
  const n = spansB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const a = spansA[i - 1]!;
      const b = spansB[j - 1]!;
      if (a.name === b.name && a.kind === b.kind) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  const pairs: Array<[number, number]> = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    const a = spansA[i - 1]!;
    const b = spansB[j - 1]!;
    if (a.name === b.name && a.kind === b.kind) {
      pairs.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }
  return pairs;
}

function diffAttributes(a: Span["attributes"], b: Span["attributes"]): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return true;
  for (const k of keysA) {
    if (a[k] !== b[k]) return true;
  }
  return false;
}

function buildExplanation(reasons: DivergenceReason[], spanA?: Span, spanB?: Span): string {
  if (reasons.length === 0) return "Identical";
  const parts: string[] = [];
  for (const r of reasons) {
    if (r === "status_changed") {
      parts.push(`status changed from "${spanA?.status}" to "${spanB?.status}"`);
    } else if (r === "attributes_changed") {
      parts.push("span attributes differ (different inputs or tool results)");
    } else if (r === "span_added") {
      parts.push(`span "${spanB?.name}" present only in run B`);
    } else if (r === "span_removed") {
      parts.push(`span "${spanA?.name}" present only in run A`);
    } else if (r === "name_changed") {
      parts.push(`name changed from "${spanA?.name}" to "${spanB?.name}"`);
    }
  }
  return parts.join("; ");
}

export async function diffTraces(
  traceIdA: string,
  traceIdB: string,
  orgId: string,
): Promise<RunDiffResult | null> {
  const [rowA, rowB] = await Promise.all([getTrace(traceIdA, orgId), getTrace(traceIdB, orgId)]);
  if (!rowA || !rowB) return null;

  const [spansA, spansB] = await Promise.all([
    resolveSpans(traceIdA, orgId),
    resolveSpans(traceIdB, orgId),
  ]);

  const matchedPairs = lcsAlign(spansA, spansB);
  const matchedA = new Set(matchedPairs.map(([i]) => i));
  const matchedB = new Set(matchedPairs.map(([, j]) => j));

  const aligned: SpanDiff[] = [];
  let position = 0;
  let pairIdx = 0;
  let ai = 0;
  let bi = 0;

  while (ai < spansA.length || bi < spansB.length) {
    const nextPair = matchedPairs[pairIdx];

    if (nextPair && ai === nextPair[0] && bi === nextPair[1]) {
      const spanA = spansA[ai]!;
      const spanB = spansB[bi]!;
      const reasons: DivergenceReason[] = [];
      if (spanA.status !== spanB.status) reasons.push("status_changed");
      if (diffAttributes(spanA.attributes, spanB.attributes)) reasons.push("attributes_changed");
      aligned.push({
        position: position++,
        kind: "matched",
        spanA,
        spanB,
        diverged: reasons.length > 0,
        divergenceReasons: reasons,
        explanation: buildExplanation(reasons, spanA, spanB),
      });
      ai++;
      bi++;
      pairIdx++;
    } else if (ai < spansA.length && !matchedA.has(ai)) {
      const spanA = spansA[ai]!;
      aligned.push({
        position: position++,
        kind: "removed",
        spanA,
        diverged: true,
        divergenceReasons: ["span_removed"],
        explanation: buildExplanation(["span_removed"], spanA, undefined),
      });
      ai++;
    } else if (bi < spansB.length && !matchedB.has(bi)) {
      const spanB = spansB[bi]!;
      aligned.push({
        position: position++,
        kind: "added",
        spanB,
        diverged: true,
        divergenceReasons: ["span_added"],
        explanation: buildExplanation(["span_added"], undefined, spanB),
      });
      bi++;
    } else {
      if (ai < spansA.length) ai++;
      else bi++;
    }
  }

  const divergenceCount = aligned.filter((d) => d.diverged).length;

  const summaryParts: string[] = [];
  const addedCount = aligned.filter((d) => d.kind === "added").length;
  const removedCount = aligned.filter((d) => d.kind === "removed").length;
  const attrChangedCount = aligned.filter(
    (d) => d.kind === "matched" && d.divergenceReasons.includes("attributes_changed"),
  ).length;
  const statusChangedCount = aligned.filter(
    (d) => d.kind === "matched" && d.divergenceReasons.includes("status_changed"),
  ).length;

  if (divergenceCount === 0) {
    summaryParts.push("Runs are identical.");
  } else {
    if (addedCount > 0) summaryParts.push(`${addedCount} span(s) added in run B`);
    if (removedCount > 0) summaryParts.push(`${removedCount} span(s) removed in run B`);
    if (attrChangedCount > 0)
      summaryParts.push(`${attrChangedCount} span(s) with differing inputs or tool results`);
    if (statusChangedCount > 0)
      summaryParts.push(`${statusChangedCount} span(s) with status changes`);
  }

  return {
    traceIdA,
    traceIdB,
    totalSpansA: spansA.length,
    totalSpansB: spansB.length,
    alignedSpans: aligned,
    divergenceCount,
    summary: summaryParts.join("; ") || "No divergence detected.",
  };
}

export async function queryTraces(filters: TraceFilters) {
  const { orgId, agentId, sessionId, from, to, page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [eq(traces.orgId, orgId)];
  if (agentId) conditions.push(eq(traces.agentId, agentId));
  if (sessionId) conditions.push(eq(traces.sessionId, sessionId));
  if (from != null) conditions.push(gte(traces.startTimeMs, from));
  if (to != null) conditions.push(lte(traces.startTimeMs, to));

  return db
    .select()
    .from(traces)
    .where(and(...conditions))
    .orderBy(desc(traces.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function insertSpans(traceId: string, orgId: string, spanList: Span[]): Promise<void> {
  if (spanList.length === 0) return;
  await db
    .insert(spans)
    .values(
      spanList.map((s) => ({
        id: s.spanId,
        traceId,
        orgId,
        parentSpanId: s.parentSpanId ?? null,
        name: s.name,
        kind: s.kind,
        status: s.status,
        startTimeMs: s.startTimeMs,
        endTimeMs: s.endTimeMs ?? null,
        attributes: s.attributes,
        events: s.events,
      })),
    )
    .onConflictDoNothing();
}

export async function updateSpanCosts(
  costs: Array<{ traceId: string; spanId: string; costUsd: number }>,
  orgId: string,
): Promise<void> {
  if (costs.length === 0) return;
  await Promise.all(
    costs.map((c) =>
      db
        .update(spans)
        .set({ costUsd: String(c.costUsd) })
        .where(and(eq(spans.traceId, c.traceId), eq(spans.id, c.spanId), eq(spans.orgId, orgId))),
    ),
  );
}

async function getSpansByTraceId(traceId: string, orgId: string): Promise<Span[]> {
  const rows = await db
    .select()
    .from(spans)
    .where(and(eq(spans.traceId, traceId), eq(spans.orgId, orgId)))
    .orderBy(asc(spans.startTimeMs));

  return rows.map((r) => ({
    traceId: r.traceId,
    spanId: r.id,
    parentSpanId: r.parentSpanId ?? undefined,
    name: r.name,
    kind: r.kind as Span["kind"],
    startTimeMs: r.startTimeMs,
    endTimeMs: r.endTimeMs ?? undefined,
    status: r.status as Span["status"],
    attributes: r.attributes as Span["attributes"],
    events: r.events as Span["events"],
  }));
}

export async function deleteExpiredTraces(orgId: string, retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .delete(traces)
    .where(and(eq(traces.orgId, orgId), lt(traces.createdAt, cutoff)))
    .returning({ id: traces.id });
  return rows.length;
}

export async function getOrgsWithRetention() {
  return db
    .select({
      id: organizations.id,
      retentionDays: organizations.retentionDays,
    })
    .from(organizations);
}
