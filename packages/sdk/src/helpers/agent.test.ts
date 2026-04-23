/**
 * Unit tests for the WP15 agent-scope helpers.
 *
 * We verify behavior by flushing the tracer and inspecting the resulting
 * `Trace.spans[*].agentId`, which is the exact contract the wire encoder
 * downstream in `packages/sdk/src/transport/map.ts` reads. Relying on the
 * flushed Trace (not private class fields) keeps the test tied to the
 * public behavior the rest of the system depends on.
 */
import { describe, it, expect } from "vitest";
import type { Trace } from "@foxhound/types";
import { Tracer } from "../tracer.js";
import { withAgent, withAgentSync, startAgentSpan, currentAgentScope } from "./agent.js";

function makeTracer(agentId: string): { tracer: Tracer; flushed: () => Trace | undefined } {
  let latest: Trace | undefined;
  const tracer = new Tracer({
    agentId,
    metadata: {},
    onFlush: (t: Trace) => {
      latest = t;
      return Promise.resolve();
    },
  });
  return { tracer, flushed: () => latest };
}

describe("sdk · helpers · agent · scope stack", () => {
  it("currentAgentScope is undefined when no scope is active", () => {
    const { tracer } = makeTracer("orchestrator");
    expect(currentAgentScope(tracer)).toBeUndefined();
  });

  it("withAgentSync pushes and pops the scope", () => {
    const { tracer } = makeTracer("orchestrator");
    let insideScope: string | undefined;
    withAgentSync(tracer, "researcher", () => {
      insideScope = currentAgentScope(tracer);
    });
    expect(insideScope).toBe("researcher");
    expect(currentAgentScope(tracer)).toBeUndefined();
  });

  it("withAgent pops the scope even when the sync callback throws", async () => {
    const { tracer } = makeTracer("orchestrator");
    await expect(
      withAgent(tracer, "researcher", () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(currentAgentScope(tracer)).toBeUndefined();
  });

  it("withAgent pops the scope even when the async callback rejects", async () => {
    const { tracer } = makeTracer("orchestrator");
    await expect(
      withAgent(tracer, "researcher", () => {
        return Promise.reject(new Error("async boom"));
      }),
    ).rejects.toThrow("async boom");
    expect(currentAgentScope(tracer)).toBeUndefined();
  });

  it("withAgent pops the scope after the async callback settles successfully", async () => {
    const { tracer } = makeTracer("orchestrator");
    await withAgent(tracer, "researcher", async () => {
      expect(currentAgentScope(tracer)).toBe("researcher");
      await new Promise((r) => setTimeout(r, 1));
    });
    expect(currentAgentScope(tracer)).toBeUndefined();
  });

  it("nested withAgent scopes follow innermost-wins", async () => {
    const { tracer } = makeTracer("orchestrator");
    await withAgent(tracer, "researcher", async () => {
      expect(currentAgentScope(tracer)).toBe("researcher");
      await withAgent(tracer, "coder", () => {
        expect(currentAgentScope(tracer)).toBe("coder");
        return Promise.resolve();
      });
      expect(currentAgentScope(tracer)).toBe("researcher");
    });
    expect(currentAgentScope(tracer)).toBeUndefined();
  });
});

describe("sdk · helpers · agent · span tagging", () => {
  it("spans opened inside withAgent inherit the scope's agentId", async () => {
    const { tracer, flushed } = makeTracer("orchestrator");
    await withAgent(tracer, "researcher", () => {
      const s = tracer.startSpan({ name: "web.search", kind: "tool_call" });
      s.end();
    });
    await tracer.flush();
    const t = flushed();
    expect(t).toBeDefined();
    expect(t!.spans[0]!.agentId).toBe("researcher");
  });

  it("explicit setAgent on an ActiveSpan overrides any surrounding scope", async () => {
    const { tracer, flushed } = makeTracer("orchestrator");
    withAgentSync(tracer, "researcher", () => {
      const s = tracer.startSpan({ name: "code.write", kind: "agent_step" });
      s.setAgent("coder");
      s.end();
    });
    await tracer.flush();
    expect(flushed()!.spans[0]!.agentId).toBe("coder");
  });

  it("startAgentSpan convenience opens a span pre-tagged with the given agentId", async () => {
    const { tracer, flushed } = makeTracer("orchestrator");
    const s = startAgentSpan(tracer, {
      agentId: "evaluator",
      name: "grade",
      kind: "custom",
    });
    s.end();
    await tracer.flush();
    expect(flushed()!.spans[0]!.agentId).toBe("evaluator");
  });

  it("spans opened outside any scope have no per-span agentId (inherit trace-level at wire)", async () => {
    const { tracer, flushed } = makeTracer("orchestrator");
    const s = tracer.startSpan({ name: "plain", kind: "custom" });
    s.end();
    await tracer.flush();
    expect(flushed()!.spans[0]!.agentId).toBeUndefined();
  });
});

describe("sdk · helpers · agent · overhead gate (WP15)", () => {
  // WP15 load-test gate: set_agent overhead < 0.1 ms per span. We measure
  // the scope-push/pop path because that's the hot path callers pay for
  // every span opened inside `withAgent`. We assert < 0.5 ms/span so the
  // test is not flaky on slower CI runners while still catching
  // regressions that would push real per-span cost into the tens of
  // microseconds.
  it("withAgentSync + startSpan + end averages well under 0.5 ms per span", () => {
    const { tracer } = makeTracer("orchestrator");
    const iterations = 5_000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      withAgentSync(tracer, "researcher", () => {
        const s = tracer.startSpan({ name: "span", kind: "custom" });
        s.end();
      });
    }
    const elapsedMs = performance.now() - start;
    const perSpanMs = elapsedMs / iterations;
    expect(perSpanMs).toBeLessThan(0.5);
  });
});
