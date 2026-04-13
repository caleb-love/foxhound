import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock external dependencies BEFORE importing the module under test
// ---------------------------------------------------------------------------

const mockWorkerOn = vi.fn();
const mockWorkerClose = vi.fn();
const mockQueueAdd = vi.fn().mockResolvedValue({});
const mockQueueClose = vi.fn();

vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation((_name: string, _processor: unknown, _opts: unknown) => ({
    on: mockWorkerOn,
    close: mockWorkerClose,
  })),
  Queue: vi.fn().mockImplementation((_name: string, _opts: unknown) => ({
    add: mockQueueAdd,
    close: mockQueueClose,
  })),
}));

vi.mock("@foxhound/db", () => ({
  getTraceWithSpans: vi.fn(),
  updateEvaluatorRunStatus: vi.fn().mockResolvedValue(undefined),
  createScore: vi.fn(),
  isLlmEvaluationEnabled: vi.fn(),
}));

vi.mock("@foxhound/db/internal", () => ({
  getEvaluatorRun: vi.fn(),
  getEvaluatorById: vi.fn(),
}));

vi.mock("../logger.js", () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { Worker, Queue } from "bullmq";
import * as db from "@foxhound/db";
import * as dbInternal from "@foxhound/db/internal";
import {
  startEvaluatorWorker,
  createEvaluatorQueue,
  EVALUATOR_QUEUE_NAME,
  EVALUATOR_DLQ_NAME,
} from "./evaluator.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the processor function captured by the Worker mock for a given queue name. */
function getProcessorForQueue(queueName: string): (job: unknown) => Promise<void> {
  const calls = vi.mocked(Worker).mock.calls;
  const match = calls.find(([name]) => name === queueName);
  if (!match) {
    throw new Error(`No Worker instantiated for queue "${queueName}"`);
  }
  return match[1] as (job: unknown) => Promise<void>;
}

function fakeJob(data: Record<string, unknown>) {
  return { data, id: "job_1", attemptsMade: 0 };
}

// Fixture helpers
const RUN_ID = "run_abc";
const EVALUATOR_ID = "eval_xyz";
const ORG_ID = "org_1";
const TRACE_ID = "trace_99";

function stubHappyPath() {
  // Ensure LLM provider API keys are available for tests
  process.env["OPENAI_API_KEY"] = "test-openai-key";

  vi.mocked(dbInternal.getEvaluatorRun).mockResolvedValue({
    id: RUN_ID,
    evaluatorId: EVALUATOR_ID,
    traceId: TRACE_ID,
    status: "pending",
  } as never);

  vi.mocked(dbInternal.getEvaluatorById).mockResolvedValue({
    id: EVALUATOR_ID,
    orgId: ORG_ID,
    name: "Helpfulness",
    promptTemplate: "Rate this output: {{output}}",
    model: "openai:gpt-4o",
    scoringType: "numeric",
    labels: null,
  } as never);

  vi.mocked(db.isLlmEvaluationEnabled).mockResolvedValue(true);

  vi.mocked(db.getTraceWithSpans).mockResolvedValue({
    spans: [
      {
        name: "root",
        kind: "SERVER",
        attributes: {
          input: "Hello",
          output: [{ role: "assistant", content: "Hi there" }],
          api_key: "secret-val",
        },
        events: [],
      },
    ],
    metadata: { user: "alice" },
  } as never);

  vi.mocked(db.createScore).mockResolvedValue({ id: "scr_new" } as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createEvaluatorQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a Queue with the correct name", () => {
    const conn = { host: "localhost", port: 6379 };
    const queue = createEvaluatorQueue(conn);

    expect(Queue).toHaveBeenCalledWith(EVALUATOR_QUEUE_NAME, { connection: conn });
    expect(queue).toBeDefined();
  });
});

