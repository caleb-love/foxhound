import { describe, it, expect, vi } from "vitest";
import type { Trace } from "@foxhound/types";
import { makeClickHousePersist } from "../src/persistence.js";
import type { AnalyticsClient } from "../src/client.js";

function mkTrace(): Trace {
  return {
    id: "t-p-1",
    agentId: "agent_persist",
    spans: [
      {
        traceId: "t-p-1",
        spanId: "s-0",
        name: "llm.generate",
        kind: "llm_call",
        startTimeMs: 1_700_000_000_000,
        endTimeMs: 1_700_000_000_100,
        status: "ok",
        attributes: { "gen_ai.request.model": "gpt-4o" },
        events: [],
      },
      {
        traceId: "t-p-1",
        spanId: "s-1",
        parentSpanId: "s-0",
        name: "tool.search",
        kind: "tool_call",
        startTimeMs: 1_700_000_000_020,
        endTimeMs: 1_700_000_000_080,
        status: "error",
        attributes: {},
        events: [],
      },
    ],
    startTimeMs: 1_700_000_000_000,
    endTimeMs: 1_700_000_000_100,
    metadata: {},
  };
}

function fakeClient(): { client: AnalyticsClient; inserts: unknown[] } {
  const inserts: unknown[] = [];
  const client: AnalyticsClient = {
    raw: {
      insert: async (args: unknown) => {
        inserts.push(args);
        return { query_id: "fake", executed: true };
      },
      query: async () => ({ json: async () => [] }),
      command: async () => undefined,
      ping: async () => ({ success: true, response: "" }),
      close: async () => undefined,
    } as unknown as AnalyticsClient["raw"],
    database: "foxhound",
    options: {
      url: "x",
      database: "foxhound",
      username: "default",
      password: "",
      insertBatchRows: 10,
      insertBatchMs: 100,
    },
    close: async () => undefined,
  };
  return { client, inserts };
}

describe("db-analytics · makeClickHousePersist", () => {
  it("inserts one row per span with the authenticated org_id", async () => {
    const { client, inserts } = fakeClient();
    const persist = makeClickHousePersist(client);
    await persist(undefined, mkTrace(), "org_persist");
    expect(inserts).toHaveLength(1);
    const call = inserts[0] as { table: string; values: Array<{ org_id: string }> };
    expect(call.table).toBe("spans");
    expect(call.values).toHaveLength(2);
    expect(call.values.every((r) => r.org_id === "org_persist")).toBe(true);
  });

  it("extracts agent_id from the trace by default", async () => {
    const { client, inserts } = fakeClient();
    await makeClickHousePersist(client)(undefined, mkTrace(), "org_a");
    const call = inserts[0] as { values: Array<{ agent_id: string | null }> };
    expect(call.values[0]!.agent_id).toBe("agent_persist");
  });

  it("honours a custom extractTraceContext", async () => {
    const { client, inserts } = fakeClient();
    const persist = makeClickHousePersist(client, {
      extractTraceContext: () => ({ agentId: "override_agent" }),
    });
    await persist(undefined, mkTrace(), "org_a");
    const call = inserts[0] as { values: Array<{ agent_id: string | null }> };
    expect(call.values.every((r) => r.agent_id === "override_agent")).toBe(true);
  });

  it("is a no-op for a zero-span trace", async () => {
    const { client, inserts } = fakeClient();
    const persist = makeClickHousePersist(client);
    await persist(undefined, { ...mkTrace(), spans: [] }, "org_a");
    // makeClickHousePersist delegates to batchInsert which is a no-op on 0 rows.
    expect(inserts).toHaveLength(0);
  });

  it("passes through the logger without coupling to Fastify", async () => {
    const { client } = fakeClient();
    const log = vi.fn();
    const persist = makeClickHousePersist(client);
    await expect(persist(log, mkTrace(), "org_a")).resolves.toBeUndefined();
  });

  // ── WP15 · per-span agent_id override ───────────────────────────────

  it("WP15 uses per-span agentId over the trace-level default", async () => {
    const { client, inserts } = fakeClient();
    const trace = mkTrace();
    // Second span is tagged to a distinct subagent.
    trace.spans[1] = { ...trace.spans[1]!, agentId: "researcher" };
    await makeClickHousePersist(client)(undefined, trace, "org_a");
    const call = inserts[0] as { values: Array<{ agent_id: string | null; span_id: string }> };
    const s0 = call.values.find((r) => r.span_id === "s-0")!;
    const s1 = call.values.find((r) => r.span_id === "s-1")!;
    expect(s0.agent_id).toBe("agent_persist");
    expect(s1.agent_id).toBe("researcher");
  });

  // ── WP16 · cost hook ───────────────────────────────────────────

  it("WP16 computeSpanCost hook populates cost_usd_micros per span", async () => {
    const { client, inserts } = fakeClient();
    const computeSpanCost = vi
      .fn<Parameters<NonNullable<Parameters<typeof makeClickHousePersist>[1]>["computeSpanCost"]>, Promise<number | null>>()
      .mockResolvedValue(0.000_123_45);
    const persist = makeClickHousePersist(client, { computeSpanCost });
    await persist(undefined, mkTrace(), "org_a");
    const call = inserts[0] as {
      values: Array<{ span_id: string; cost_usd_micros: number | null }>;
    };
    // 0.00012345 USD = 123.45 µ$ → round to 123 for int64 storage.
    expect(call.values[0]!.cost_usd_micros).toBe(123);
    expect(call.values[1]!.cost_usd_micros).toBe(123);
    expect(computeSpanCost).toHaveBeenCalledTimes(2);
  });

  it("WP16 null from computeSpanCost leaves cost_usd_micros unset", async () => {
    const { client, inserts } = fakeClient();
    const persist = makeClickHousePersist(client, {
      computeSpanCost: () => null,
    });
    await persist(undefined, mkTrace(), "org_a");
    const call = inserts[0] as { values: Array<{ cost_usd_micros: number | null }> };
    for (const row of call.values) {
      expect(row.cost_usd_micros).toBeNull();
    }
  });

  it("WP16 sync computeSpanCost hook is supported alongside async", async () => {
    const { client, inserts } = fakeClient();
    const persist = makeClickHousePersist(client, {
      // Return a raw number (not a Promise) to exercise the sync branch.
      computeSpanCost: ({ span }) => (span.kind === "llm_call" ? 0.002 : null),
    });
    await persist(undefined, mkTrace(), "org_a");
    const call = inserts[0] as {
      values: Array<{ span_id: string; cost_usd_micros: number | null }>;
    };
    const llm = call.values.find((r) => r.span_id === "s-0")!;
    const tool = call.values.find((r) => r.span_id === "s-1")!;
    expect(llm.cost_usd_micros).toBe(2_000); // 0.002 USD × 1e6
    expect(tool.cost_usd_micros).toBeNull();
  });
});
