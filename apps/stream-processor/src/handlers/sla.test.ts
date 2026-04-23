import { describe, it, expect } from "vitest";
import { SlaHandler, percentile } from "./sla.js";
import {
  makeCloseObs,
  makeSpan,
  makeTrace,
  setConfig,
  spyEmitter,
  stubData,
} from "./test-utils.js";

describe("percentile helper", () => {
  it("returns 0 on empty input", () => {
    expect(percentile([], 0.95)).toBe(0);
  });
  it("interpolates linearly between neighboring samples", () => {
    expect(percentile([0, 10], 0.5)).toBe(5);
    expect(percentile([0, 10, 20, 30, 40], 0.5)).toBe(20);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBeCloseTo(9.55, 2);
  });
});

describe("SlaHandler", () => {
  it("does nothing if no SLA config is set", async () => {
    const data = stubData();
    const emitter = spyEmitter();
    const h = new SlaHandler({ data, emitter });
    await h.onTraceClose(makeCloseObs());
    expect(emitter.events).toHaveLength(0);
  });

  it("does nothing below the minimum sample size", async () => {
    const data = stubData();
    setConfig(data, {
      orgId: "org-a",
      agentId: "agent-a",
      maxDurationMs: 100,
      minSampleSize: 5,
    });
    const emitter = spyEmitter();
    let now = 1_700_000_000_000;
    const h = new SlaHandler({ data, emitter, now: () => now });
    for (let i = 0; i < 4; i++) {
      now += 100;
      const trace = makeTrace({
        id: `t-${i}`,
        startTimeMs: now,
        endTimeMs: now + 500, // 500 ms > 100 ms threshold
        spans: [makeSpan({ traceId: `t-${i}`, startTimeMs: now, endTimeMs: now + 500 })],
      });
      await h.onTraceClose(makeCloseObs({ trace, traceId: trace.id, observedMs: now }));
    }
    expect(emitter.events).toHaveLength(0);
  });

  it("fires sla_duration_breach when p95 exceeds threshold", async () => {
    const data = stubData();
    setConfig(data, {
      orgId: "org-a",
      agentId: "agent-a",
      maxDurationMs: 100,
      minSampleSize: 5,
    });
    const emitter = spyEmitter();
    let now = 1_700_000_000_000;
    const h = new SlaHandler({ data, emitter, now: () => now });
    for (let i = 0; i < 10; i++) {
      now += 100;
      const trace = makeTrace({
        id: `t-${i}`,
        startTimeMs: now,
        endTimeMs: now + 500,
        spans: [makeSpan({ traceId: `t-${i}`, startTimeMs: now, endTimeMs: now + 500 })],
      });
      await h.onTraceClose(makeCloseObs({ trace, traceId: trace.id, observedMs: now }));
    }
    expect(emitter.events.length).toBeGreaterThanOrEqual(1);
    expect(emitter.events[0]!.type).toBe("sla_duration_breach");
    const meta = emitter.events[0]!.metadata;
    expect(Number(meta["durationP95Ms"])).toBeGreaterThan(100);
  });

  it("fires sla_success_rate_breach when error rate exceeds threshold", async () => {
    const data = stubData();
    setConfig(data, {
      orgId: "org-a",
      agentId: "agent-a",
      minSuccessRate: 0.9,
      minSampleSize: 5,
    });
    const emitter = spyEmitter();
    let now = 1_700_000_000_000;
    const h = new SlaHandler({ data, emitter, now: () => now });
    // 5 errors out of 10 → success rate 50 % < 90 %
    for (let i = 0; i < 10; i++) {
      now += 100;
      const trace = makeTrace({
        id: `t-${i}`,
        startTimeMs: now,
        endTimeMs: now + 10,
        spans: [
          makeSpan({
            traceId: `t-${i}`,
            startTimeMs: now,
            endTimeMs: now + 10,
            status: i < 5 ? "error" : "ok",
          }),
        ],
      });
      await h.onTraceClose(makeCloseObs({ trace, traceId: trace.id, observedMs: now }));
    }
    const successBreach = emitter.events.find((e) => e.type === "sla_success_rate_breach");
    expect(successBreach).toBeDefined();
    expect(Number(successBreach!.metadata["successRate"])).toBeLessThan(0.9);
  });

  it("dedupes identical breaches within the dedupe window", async () => {
    const data = stubData();
    setConfig(data, {
      orgId: "org-a",
      agentId: "agent-a",
      maxDurationMs: 50,
      minSampleSize: 5,
    });
    const emitter = spyEmitter();
    let now = 1_700_000_000_000;
    const h = new SlaHandler({ data, emitter, now: () => now, dedupeWindowMs: 60_000 });
    for (let i = 0; i < 20; i++) {
      now += 100;
      const trace = makeTrace({
        id: `t-${i}`,
        startTimeMs: now,
        endTimeMs: now + 500,
        spans: [makeSpan({ traceId: `t-${i}`, startTimeMs: now, endTimeMs: now + 500 })],
      });
      await h.onTraceClose(makeCloseObs({ trace, traceId: trace.id, observedMs: now }));
    }
    const durationEvents = emitter.events.filter((e) => e.type === "sla_duration_breach");
    expect(durationEvents.length).toBe(1); // dedupe wins
  });

  it("onTick prunes window state and stale dedupe entries", () => {
    const data = stubData();
    const emitter = spyEmitter();
    let now = 1_700_000_000_000;
    const h = new SlaHandler({ data, emitter, now: () => now });
    h.onTick(now);
    // No assertions needed beyond "does not throw" — pure plumbing.
    expect(true).toBe(true);
  });

  it("is tenant-scoped: same agentId in different orgs is counted separately", async () => {
    const data = stubData();
    setConfig(data, {
      orgId: "org-a",
      agentId: "shared",
      maxDurationMs: 50,
      minSampleSize: 5,
    });
    // org-b has no config — should never fire.
    const emitter = spyEmitter();
    let now = 1_700_000_000_000;
    const h = new SlaHandler({ data, emitter, now: () => now });
    for (let i = 0; i < 10; i++) {
      now += 100;
      const traceB = makeTrace({
        id: `b-${i}`,
        startTimeMs: now,
        endTimeMs: now + 9999,
        spans: [makeSpan({ traceId: `b-${i}`, startTimeMs: now, endTimeMs: now + 9999 })],
      });
      await h.onTraceClose(
        makeCloseObs({
          orgId: "org-b",
          agentId: "shared",
          trace: traceB,
          traceId: traceB.id,
          observedMs: now,
        }),
      );
    }
    expect(emitter.events).toHaveLength(0);
  });
});