describe("startEvaluatorWorker", () => {
  const conn = { host: "localhost", port: 6379 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkerOn.mockReset();
  });

  it("creates main Worker with correct concurrency and rate limiter", () => {
    startEvaluatorWorker(conn);

    const mainWorkerCall = vi
      .mocked(Worker)
      .mock.calls.find(([name]) => name === EVALUATOR_QUEUE_NAME);
    expect(mainWorkerCall).toBeDefined();

    const opts = mainWorkerCall![2] as unknown as Record<string, unknown>;
    expect(opts.concurrency).toBe(10);
    expect(opts.limiter).toEqual({ max: 20, duration: 60_000 });
    expect(opts.connection).toEqual(conn);
  });

  it("creates a DLQ queue and DLQ worker", () => {
    startEvaluatorWorker(conn);

    // DLQ queue created
    expect(Queue).toHaveBeenCalledWith(EVALUATOR_DLQ_NAME, { connection: conn });

    // DLQ worker created with concurrency 5
    const dlqWorkerCall = vi
      .mocked(Worker)
      .mock.calls.find(([name]) => name === EVALUATOR_DLQ_NAME);
    expect(dlqWorkerCall).toBeDefined();
    const dlqOpts = dlqWorkerCall![2] as unknown as Record<string, unknown>;
    expect(dlqOpts.concurrency).toBe(5);
  });

  it("registers event listeners on both workers", () => {
    startEvaluatorWorker(conn);

    // Worker.on is called for completed, failed on the main worker
    // and failed on the DLQ worker — at minimum 3 calls across both mocked workers
    // Since all mock Workers share the same `on` mock, count total calls
    const eventNames = mockWorkerOn.mock.calls.map(([eventName]) => eventName as string);
    expect(eventNames).toContain("completed");
    expect(eventNames).toContain("failed");
  });

  it("returns the main worker instance", () => {
    const worker = startEvaluatorWorker(conn);
    expect(worker).toBeDefined();
    expect("on" in worker).toBe(true);
  });
});

