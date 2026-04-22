import { describe, it, expect } from "vitest";
import { EvalTriggerHandler } from "./eval-trigger.js";
import { makeCloseObs, makeSpan, makeTrace, stubData } from "./test-utils.js";

describe("EvalTriggerHandler", () => {
  it("does nothing when no triggers are configured", async () => {
    const data = stubData();
    const h = new EvalTriggerHandler({ data, now: () => 1_700_000_000_000 });
    await h.onTraceClose(makeCloseObs());
    expect(data.evaluatorRuns).toHaveLength(0);
  });

  it("enqueues an evaluator run when matchTag matches", async () => {
    const data = stubData();
    data.triggers.set("org-a", [
      {
        id: "r1",
        orgId: "org-a",
        agentId: "agent-a",
        evaluatorId: "eval-x",
        matchTag: "hot",
        onError: false,
        sampleRate: 1,
      },
    ]);
    const h = new EvalTriggerHandler({ data, now: () => 1 });
    const trace = makeTrace({ metadata: { "foxhound.eval_tag": "hot" } });
    await h.onTraceClose(makeCloseObs({ trace, traceId: trace.id }));
    expect(data.evaluatorRuns).toHaveLength(1);
    expect(data.evaluatorRuns[0]!.evaluatorId).toBe("eval-x");
  });

  it("skips triggers for different agent IDs", async () => {
    const data = stubData();
    data.triggers.set("org-a", [
      {
        id: "r1",
        orgId: "org-a",
        agentId: "agent-other",
        evaluatorId: "eval-x",
        matchTag: null,
        onError: false,
        sampleRate: 1,
      },
    ]);
    const h = new EvalTriggerHandler({ data, now: () => 1 });
    await h.onTraceClose(makeCloseObs({ agentId: "agent-a" }));
    expect(data.evaluatorRuns).toHaveLength(0);
  });

  it("fires onError triggers only when the trace has an error span", async () => {
    const data = stubData();
    data.triggers.set("org-a", [
      {
        id: "r1",
        orgId: "org-a",
        agentId: "agent-a",
        evaluatorId: "eval-err",
        matchTag: null,
        onError: true,
        sampleRate: 1,
      },
    ]);
    const h = new EvalTriggerHandler({ data, now: () => 1 });
    // No error → no fire.
    await h.onTraceClose(makeCloseObs());
    expect(data.evaluatorRuns).toHaveLength(0);
    // With error → fire.
    const failed = makeTrace({
      spans: [makeSpan({ status: "error" })],
    });
    await h.onTraceClose(makeCloseObs({ trace: failed, traceId: failed.id }));
    expect(data.evaluatorRuns).toHaveLength(1);
  });

  it("respects sampleRate via injected RNG", async () => {
    const data = stubData();
    data.triggers.set("org-a", [
      {
        id: "r1",
        orgId: "org-a",
        agentId: "agent-a",
        evaluatorId: "eval-sample",
        matchTag: null,
        onError: false,
        sampleRate: 0.5,
      },
    ]);
    let rngSeq = 0;
    const values = [0.1, 0.9, 0.3, 0.8];
    const h = new EvalTriggerHandler({
      data,
      now: () => 1,
      random: () => values[rngSeq++ % values.length]!,
    });
    for (let i = 0; i < 4; i++) {
      await h.onTraceClose(makeCloseObs());
    }
    // 0.1 and 0.3 pass (<= 0.5); 0.9 and 0.8 fail. 2 enqueues.
    expect(data.evaluatorRuns).toHaveLength(2);
  });

  it("caches rules per-org for rulesTtlMs", async () => {
    const data = stubData();
    let callCount = 0;
    const orig = data.listEvalTriggers.bind(data);
    data.listEvalTriggers = async (orgId) => {
      callCount++;
      return orig(orgId);
    };
    data.triggers.set("org-a", []);

    let now = 1_000;
    const h = new EvalTriggerHandler({
      data,
      rulesTtlMs: 10_000,
      now: () => now,
    });
    await h.onTraceClose(makeCloseObs());
    await h.onTraceClose(makeCloseObs());
    expect(callCount).toBe(1);
    now += 15_000;
    await h.onTraceClose(makeCloseObs());
    expect(callCount).toBe(2);
  });

  it("is tenant-scoped: rules for one org never fire for another", async () => {
    const data = stubData();
    data.triggers.set("org-a", [
      {
        id: "r1",
        orgId: "org-a",
        agentId: "agent-a",
        evaluatorId: "eval-x",
        matchTag: null,
        onError: false,
        sampleRate: 1,
      },
    ]);
    const h = new EvalTriggerHandler({ data, now: () => 1 });
    await h.onTraceClose(makeCloseObs({ orgId: "org-b", agentId: "agent-a" }));
    expect(data.evaluatorRuns).toHaveLength(0);
  });
});
