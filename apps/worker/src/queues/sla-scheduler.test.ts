import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQueueAdd = vi.fn();

vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation((_name: string, _processor: unknown, _opts: unknown) => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
  Queue: vi.fn().mockImplementation((_name: string, _opts: unknown) => ({
    add: mockQueueAdd,
    close: vi.fn(),
  })),
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

const mockGetAllAgentConfigs = vi.fn();

vi.mock("@foxhound/db", () => ({
  getAllAgentConfigs: (...args: unknown[]) => mockGetAllAgentConfigs(...args),
}));

import { Worker } from "bullmq";

describe("sla-scheduler", () => {
  let capturedProcessor: (job: unknown) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(Worker).mockImplementation(
      (_name: string, processor: unknown, _opts: unknown) => {
        capturedProcessor = processor as (job: unknown) => Promise<void>;
        return { on: vi.fn(), close: vi.fn() } as unknown as ReturnType<typeof Worker>;
      },
    );
  });

  it("starts the worker with concurrency 1", async () => {
    const { startSlaSchedulerWorker } = await import("./sla-scheduler.js");
    startSlaSchedulerWorker({ host: "localhost", port: 6379 });
    expect(Worker).toHaveBeenCalledWith(
      "sla-scheduler",
      expect.any(Function),
      expect.objectContaining({ concurrency: 1 }),
    );
  });

  it("processor enqueues SLA check jobs for each config", async () => {
    const { startSlaSchedulerWorker } = await import("./sla-scheduler.js");
    startSlaSchedulerWorker({ host: "localhost", port: 6379 });

    mockGetAllAgentConfigs.mockResolvedValue([
      {
        id: "cfg_1",
        orgId: "org_1",
        agentId: "agent_1",
        maxDurationMs: 5000,
        minSuccessRate: "0.99",
        evaluationWindowMs: 86400000,
        minSampleSize: 50,
      },
      {
        id: "cfg_2",
        orgId: "org_2",
        agentId: "agent_2",
        maxDurationMs: 3000,
        minSuccessRate: null,
        evaluationWindowMs: 3600000,
        minSampleSize: 10,
      },
    ]);
    mockQueueAdd.mockResolvedValue(undefined);

    await capturedProcessor({});

    expect(mockGetAllAgentConfigs).toHaveBeenCalled();
    expect(mockQueueAdd).toHaveBeenCalledTimes(2);

    expect(mockQueueAdd).toHaveBeenCalledWith(
      "sla-check",
      expect.objectContaining({
        configId: "cfg_1",
        orgId: "org_1",
        agentId: "agent_1",
        maxDurationMs: 5000,
      }),
      expect.objectContaining({ attempts: 3 }),
    );

    expect(mockQueueAdd).toHaveBeenCalledWith(
      "sla-check",
      expect.objectContaining({
        configId: "cfg_2",
        orgId: "org_2",
        agentId: "agent_2",
        maxDurationMs: 3000,
      }),
      expect.objectContaining({ attempts: 3 }),
    );
  });
});
