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

const mockGetAgentConfig = vi.fn();
const mockGetAlertRulesForOrg = vi.fn();
const mockListNotificationChannels = vi.fn();
const mockCreateNotificationLogEntry = vi.fn();
const mockUpdateAgentConfigStatus = vi.fn();
const mockSumSpanCosts = vi.fn();

vi.mock("@foxhound/db", () => ({
  getAgentConfig: mockGetAgentConfig,
  getAlertRulesForOrg: mockGetAlertRulesForOrg,
  listNotificationChannels: mockListNotificationChannels,
  createNotificationLogEntry: mockCreateNotificationLogEntry,
  updateAgentConfigStatus: mockUpdateAgentConfigStatus,
  sumSpanCosts: mockSumSpanCosts,
}));

const mockDispatchAlert = vi.fn();

vi.mock("@foxhound/notifications", () => ({
  dispatchAlert: mockDispatchAlert,
}));

vi.mock("@foxhound/types", () => ({
  parsePeriodStart: () => 1700000000000,
}));

import { Worker, Queue } from "bullmq";

describe("cost-monitor", () => {
  let capturedProcessor: (job: unknown) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(Worker).mockImplementation((_name: string, processor: unknown, _opts: unknown) => {
      capturedProcessor = processor as (job: unknown) => Promise<void>;
      return { on: vi.fn(), close: vi.fn() } as never;
    });
  });

  it("creates the cost monitor queue", async () => {
    const { createCostMonitorQueue } = await import("./cost-monitor.js");
    const connection = { host: "localhost", port: 6379 };
    createCostMonitorQueue(connection);
    expect(Queue).toHaveBeenCalledWith("cost-monitor", { connection });
  });

  it("starts the worker with concurrency 10", async () => {
    const { startCostMonitorWorker } = await import("./cost-monitor.js");
    const connection = { host: "localhost", port: 6379 };
    startCostMonitorWorker(connection);
    expect(Worker).toHaveBeenCalledWith(
      "cost-monitor",
      expect.any(Function),
      expect.objectContaining({ concurrency: 10 }),
    );
  });

  it("processor skips when no config found", async () => {
    const { startCostMonitorWorker } = await import("./cost-monitor.js");
    startCostMonitorWorker({ host: "localhost", port: 6379 });

    mockGetAgentConfig.mockResolvedValue(null);

    await capturedProcessor({
      data: { orgId: "org_1", agentId: "agent_1", periodKey: "2024-01", level: "high" },
    });

    expect(mockGetAgentConfig).toHaveBeenCalledWith("org_1", "agent_1");
    expect(mockSumSpanCosts).not.toHaveBeenCalled();
    expect(mockDispatchAlert).not.toHaveBeenCalled();
  });

  it("processor dispatches alert when budget exceeded", async () => {
    const { startCostMonitorWorker } = await import("./cost-monitor.js");
    startCostMonitorWorker({ host: "localhost", port: 6379 });

    mockGetAgentConfig.mockResolvedValue({
      costBudgetUsd: "100",
      costAlertThresholdPct: 80,
      budgetPeriod: "monthly",
    });
    mockSumSpanCosts.mockResolvedValue({
      totalCost: 150,
      totalSpans: 200,
      unknownCostSpans: 5,
    });
    mockUpdateAgentConfigStatus.mockResolvedValue(undefined);
    mockGetAlertRulesForOrg.mockResolvedValue([
      { id: "rule_1", eventType: "cost_budget_exceeded", channelId: "ch_1" },
    ]);
    mockListNotificationChannels.mockResolvedValue([{ id: "ch_1", type: "slack" }]);
    mockDispatchAlert.mockResolvedValue(undefined);
    mockCreateNotificationLogEntry.mockResolvedValue({ id: "log_1" });

    await capturedProcessor({
      data: { orgId: "org_1", agentId: "agent_1", periodKey: "2024-01", level: "critical" },
    });

    expect(mockUpdateAgentConfigStatus).toHaveBeenCalledWith(
      "org_1",
      "agent_1",
      expect.objectContaining({ status: "exceeded" }),
      null,
    );
    expect(mockDispatchAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "cost_budget_exceeded",
        severity: "critical",
        orgId: "org_1",
      }),
      expect.any(Array),
      expect.any(Map),
      expect.any(Object),
    );
    expect(mockCreateNotificationLogEntry).toHaveBeenCalled();
  });

  it("does not dispatch or log when dedupe insert returns null", async () => {
    const { startCostMonitorWorker } = await import("./cost-monitor.js");
    startCostMonitorWorker({ host: "localhost", port: 6379 });

    mockGetAgentConfig.mockResolvedValue({
      costBudgetUsd: "100",
      costAlertThresholdPct: 80,
      budgetPeriod: "monthly",
    });
    mockSumSpanCosts.mockResolvedValue({
      totalCost: 150,
      totalSpans: 200,
      unknownCostSpans: 5,
    });
    mockUpdateAgentConfigStatus.mockResolvedValue(undefined);
    mockGetAlertRulesForOrg.mockResolvedValue([
      { id: "rule_1", eventType: "cost_budget_exceeded", channelId: "ch_1" },
    ]);
    mockListNotificationChannels.mockResolvedValue([{ id: "ch_1", type: "slack" }]);
    mockCreateNotificationLogEntry.mockResolvedValue(null);

    await capturedProcessor({
      data: { orgId: "org_1", agentId: "agent_1", periodKey: "2024-01", level: "critical" },
    });

    expect(mockDispatchAlert).not.toHaveBeenCalled();
  });

  it("processor updates status to 'under' when within budget", async () => {
    const { startCostMonitorWorker } = await import("./cost-monitor.js");
    startCostMonitorWorker({ host: "localhost", port: 6379 });

    mockGetAgentConfig.mockResolvedValue({
      costBudgetUsd: "100",
      costAlertThresholdPct: 80,
      budgetPeriod: "monthly",
    });
    mockSumSpanCosts.mockResolvedValue({
      totalCost: 10,
      totalSpans: 50,
      unknownCostSpans: 0,
    });
    mockUpdateAgentConfigStatus.mockResolvedValue(undefined);

    await capturedProcessor({
      data: { orgId: "org_1", agentId: "agent_1", periodKey: "2024-01", level: "high" },
    });

    expect(mockUpdateAgentConfigStatus).toHaveBeenCalledWith(
      "org_1",
      "agent_1",
      expect.objectContaining({ status: "under" }),
      null,
    );
    expect(mockDispatchAlert).not.toHaveBeenCalled();
  });
});