describe("processEvaluatorJob (via processor)", () => {
  const conn = { host: "localhost", port: 6379 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkerOn.mockReset();
  });

  it("throws when evaluator run is not found", async () => {
    startEvaluatorWorker(conn);
    const processor = getProcessorForQueue(EVALUATOR_QUEUE_NAME);

    vi.mocked(dbInternal.getEvaluatorRun).mockResolvedValue(null as never);

    await expect(processor(fakeJob({ runId: RUN_ID }))).rejects.toThrow(
      `Evaluator run ${RUN_ID} not found`,
    );
  });

  it("throws when evaluator is not found", async () => {
    startEvaluatorWorker(conn);
    const processor = getProcessorForQueue(EVALUATOR_QUEUE_NAME);

    vi.mocked(dbInternal.getEvaluatorRun).mockResolvedValue({
      id: RUN_ID,
      evaluatorId: EVALUATOR_ID,
      traceId: TRACE_ID,
      status: "pending",
    } as never);
    vi.mocked(dbInternal.getEvaluatorById).mockResolvedValue(null as never);

    await expect(processor(fakeJob({ runId: RUN_ID }))).rejects.toThrow(
      `Evaluator ${EVALUATOR_ID} not found`,
    );
  });

  it("marks run as failed when LLM evaluation is not enabled (consent gate)", async () => {
    startEvaluatorWorker(conn);
    const processor = getProcessorForQueue(EVALUATOR_QUEUE_NAME);

    vi.mocked(dbInternal.getEvaluatorRun).mockResolvedValue({
      id: RUN_ID,
      evaluatorId: EVALUATOR_ID,
      traceId: TRACE_ID,
      status: "pending",
    } as never);
    vi.mocked(dbInternal.getEvaluatorById).mockResolvedValue({
      id: EVALUATOR_ID,
      orgId: ORG_ID,
    } as never);
    vi.mocked(db.isLlmEvaluationEnabled).mockResolvedValue(false);

    // Should NOT throw — consent failures are terminal, not retriable
    await processor(fakeJob({ runId: RUN_ID }));

    expect(db.updateEvaluatorRunStatus).toHaveBeenCalledWith(RUN_ID, ORG_ID, "failed", {
      error: "LLM evaluation is not enabled for this organization",
    });
  });

  it("throws when trace is not found", async () => {
    startEvaluatorWorker(conn);
    const processor = getProcessorForQueue(EVALUATOR_QUEUE_NAME);

    vi.mocked(dbInternal.getEvaluatorRun).mockResolvedValue({
      id: RUN_ID,
      evaluatorId: EVALUATOR_ID,
      traceId: TRACE_ID,
      status: "pending",
    } as never);
    vi.mocked(dbInternal.getEvaluatorById).mockResolvedValue({
      id: EVALUATOR_ID,
      orgId: ORG_ID,
      promptTemplate: "{{output}}",
      model: "gpt-4o",
      scoringType: "numeric",
      labels: null,
    } as never);
    vi.mocked(db.isLlmEvaluationEnabled).mockResolvedValue(true);
    vi.mocked(db.getTraceWithSpans).mockResolvedValue(null as never);

    await expect(processor(fakeJob({ runId: RUN_ID }))).rejects.toThrow(
      `Trace ${TRACE_ID} not found`,
    );

    // Should have been marked as running before the trace lookup failed
    expect(db.updateEvaluatorRunStatus).toHaveBeenCalledWith(RUN_ID, ORG_ID, "running");
  });

  it("succeeds end-to-end: fetches data, calls LLM, creates score", async () => {
    startEvaluatorWorker(conn);
    const processor = getProcessorForQueue(EVALUATOR_QUEUE_NAME);

    stubHappyPath();

    // Mock global fetch for the LLM API call
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"score": 0.85}' } }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    // Stub crypto.randomUUID used for score ID
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-uuid" });

    await processor(fakeJob({ runId: RUN_ID }));

    // 1. Marked as running
    expect(db.updateEvaluatorRunStatus).toHaveBeenCalledWith(RUN_ID, ORG_ID, "running");

    // 2. Fetched trace with correct org scoping
    expect(db.getTraceWithSpans).toHaveBeenCalledWith(TRACE_ID, ORG_ID);

    // 3. Called the LLM — verify fetch was called to OpenAI endpoint
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, fetchOpts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(fetchOpts.method).toBe("POST");

    // 4. Created score with correct value
    expect(db.createScore).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: ORG_ID,
        traceId: TRACE_ID,
        name: "Helpfulness",
        value: 0.85,
        source: "llm_judge",
      }),
    );

    // 5. Marked as completed with score reference
    expect(db.updateEvaluatorRunStatus).toHaveBeenCalledWith(RUN_ID, ORG_ID, "completed", {
      scoreId: "scr_new",
    });

    vi.unstubAllGlobals();
  });

  it("redacts sensitive attributes before sending to LLM", async () => {
    startEvaluatorWorker(conn);
    const processor = getProcessorForQueue(EVALUATOR_QUEUE_NAME);

    stubHappyPath();

    // Override evaluator to use a template that exposes spans
    vi.mocked(dbInternal.getEvaluatorById).mockResolvedValue({
      id: EVALUATOR_ID,
      orgId: ORG_ID,
      name: "Helpfulness",
      promptTemplate: "Review these spans: {{spans}}",
      model: "openai:gpt-4o",
      scoringType: "numeric",
      labels: null,
    } as never);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"score": 0.9}' } }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-uuid" });

    await processor(fakeJob({ runId: RUN_ID }));

    // Verify the body sent to the LLM contains [REDACTED] for api_key
    const [, fetchOpts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(fetchOpts.body as string) as {
      messages: Array<{ role?: string; content: string }>;
    };
    body.messages.find((m) => m.role !== undefined);
    const allContent = body.messages.map((m) => m.content).join(" ");

    expect(allContent).toContain("[REDACTED]");
    expect(allContent).not.toContain("secret-val");

    vi.unstubAllGlobals();
  });

  it("handles LLM API error gracefully by throwing", async () => {
    startEvaluatorWorker(conn);
    const processor = getProcessorForQueue(EVALUATOR_QUEUE_NAME);

    stubHappyPath();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue("Rate limit exceeded"),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(processor(fakeJob({ runId: RUN_ID }))).rejects.toThrow(
      /LLM API error \(openai\): 429/,
    );

    vi.unstubAllGlobals();
  });

  it("handles non-JSON LLM response by throwing", async () => {
    startEvaluatorWorker(conn);
    const processor = getProcessorForQueue(EVALUATOR_QUEUE_NAME);

    stubHappyPath();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: "I cannot evaluate this." } }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(processor(fakeJob({ runId: RUN_ID }))).rejects.toThrow(
      /LLM returned non-JSON response/,
    );

    vi.unstubAllGlobals();
  });

  it("handles invalid score value from LLM", async () => {
    startEvaluatorWorker(conn);
    const processor = getProcessorForQueue(EVALUATOR_QUEUE_NAME);

    stubHappyPath();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"score": 1.5}' } }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(processor(fakeJob({ runId: RUN_ID }))).rejects.toThrow(
      /LLM returned invalid score/,
    );

    vi.unstubAllGlobals();
  });

  it("supports Anthropic provider via model spec prefix", async () => {
    startEvaluatorWorker(conn);
    const processor = getProcessorForQueue(EVALUATOR_QUEUE_NAME);

    stubHappyPath();

    // Override to use Anthropic provider
    vi.mocked(dbInternal.getEvaluatorById).mockResolvedValue({
      id: EVALUATOR_ID,
      orgId: ORG_ID,
      name: "Helpfulness",
      promptTemplate: "Rate this output: {{output}}",
      model: "anthropic:claude-sonnet-4-20250514",
      scoringType: "numeric",
      labels: null,
    } as never);

    process.env["ANTHROPIC_API_KEY"] = "test-key";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: '{"score": 0.75}' }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-uuid" });

    await processor(fakeJob({ runId: RUN_ID }));

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe("https://api.anthropic.com/v1/messages");

    expect(db.createScore).toHaveBeenCalledWith(expect.objectContaining({ value: 0.75 }));

    delete process.env["ANTHROPIC_API_KEY"];
    vi.unstubAllGlobals();
  });

  it("supports categorical scoring type", async () => {
    startEvaluatorWorker(conn);
    const processor = getProcessorForQueue(EVALUATOR_QUEUE_NAME);

    stubHappyPath();

    // Override to use categorical scoring
    vi.mocked(dbInternal.getEvaluatorById).mockResolvedValue({
      id: EVALUATOR_ID,
      orgId: ORG_ID,
      name: "Tone",
      promptTemplate: "Classify tone: {{output}}",
      model: "openai:gpt-4o",
      scoringType: "categorical",
      labels: ["positive", "negative", "neutral"],
    } as never);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"label": "positive"}' } }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-uuid" });

    await processor(fakeJob({ runId: RUN_ID }));

    expect(db.createScore).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "positive",
        name: "Tone",
        source: "llm_judge",
      }),
    );

    vi.unstubAllGlobals();
  });
});

