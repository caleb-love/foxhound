import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";

vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation((_name: string, _processor: unknown, _opts: unknown) => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
  Queue: vi.fn().mockImplementation((_name: string, _opts: unknown) => ({
    add: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock("@foxhound/db", () => ({
  getExperiment: vi.fn(),
  listExperimentRuns: vi.fn(),
  getDatasetItem: vi.fn(),
  updateExperimentRun: vi.fn(),
  updateExperimentStatus: vi.fn(),
  createScore: vi.fn(),
  listEvaluators: vi.fn(),
  getExperimentRun: vi.fn(),
  isLlmEvaluationEnabled: vi.fn(),
}));

vi.mock("../logger.js", () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

import { Worker, Queue } from "bullmq";
import * as db from "@foxhound/db";
import {
  createExperimentQueue,
  startExperimentWorker,
  EXPERIMENT_QUEUE_NAME,
  type ExperimentJobData,
} from "./experiment.js";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function makeJob(overrides: Partial<ExperimentJobData> = {}): Job<ExperimentJobData> {
  return {
    data: {
      experimentId: "exp_1",
      orgId: "org_1",
      ...overrides,
    },
    id: "job_1",
  } as unknown as Job<ExperimentJobData>;
}

function mockFetchSuccess(content = "Hello from LLM", totalTokens = 100): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content } }],
          usage: { total_tokens: totalTokens },
        }),
    }),
  );
}

function mockFetchFailure(status = 500, body = "Internal Server Error"): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      text: () => Promise.resolve(body),
    }),
  );
}

/** Extract the processor callback passed to the Worker constructor. */
function captureProcessor(): (job: Job<ExperimentJobData>) => Promise<void> {
  const workerCtor = vi.mocked(Worker);
  const calls = workerCtor.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  // The processor is the second argument to `new Worker(name, processor, opts)`
  return calls[calls.length - 1][1] as (job: Job<ExperimentJobData>) => Promise<void>;
}

// --------------------------------------------------------------------------
// Setup
// --------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  process.env["OPENAI_API_KEY"] = "sk-test-key";
});

// --------------------------------------------------------------------------
// Queue creation
// --------------------------------------------------------------------------

describe("createExperimentQueue", () => {
  it("creates a BullMQ Queue with the correct name", () => {
    const connection = { host: "localhost", port: 6379 };

    const queue = createExperimentQueue(connection);

    expect(Queue).toHaveBeenCalledWith(EXPERIMENT_QUEUE_NAME, { connection });
    expect(queue).toBeDefined();
  });
});

// --------------------------------------------------------------------------
// Worker creation
// --------------------------------------------------------------------------

describe("startExperimentWorker", () => {
  it("creates a Worker with concurrency 5", () => {
    const connection = { host: "localhost", port: 6379 };

    const worker = startExperimentWorker(connection);

    expect(Worker).toHaveBeenCalledWith(
      EXPERIMENT_QUEUE_NAME,
      expect.any(Function),
      expect.objectContaining({ connection, concurrency: 5 }),
    );
    expect(worker).toBeDefined();
  });
});

// --------------------------------------------------------------------------
// Processor behaviour
// --------------------------------------------------------------------------

