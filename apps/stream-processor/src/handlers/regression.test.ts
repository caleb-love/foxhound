import { describe, it, expect } from "vitest";
import { RegressionHandler, computeFreq, significantDrifts } from "./regression.js";
import { makeCloseObs, makeSpan, makeTrace, spyEmitter, stubData } from "./test-utils.js";

describe("significantDrifts", () => {
  it("returns no drifts when distributions match", () => {
    const freq = { a: 0.8, b: 0.2 };
    expect(significantDrifts(freq, freq, 100, 100, 3, 0.1)).toHaveLength(0);
  });

  it("detects a brand-new span type above the z threshold and abs change", () => {
    const baseline = { a: 1 };
    const current = { a: 1, b: 0.9 };
    const drifts = significantDrifts(baseline, current, 100, 100, 3, 0.1);
    const bDrift = drifts.find((d) => d.span === "b");
    expect(bDrift).toBeDefined();
    expect(bDrift!.type).toBe("new");
  });

  it("detects a missing span type", () => {
    const baseline = { a: 1.0, b: 0.95 };
    const current = { a: 1.0 };
    const drifts = significantDrifts(baseline, current, 100, 100, 3, 0.1);
    const bDrift = drifts.find((d) => d.span === "b");
    expect(bDrift).toBeDefined();
    expect(bDrift!.type).toBe("missing");
  });

  it("does not flag moderate shifts on large baselines with tiny current samples", () => {
    // baseline n1=1000 observes key 'a' 50% of the time.
    // current n2=3 observes key 'a' 67% of the time (2 of 3 traces).
    // Absolute shift = 17pp (above minAbsChange=0.1) BUT the two-proportion
    // z-test has very low power with n2=3, so z is small and we reject.
    const baseline = { a: 0.5 };
    const current = { a: 0.67 };
    const drifts = significantDrifts(baseline, current, 1000, 3, 3, 0.1);
    expect(drifts.find((d) => d.span === "a")).toBeUndefined();
  });

  it("ignores changes below minAbsChange even if z is large", () => {
    const baseline = { a: 0.5 };
    const current = { a: 0.55 }; // 5pp shift
    expect(significantDrifts(baseline, current, 1000, 1000, 3, 0.1)).toHaveLength(0);
  });
});

describe("computeFreq", () => {
  it("normalizes counts across samples, dedup per-sample", () => {
    const samples = [
      { spanNames: ["a", "b"], observedMs: 0 },
      { spanNames: ["a"], observedMs: 0 },
      { spanNames: ["a", "b"], observedMs: 0 },
    ];
    const freq = computeFreq(samples);
    expect(freq["a"]).toBeCloseTo(1.0);
    expect(freq["b"]).toBeCloseTo(2 / 3);
  });
});

describe("RegressionHandler", () => {
  it("requires agent.version to be present", async () => {
    const data = stubData();
    const emitter = spyEmitter();
    const h = new RegressionHandler({ data, emitter, now: () => 1_700_000_000_000 });
    await h.onTraceClose(makeCloseObs());
    expect(emitter.events).toHaveLength(0);
  });

  it("does not fire below minSampleSize", async () => {
    const data = stubData();
    const emitter = spyEmitter();
    const h = new RegressionHandler({
      data,
      emitter,
      minSampleSize: 30,
      now: () => 1_700_000_000_000,
    });
    for (let i = 0; i < 5; i++) {
      const trace = makeTrace({
        id: `t-${i}`,
        metadata: { "agent.version": "v2" },
      });
      await h.onTraceClose(
        makeCloseObs({ trace, traceId: trace.id, observedMs: 1_700_000_000_000 }),
      );
    }
    expect(emitter.events).toHaveLength(0);
  });

  it("fires behavior_regression when current differs from stored baseline", async () => {
    const data = stubData();
    data.baselines.set("org-a::agent-a::__previous__", {
      orgId: "org-a",
      agentId: "agent-a",
      agentVersion: "v1",
      sampleSize: 200,
      spanStructure: { "llm.chat": 1.0, "tool.search": 0.9 },
    });
    const emitter = spyEmitter();
    let now = 1_700_000_000_000;
    const h = new RegressionHandler({
      data,
      emitter,
      minSampleSize: 30,
      windowMs: 60 * 60_000,
      bucketMs: 60_000,
      now: () => now,
    });
    // v2 traces: llm.chat present, tool.search replaced by tool.vector.
    for (let i = 0; i < 40; i++) {
      now += 60_000;
      const trace = makeTrace({
        id: `t-${i}`,
        metadata: { "agent.version": "v2" },
        spans: [
          makeSpan({ name: "llm.chat", traceId: `t-${i}` }),
          makeSpan({ name: "tool.vector", traceId: `t-${i}` }),
        ],
      });
      await h.onTraceClose(makeCloseObs({ trace, traceId: trace.id, observedMs: now }));
    }
    const regressions = emitter.events.filter((e) => e.type === "behavior_regression");
    expect(regressions.length).toBe(1);
    const meta = regressions[0]!.metadata;
    expect(meta["previousVersion"]).toBe("v1");
    expect(meta["newVersion"]).toBe("v2");
    const drifts = meta["drifts"] as Array<{ span: string; type: string }>;
    expect(drifts.find((d) => d.span === "tool.search")?.type).toBe("missing");
    expect(drifts.find((d) => d.span === "tool.vector")?.type).toBe("new");
  });

  it("skips comparison if the current version already has a baseline stored", async () => {
    const data = stubData();
    // current version already baselined → nothing to compare against.
    data.baselines.set("org-a::agent-a::v2", {
      orgId: "org-a",
      agentId: "agent-a",
      agentVersion: "v2",
      sampleSize: 500,
      spanStructure: { "llm.chat": 1.0 },
    });
    const emitter = spyEmitter();
    let now = 1_700_000_000_000;
    const h = new RegressionHandler({
      data,
      emitter,
      minSampleSize: 30,
      windowMs: 60 * 60_000,
      bucketMs: 60_000,
      now: () => now,
    });
    for (let i = 0; i < 40; i++) {
      now += 60_000;
      const trace = makeTrace({
        id: `t-${i}`,
        metadata: { "agent.version": "v2" },
        spans: [makeSpan({ name: "different", traceId: `t-${i}` })],
      });
      await h.onTraceClose(makeCloseObs({ trace, traceId: trace.id, observedMs: now }));
    }
    expect(emitter.events).toHaveLength(0);
  });

  it("dedupes identical regressions in the dedupe window", async () => {
    const data = stubData();
    data.baselines.set("org-a::agent-a::__previous__", {
      orgId: "org-a",
      agentId: "agent-a",
      agentVersion: "v1",
      sampleSize: 200,
      spanStructure: { "llm.chat": 1.0, "tool.search": 0.9 },
    });
    const emitter = spyEmitter();
    let now = 1_700_000_000_000;
    const h = new RegressionHandler({
      data,
      emitter,
      minSampleSize: 30,
      windowMs: 60 * 60_000,
      bucketMs: 60_000,
      dedupeWindowMs: 60 * 60_000,
      now: () => now,
    });
    for (let i = 0; i < 80; i++) {
      now += 60_000;
      const trace = makeTrace({
        id: `t-${i}`,
        metadata: { "agent.version": "v2" },
        spans: [makeSpan({ name: "llm.chat", traceId: `t-${i}` })],
      });
      await h.onTraceClose(makeCloseObs({ trace, traceId: trace.id, observedMs: now }));
    }
    // Only one alert despite sustained drift.
    expect(emitter.events.length).toBe(1);
  });
});
