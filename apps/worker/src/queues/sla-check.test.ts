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

const mockUpdateAgentConfigStatus = vi.fn();
const mockGetAlertRulesForOrg = vi.fn();
const mockListNotificationChannels = vi.fn();
const mockCreateNotificationLogEntry = vi.fn();

vi.mock("@foxhound/db", () => ({
  updateAgentConfigStatus: mockUpdateAgentConfigStatus,
  getAlertRulesForOrg: mockGetAlertRulesForOrg,
  listNotificationChannels: mockListNotificationChannels,
  createNotificationLogEntry: mockCreateNotificationLogEntry,
}));

const mockDispatchAlert = vi.fn();

vi.mock("@foxhound/notifications", () => ({
  dispatchAlert: mockDispatchAlert,
}));

const mockRedisGet = vi.fn();
const mockRedisZrange = vi.fn();
const mockRedisQuit = vi.fn();

vi.mock("ioredis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: mockRedisGet,
    zrange: mockRedisZrange,
    quit: mockRedisQuit,
  })),
}));

import { Worker } from "bullmq";

describe("sla-check", () => {
  let capturedProcessor: (job: unknown) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(Worker).mockImplementation((_name: string, processor: unknown, _opts: unknown) => {
      capturedProcessor = processor as (job: unknown) => Promise<void>;
      return { on: vi.fn(), close: vi.fn() } as never;
    });
  });

  it("starts the worker with concurrency 10", async () => {
    const { startSlaCheckWorker } = await import("./sla-check.js");
    startSlaCheckWorker({ host: "localhost", port: 6379 });
    expect(Worker).toHaveBeenCalledWith(
      "sla-check",
      expect.any(Function),
      expect.objectContaining({ concurrency: 10 }),
    );
  });

  it("processor marks 'insufficient_data' when below minSampleSize", async () => {
    const { startSlaCheckWorker } = await import("./sla-check.js");
    startSlaCheckWorker({ host: "localhost", port: 6379 });

    // Return low trace counts and no durations across all minute buckets
    mockRedisGet.mockResolvedValue("1");
    mockRedisZrange.mockResolvedValue([]);

    await capturedProcessor({
      data: {
        configId: "cfg_1",
        orgId: "org_1",
        agentId: "agent_1",
        maxDurationMs: 5000,
        minSuccessRate: 0.99,
        evaluationWindowMs: 60000,
        minSampleSize: 100,
      },
    });

    expect(mockUpdateAgentConfigStatus).toHaveBeenCalledWith(
      "org_1",
      "agent_1",
      null,
      expect.objectContaining({ status: "insufficient_data" }),
    );
    expect(mockDispatchAlert).not.toHaveBeenCalled();
  });

  it("processor marks 'compliant' when within SLA", async () => {
    const { startSlaCheckWorker } = await import("./sla-check.js");
    startSlaCheckWorker({ host: "localhost", port: 6379 });

    // Single minute window: enough traces, no errors, fast durations
    mockRedisGet.mockImplementation((key: string) => {
      if (key.includes("sla:traces:")) return Promise.resolve("50");
      if (key.includes("sla:errors:")) return Promise.resolve("0");
      return Promise.resolve(null);
    });
    mockRedisZrange.mockImplementation((key: string) => {
      if (key.includes("sla:duration:")) {
        // Return 50 durations all under 5000ms as sorted set WITHSCORES format
        // [member, score, member, score, ...]
        const result: string[] = [];
        for (let i = 0; i < 50; i++) {
          result.push(`trace_${i}`, String(1000 + i * 10));
        }
        return Promise.resolve(result);
      }
      return Promise.resolve([]);
    });

    await capturedProcessor({
      data: {
        configId: "cfg_1",
        orgId: "org_1",
        agentId: "agent_1",
        maxDurationMs: 5000,
        minSuccessRate: 0.95,
        evaluationWindowMs: 60000,
        minSampleSize: 10,
      },
    });

    expect(mockUpdateAgentConfigStatus).toHaveBeenCalledWith(
      "org_1",
      "agent_1",
      null,
      expect.objectContaining({ status: "compliant", compliant: true }),
    );
    expect(mockDispatchAlert).not.toHaveBeenCalled();
  });

  it("processor marks 'breach' and fires alert when duration exceeds SLA", async () => {
    const { startSlaCheckWorker } = await import("./sla-check.js");
    startSlaCheckWorker({ host: "localhost", port: 6379 });

    // Single minute window: enough traces, no errors, but slow durations
    mockRedisGet.mockImplementation((key: string) => {
      if (key.includes("sla:traces:")) return Promise.resolve("20");
      if (key.includes("sla:errors:")) return Promise.resolve("0");
      return Promise.resolve(null);
    });
    mockRedisZrange.mockImplementation((key: string) => {
      if (key.includes("sla:duration:")) {
        // Return 20 durations, most exceeding the 5000ms SLA
        const result: string[] = [];
        for (let i = 0; i < 20; i++) {
          result.push(`trace_${i}`, String(6000 + i * 100));
        }
        return Promise.resolve(result);
      }
      return Promise.resolve([]);
    });

    mockGetAlertRulesForOrg.mockResolvedValue([
      { id: "rule_1", eventType: "sla_duration_breach", channelId: "ch_1" },
    ]);
    mockListNotificationChannels.mockResolvedValue([{ id: "ch_1", type: "slack" }]);
    mockDispatchAlert.mockResolvedValue(undefined);
    mockCreateNotificationLogEntry.mockResolvedValue({ id: "log_1" });
    mockUpdateAgentConfigStatus.mockResolvedValue(undefined);

    await capturedProcessor({
      data: {
        configId: "cfg_1",
        orgId: "org_1",
        agentId: "agent_1",
        maxDurationMs: 5000,
        minSuccessRate: null,
        evaluationWindowMs: 60000,
        minSampleSize: 10,
      },
    });

    expect(mockUpdateAgentConfigStatus).toHaveBeenCalledWith(
      "org_1",
      "agent_1",
      null,
      expect.objectContaining({ status: "breach", compliant: false }),
    );
    expect(mockDispatchAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "sla_duration_breach",
        severity: "high",
        orgId: "org_1",
      }),
      expect.any(Array),
      expect.any(Map),
      expect.any(Object),
    );
    expect(mockCreateNotificationLogEntry).toHaveBeenCalled();
  });

  it("does not dispatch when dedupe insert returns null", async () => {
    const { startSlaCheckWorker } = await import("./sla-check.js");
    startSlaCheckWorker({ host: "localhost", port: 6379 });

    mockRedisGet.mockImplementation((key: string) => {
      if (key.includes("sla:traces:")) return Promise.resolve("20");
      if (key.includes("sla:errors:")) return Promise.resolve("0");
      return Promise.resolve(null);
    });
    mockRedisZrange.mockImplementation((key: string) => {
      if (key.includes("sla:duration:")) {
        const result: string[] = [];
        for (let i = 0; i < 20; i++) {
          result.push(`trace_${i}`, String(6000 + i * 100));
        }
        return Promise.resolve(result);
      }
      return Promise.resolve([]);
    });

    mockGetAlertRulesForOrg.mockResolvedValue([
      { id: "rule_1", eventType: "sla_duration_breach", channelId: "ch_1" },
    ]);
    mockListNotificationChannels.mockResolvedValue([{ id: "ch_1", type: "slack" }]);
    mockCreateNotificationLogEntry.mockResolvedValue(null);
    mockUpdateAgentConfigStatus.mockResolvedValue(undefined);

    await capturedProcessor({
      data: {
        configId: "cfg_1",
        orgId: "org_1",
        agentId: "agent_1",
        maxDurationMs: 5000,
        minSuccessRate: null,
        evaluationWindowMs: 60000,
        minSampleSize: 10,
      },
    });

    expect(mockDispatchAlert).not.toHaveBeenCalled();
  });
});