describe("processDlqJob (via DLQ processor)", () => {
  const conn = { host: "localhost", port: 6379 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkerOn.mockReset();
  });

  it("marks run as permanently failed with error message", async () => {
    startEvaluatorWorker(conn);
    const dlqProcessor = getProcessorForQueue(EVALUATOR_DLQ_NAME);

    vi.mocked(dbInternal.getEvaluatorRun).mockResolvedValue({
      id: RUN_ID,
      evaluatorId: EVALUATOR_ID,
    } as never);
    vi.mocked(dbInternal.getEvaluatorById).mockResolvedValue({
      id: EVALUATOR_ID,
      orgId: ORG_ID,
    } as never);

    await dlqProcessor(fakeJob({ runId: RUN_ID, originalError: "timeout" }));

    expect(db.updateEvaluatorRunStatus).toHaveBeenCalledWith(RUN_ID, ORG_ID, "failed", {
      error: expect.stringContaining("Permanently failed after 3 attempts"),
    });
  });

  it("handles missing orgId gracefully without throwing", async () => {
    startEvaluatorWorker(conn);
    const dlqProcessor = getProcessorForQueue(EVALUATOR_DLQ_NAME);

    vi.mocked(dbInternal.getEvaluatorRun).mockResolvedValue(null as never);

    // Should not throw — logs and returns
    await dlqProcessor(fakeJob({ runId: RUN_ID }));

    expect(db.updateEvaluatorRunStatus).not.toHaveBeenCalled();
  });
});

