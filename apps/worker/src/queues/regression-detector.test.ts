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

const mockCountTracesForVersion = vi.fn();
const mockGetBaseline = vi.fn();
const mockGetRecentBaselines = vi.fn();
const mockGetSpanStructureForVersion = vi.fn();
const mockUpsertBaseline = vi.fn();
const mockGetAlertRulesForOrg = vi.fn();
const mockListNotificationChannels = vi.fn();
const mockCreateNotificationLogEntry = vi.fn();

vi.mock("@foxhound/db", () => ({
  countTracesForVersion: mockCountTracesForVersion,
  getBaseline: mockGetBaseline,
  getRecentBaselines: mockGetRecentBaselines,
  getSpanStructureForVersion: mockGetSpanStructureForVersion,
  upsertBaseline: mockUpsertBaseline,
  getAlertRulesForOrg: mockGetAlertRulesForOrg,
  listNotificationChannels: mockListNotificationChannels,
  createNotificationLogEntry: mockCreateNotificationLogEntry,
}));

const mockDispatchAlert = vi.fn();

vi.mock("@foxhound/notifications", () => ({
  dispatchAlert: mockDispatchAlert,
}));

import { Worker } from "bullmq";

describe("regression-detector", () => {
  let capturedProcessor: (job: unknown) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(Worker).mockImplementation(
      (_name: string, processor: unknown, _opts: unknown) => {
        capturedProcessor = processor as (job: unknown) => Promise<void>;
        return { on: vi.fn(), close: vi.fn() } as never;
      },
    );
  });

  it("starts the worker with concurrency 3", async () => {
    const { startRegressionDetectorWorker } = await import("./regression-detector.js");
    startRegressionDetectorWorker({ host: "localhost", port: 6379 });
    expect(Worker).toHaveBeenCalledWith(
      "regression-detector",
      expect.any(Function),
      expect.objectContaining({ concurrency: 3 }),
    );
  });

  it("processor skips when baseline already exists", async () => {
    const { startRegressionDetectorWorker } = await import("./regression-detector.js");
    startRegressionDetectorWorker({ host: "localhost", port: 6379 });

    mockGetBaseline.mockResolvedValue({ id: "bl_existing", orgId: "org_1" });

    await capturedProcessor({
      data: { orgId: "org_1", agentId: "agent_1", agentVersion: "v1.0" },
    });

    expect(mockGetBaseline).toHaveBeenCalledWith("org_1", "agent_1", "v1.0");
    expect(mockCountTracesForVersion).not.toHaveBeenCalled();
    expect(mockUpsertBaseline).not.toHaveBeenCalled();
  });

  it("processor skips when insufficient traces (<100)", async () => {
    const { startRegressionDetectorWorker } = await import("./regression-detector.js");
    startRegressionDetectorWorker({ host: "localhost", port: 6379 });

    mockGetBaseline.mockResolvedValue(null);
    mockCountTracesForVersion.mockResolvedValue(50);

    await capturedProcessor({
      data: { orgId: "org_1", agentId: "agent_1", agentVersion: "v1.0" },
    });

    expect(mockGetBaseline).toHaveBeenCalledWith("org_1", "agent_1", "v1.0");
    expect(mockCountTracesForVersion).toHaveBeenCalledWith("org_1", "agent_1", "v1.0");
    expect(mockUpsertBaseline).not.toHaveBeenCalled();
  });

  it("processor creates baseline when enough traces", async () => {
    const { startRegressionDetectorWorker } = await import("./regression-detector.js");
    startRegressionDetectorWorker({ host: "localhost", port: 6379 });

    mockGetBaseline.mockResolvedValue(null);
    mockCountTracesForVersion.mockResolvedValue(150);
    mockGetSpanStructureForVersion.mockResolvedValue({
      "llm.call": 0.95,
      "tool.invoke": 0.8,
    });
    mockUpsertBaseline.mockResolvedValue(undefined);
    // First version - only one baseline returned, no comparison
    mockGetRecentBaselines.mockResolvedValue([
      {
        agentVersion: "v1.0",
        sampleSize: 100,
        spanStructure: { "llm.call": 0.95, "tool.invoke": 0.8 },
      },
    ]);

    await capturedProcessor({
      data: { orgId: "org_1", agentId: "agent_1", agentVersion: "v1.0" },
    });

    expect(mockUpsertBaseline).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org_1",
        agentId: "agent_1",
        agentVersion: "v1.0",
        sampleSize: 100,
        spanStructure: { "llm.call": 0.95, "tool.invoke": 0.8 },
      }),
    );
    expect(mockDispatchAlert).not.toHaveBeenCalled();
  });

  it("processor detects structural drift and fires alert", async () => {
    const { startRegressionDetectorWorker } = await import("./regression-detector.js");
    startRegressionDetectorWorker({ host: "localhost", port: 6379 });

    mockGetBaseline.mockResolvedValue(null);
    mockCountTracesForVersion.mockResolvedValue(200);
    mockGetSpanStructureForVersion.mockResolvedValue({
      "llm.call": 0.9,
      "new.span": 0.5,
      // "tool.invoke" is missing — structural drift from v1.0
    });
    mockUpsertBaseline.mockResolvedValue(undefined);

    // Two baselines returned — newer version first, older version second
    mockGetRecentBaselines.mockResolvedValue([
      {
        agentVersion: "v2.0",
        sampleSize: 100,
        spanStructure: { "llm.call": 0.9, "new.span": 0.5 },
      },
      {
        agentVersion: "v1.0",
        sampleSize: 100,
        spanStructure: { "llm.call": 0.95, "tool.invoke": 0.8 },
      },
    ]);

    mockGetAlertRulesForOrg.mockResolvedValue([
      { id: "rule_1", eventType: "behavior_regression", channelId: "ch_1" },
    ]);
    mockListNotificationChannels.mockResolvedValue([{ id: "ch_1", type: "slack" }]);
    mockDispatchAlert.mockResolvedValue(undefined);
    mockCreateNotificationLogEntry.mockResolvedValue(undefined);

    await capturedProcessor({
      data: { orgId: "org_1", agentId: "agent_1", agentVersion: "v2.0" },
    });

    expect(mockUpsertBaseline).toHaveBeenCalled();
    expect(mockDispatchAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "behavior_regression",
        severity: "high",
        orgId: "org_1",
      }),
      expect.any(Array),
      expect.any(Map),
      expect.any(Object),
    );
    expect(mockCreateNotificationLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org_1",
        eventType: "behavior_regression",
        severity: "high",
      }),
    );
  });
});
