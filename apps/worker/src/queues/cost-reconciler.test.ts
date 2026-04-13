import { describe, it, expect, vi, beforeEach } from "vitest";

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
const mockSumSpanCosts = vi.fn();

vi.mock("@foxhound/db", () => ({
  getAllAgentConfigs: (...args: unknown[]) => mockGetAllAgentConfigs(...args),
  sumSpanCosts: (...args: unknown[]) => mockSumSpanCosts(...args),
}));

vi.mock("@foxhound/types", () => ({
  getBudgetPeriodKey: (_period: string, _now: number) => "2024-01",
  parsePeriodStart: () => 1700000000000,
}));

const mockRedisSet = vi.fn();
const mockRedisExpire = vi.fn();
const mockRedisQuit = vi.fn();

vi.mock("ioredis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    set: mockRedisSet,
    expire: mockRedisExpire,
    quit: mockRedisQuit,
  })),
}));

import { Worker } from "bullmq";

describe("cost-reconciler", () => {
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
    const { startCostReconcilerWorker } = await import("./cost-reconciler.js");
    startCostReconcilerWorker({ host: "localhost", port: 6379 });
    expect(Worker).toHaveBeenCalledWith(
      "cost-reconciler",
      expect.any(Function),
      expect.objectContaining({ concurrency: 1 }),
    );
  });

  it("processor reconciles costs for configs with budgets", async () => {
    const { startCostReconcilerWorker } = await import("./cost-reconciler.js");
    startCostReconcilerWorker({ host: "localhost", port: 6379 });

    mockGetAllAgentConfigs.mockResolvedValue([
      { orgId: "org_1", agentId: "agent_1", costBudgetUsd: "100", budgetPeriod: "monthly" },
      { orgId: "org_2", agentId: "agent_2", costBudgetUsd: "50", budgetPeriod: "weekly" },
    ]);
    mockSumSpanCosts
      .mockResolvedValueOnce({ totalCost: 42.5, totalSpans: 100, unknownCostSpans: 0 })
      .mockResolvedValueOnce({ totalCost: 18.2, totalSpans: 50, unknownCostSpans: 0 });

    await capturedProcessor({});

    expect(mockGetAllAgentConfigs).toHaveBeenCalled();
    expect(mockSumSpanCosts).toHaveBeenCalledTimes(2);
    expect(mockRedisSet).toHaveBeenCalledWith("cost:org_1:agent_1:2024-01", "42.5");
    expect(mockRedisSet).toHaveBeenCalledWith("cost:org_2:agent_2:2024-01", "18.2");
    expect(mockRedisExpire).toHaveBeenCalledTimes(2);
    expect(mockRedisExpire).toHaveBeenCalledWith("cost:org_1:agent_1:2024-01", 35 * 24 * 3600);
  });

  it("processor skips configs without costBudgetUsd", async () => {
    const { startCostReconcilerWorker } = await import("./cost-reconciler.js");
    startCostReconcilerWorker({ host: "localhost", port: 6379 });

    mockGetAllAgentConfigs.mockResolvedValue([
      { orgId: "org_1", agentId: "agent_1", costBudgetUsd: null, budgetPeriod: "monthly" },
      { orgId: "org_2", agentId: "agent_2", budgetPeriod: "weekly" },
    ]);

    await capturedProcessor({});

    expect(mockGetAllAgentConfigs).toHaveBeenCalled();
    expect(mockSumSpanCosts).not.toHaveBeenCalled();
    expect(mockRedisSet).not.toHaveBeenCalled();
  });
});