describe("sanitizeErrorForStorage (via LLM error path)", () => {
  const conn = { host: "localhost", port: 6379 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkerOn.mockReset();
  });

  it("truncates long error messages from LLM responses", async () => {
    startEvaluatorWorker(conn);
    const processor = getProcessorForQueue(EVALUATOR_QUEUE_NAME);

    stubHappyPath();

    const longError = "x".repeat(1000);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue(longError),
    });
    vi.stubGlobal("fetch", mockFetch);

    const errorPromise = processor(fakeJob({ runId: RUN_ID }));
    await expect(errorPromise).rejects.toThrow(/\.\.\. \[truncated\]/);

    // Verify the thrown error message is bounded
    try {
      await processor(fakeJob({ runId: RUN_ID }));
    } catch (err: unknown) {
      const msg = (err as Error).message;
      // "LLM API error (openai): 500 " + 500 chars + "... [truncated]"
      // Total should be well under 600 chars for the sanitized portion
      expect(msg.length).toBeLessThan(600);
    }

    vi.unstubAllGlobals();
  });

  it("strips non-printable characters from error messages", async () => {
    startEvaluatorWorker(conn);
    const processor = getProcessorForQueue(EVALUATOR_QUEUE_NAME);

    stubHappyPath();

    const dirtyError = "Error\x00with\x01control\x02chars";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue(dirtyError),
    });
    vi.stubGlobal("fetch", mockFetch);

    try {
      await processor(fakeJob({ runId: RUN_ID }));
    } catch (err: unknown) {
      const msg = (err as Error).message;
      expect(msg.includes(String.fromCharCode(0))).toBe(false);
      expect(msg.includes(String.fromCharCode(31))).toBe(false);
      expect(msg).toContain("Errorwithcontrolchars");
    }

    vi.unstubAllGlobals();
  });
});

describe("template rendering (via processor)", () => {
  const conn = { host: "localhost", port: 6379 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkerOn.mockReset();
  });

  it("renders template with trace context and leaves unknown keys as-is", async () => {
    startEvaluatorWorker(conn);
    const processor = getProcessorForQueue(EVALUATOR_QUEUE_NAME);

    stubHappyPath();

    // Template with a known key and an unknown key
    vi.mocked(dbInternal.getEvaluatorById).mockResolvedValue({
      id: EVALUATOR_ID,
      orgId: ORG_ID,
      name: "Helpfulness",
      promptTemplate: "Input: {{input}}, Unknown: {{foobar}}, Spans: {{spanCount}}",
      model: "openai:gpt-4o",
      scoringType: "numeric",
      labels: null,
    } as never);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"score": 0.5}' } }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-uuid" });

    await processor(fakeJob({ runId: RUN_ID }));

    // Verify the rendered prompt sent to the LLM
    const [, fetchOpts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(fetchOpts.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    const userMsg = body.messages.find((m) => m.role === "user");

    // Input should be "Hello" (from the first span's input attribute)
    expect(userMsg?.content).toContain("Input: Hello");
    // Unknown key should remain as mustache template
    expect(userMsg?.content).toContain("Unknown: {{foobar}}");
    // spanCount should be "1"
    expect(userMsg?.content).toContain("Spans: 1");

    vi.unstubAllGlobals();
  });
});