describe("processExperimentJob (via processor)", () => {
  /** Boot the worker so we can capture the processor. */
  function setupProcessor(): (job: Job<ExperimentJobData>) => Promise<void> {
    startExperimentWorker({ host: "localhost", port: 6379 });
    return captureProcessor();
  }

  beforeEach(() => {
    // Default happy-path mocks
    vi.mocked(db.isLlmEvaluationEnabled).mockResolvedValue(true);

    vi.mocked(db.getExperiment).mockResolvedValue({
      id: "exp_1",
      orgId: "org_1",
      name: "Test Experiment",
      datasetId: "ds_1",
      config: { model: "gpt-4o", promptTemplate: "{{input}}", temperature: 0 },
      status: "pending",
      createdAt: new Date(),
      completedAt: null,
    } as Awaited<ReturnType<typeof db.getExperiment>>);

    vi.mocked(db.listExperimentRuns).mockResolvedValue([
      { id: "run_1", datasetItemId: "item_1" },
      { id: "run_2", datasetItemId: "item_2" },
    ] as Awaited<ReturnType<typeof db.listExperimentRuns>>);

    vi.mocked(db.getDatasetItem).mockResolvedValue({
      id: "item_1",
      orgId: "org_1",
      datasetId: "ds_1",
      input: { input: "What is 2+2?" },
      expectedOutput: null,
      sourceTraceId: "trc_1",
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Awaited<ReturnType<typeof db.getDatasetItem>>);

    vi.mocked(db.updateExperimentRun).mockResolvedValue(
      undefined as unknown as Awaited<ReturnType<typeof db.updateExperimentRun>>,
    );
    vi.mocked(db.updateExperimentStatus).mockResolvedValue(
      undefined as unknown as Awaited<ReturnType<typeof db.updateExperimentStatus>>,
    );
    vi.mocked(db.listEvaluators).mockResolvedValue([]);
    vi.mocked(db.getExperimentRun).mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof db.getExperimentRun>>,
    );
    vi.mocked(db.createScore).mockResolvedValue(
      undefined as unknown as Awaited<ReturnType<typeof db.createScore>>,
    );
  });

  it("fails immediately when org consent is disabled", async () => {
    vi.mocked(db.isLlmEvaluationEnabled).mockResolvedValue(false);
    const processor = setupProcessor();

    await expect(processor(makeJob())).rejects.toThrow("LLM evaluation is not enabled");
    expect(db.updateExperimentStatus).toHaveBeenCalledWith("exp_1", "org_1", "failed");
    expect(db.getExperiment).not.toHaveBeenCalled();
  });

  // 1. Status lifecycle: running -> completed
  it("sets experiment status to 'running' then 'completed'", async () => {
    mockFetchSuccess();
    const processor = setupProcessor();

    await processor(makeJob());

    const statusCalls = vi.mocked(db.updateExperimentStatus).mock.calls;
    expect(statusCalls[0]).toEqual(["exp_1", "org_1", "running"]);
    expect(statusCalls[statusCalls.length - 1]).toEqual(["exp_1", "org_1", "completed"]);
  });

  // 2. Missing experiment throws
  it("throws when experiment is not found", async () => {
    vi.mocked(db.getExperiment).mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof db.getExperiment>>,
    );
    const processor = setupProcessor();

    await expect(processor(makeJob())).rejects.toThrow("Experiment exp_1 not found");
  });

  // 3. LLM API error on one run continues others
  it("handles LLM API error per-run and continues remaining runs", async () => {
    // First fetch call fails, second succeeds
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server Error"),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: "Result" } }],
            usage: { total_tokens: 50 },
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const processor = setupProcessor();
    await processor(makeJob());

    // First run should get an error output
    const firstRunUpdate = vi
      .mocked(db.updateExperimentRun)
      .mock.calls.find((call) => call[0] === "run_1");
    expect(firstRunUpdate).toBeDefined();
    expect((firstRunUpdate![2] as Record<string, unknown>).output).toEqual(
      expect.objectContaining({ error: expect.stringContaining("LLM API error: 500") }),
    );

    // Second run should get a successful output
    const secondRunUpdate = vi.mocked(db.updateExperimentRun).mock.calls.find((call) => {
      if (call[0] !== "run_2") return false;
      const output = (call[2] as { output?: Record<string, unknown> }).output;
      return !Object.prototype.hasOwnProperty.call(output ?? {}, "error");
    });
    expect(secondRunUpdate).toBeDefined();

    // Status should still be "completed" (not all runs failed)
    const lastStatusCall = vi.mocked(db.updateExperimentStatus).mock.calls.at(-1);
    expect(lastStatusCall).toEqual(["exp_1", "org_1", "completed"]);
  });

  // 4. All runs fail -> status "failed"
  it("sets status to 'failed' when all runs fail", async () => {
    mockFetchFailure(429, "Rate limited");
    const processor = setupProcessor();

    await processor(makeJob());

    const lastStatusCall = vi.mocked(db.updateExperimentStatus).mock.calls.at(-1);
    expect(lastStatusCall).toEqual(["exp_1", "org_1", "failed"]);
  });

  it("does not re-execute runs that already have successful output", async () => {
    vi.mocked(db.listExperimentRuns).mockResolvedValue([
      {
        id: "run_1",
        datasetItemId: "item_1",
        output: { content: "already-complete" },
      },
    ] as unknown as Awaited<ReturnType<typeof db.listExperimentRuns>>);

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const processor = setupProcessor();
    await processor(makeJob());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.updateExperimentRun).not.toHaveBeenCalled();
  });

  // 5. Auto-scoring when evaluators exist
  it("auto-scores runs when enabled evaluators exist", async () => {
    mockFetchSuccess("Answer: 4");

    vi.mocked(db.listEvaluators).mockResolvedValue([
      {
        id: "eval_1",
        orgId: "org_1",
        name: "correctness",
        promptTemplate: "Rate the output: {{output}} given input: {{input}}",
        model: "gpt-4o",
        scoringType: "numeric",
        labels: null,
        enabled: true,
        createdAt: new Date(),
      },
    ] as Awaited<ReturnType<typeof db.listEvaluators>>);

    vi.mocked(db.getExperimentRun).mockResolvedValue({
      id: "run_1",
      experimentId: "exp_1",
      datasetItemId: "item_1",
      output: { content: "Answer: 4" },
      latencyMs: 120,
      tokenCount: 50,
      cost: 0.001,
      createdAt: new Date(),
    } as Awaited<ReturnType<typeof db.getExperimentRun>>);

    // The evaluator invocation also calls fetch (OpenAI), which is already
    // mocked to return success. The numeric scoring regex extracts a number.
    // Override fetch to return a score-like response for evaluator calls.
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "0.95" } }],
          usage: { total_tokens: 50 },
        }),
    });
    vi.stubGlobal("fetch", fetchImpl);

    const processor = setupProcessor();
    await processor(makeJob());

    expect(db.createScore).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org_1",
        name: "correctness",
        source: "llm_judge",
        value: 0.95,
        comment: expect.stringContaining("experiment:exp_1"),
      }),
    );
  });

  it("does not auto-score runs that were already completed before this worker pass", async () => {
    vi.mocked(db.listExperimentRuns).mockResolvedValue([
      {
        id: "run_1",
        datasetItemId: "item_1",
        output: { content: "already-complete" },
      },
    ] as unknown as Awaited<ReturnType<typeof db.listExperimentRuns>>);

    vi.mocked(db.listEvaluators).mockResolvedValue([
      {
        id: "eval_1",
        orgId: "org_1",
        name: "correctness",
        promptTemplate: "Rate: {{output}}",
        model: "gpt-4o",
        scoringType: "numeric",
        labels: null,
        enabled: true,
        createdAt: new Date(),
      },
    ] as Awaited<ReturnType<typeof db.listEvaluators>>);

    vi.mocked(db.getExperimentRun).mockResolvedValue({
      id: "run_1",
      experimentId: "exp_1",
      datasetItemId: "item_1",
      output: { content: "already-complete" },
      latencyMs: 100,
      tokenCount: 10,
      cost: 0.001,
      createdAt: new Date(),
    } as Awaited<ReturnType<typeof db.getExperimentRun>>);

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const processor = setupProcessor();
    await processor(makeJob());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.createScore).not.toHaveBeenCalled();
  });

  // 6. Skips scoring for runs with error output
  it("skips auto-scoring for runs that have error output", async () => {
    mockFetchFailure(500, "Server Error");

    vi.mocked(db.listEvaluators).mockResolvedValue([
      {
        id: "eval_1",
        orgId: "org_1",
        name: "correctness",
        promptTemplate: "Rate: {{output}}",
        model: "gpt-4o",
        scoringType: "numeric",
        labels: null,
        enabled: true,
        createdAt: new Date(),
      },
    ] as Awaited<ReturnType<typeof db.listEvaluators>>);

    // getExperimentRun returns a run with an error output
    vi.mocked(db.getExperimentRun).mockResolvedValue({
      id: "run_1",
      experimentId: "exp_1",
      datasetItemId: "item_1",
      output: { error: "LLM API error: 500" },
      latencyMs: null,
      tokenCount: null,
      cost: null,
      createdAt: new Date(),
    } as Awaited<ReturnType<typeof db.getExperimentRun>>);

    const processor = setupProcessor();
    await processor(makeJob());

    // createScore should NOT have been called because all runs have error output
    expect(db.createScore).not.toHaveBeenCalled();
  });

  // 7. Zero runs -> completed (not failed)
  it("sets status to 'completed' when there are zero runs", async () => {
    vi.mocked(db.listExperimentRuns).mockResolvedValue([]);
    const processor = setupProcessor();

    await processor(makeJob());

    const lastStatusCall = vi.mocked(db.updateExperimentStatus).mock.calls.at(-1);
    // runs.length === 0 means the condition `runs.length > 0 && failedCount === runs.length`
    // evaluates to false, so status is "completed"
    expect(lastStatusCall).toEqual(["exp_1", "org_1", "completed"]);
  });
});
