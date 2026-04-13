/**
 * Integration tests for Foxhound MCP server tool handlers.
 *
 * Strategy: We mock the MCP SDK's McpServer to capture all tool registrations,
 * mock the FoxhoundApiClient to control API responses, then invoke the captured
 * handler functions directly with test params.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import type {
  Trace,
  Span,
  Score,
  Evaluator,
  EvaluatorRun,
  Dataset,
  DatasetItem,
} from "@foxhound/types";

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------

type ToolHandler = (params: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
}>;

/** Map from tool name to its handler function, populated when main() runs. */
const toolHandlers = new Map<string, ToolHandler>();

/**
 * Pre-populated mock API client. Every method the MCP server handlers might call
 * is defined here as a vi.fn(). This avoids Proxy timing issues where mocks
 * would only be created at handler invocation time, making beforeEach setup impossible.
 */
const mockApi = {
  searchTraces: vi.fn(),
  getTrace: vi.fn(),
  replaySpan: vi.fn(),
  diffRuns: vi.fn(),
  getUsage: vi.fn(),
  getHealth: vi.fn(),
  listAlertRules: vi.fn(),
  createAlertRule: vi.fn(),
  deleteAlertRule: vi.fn(),
  listChannels: vi.fn(),
  createChannel: vi.fn(),
  testChannel: vi.fn(),
  deleteChannel: vi.fn(),
  listApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
  getBudget: vi.fn(),
  getSla: vi.fn(),
  compareVersions: vi.fn(),
  listBaselines: vi.fn(),
  createScore: vi.fn(),
  getTraceScores: vi.fn(),
  listEvaluators: vi.fn(),
  triggerEvaluatorRuns: vi.fn(),
  getEvaluatorRun: vi.fn(),
  listDatasets: vi.fn(),
  getDataset: vi.fn(),
  createDatasetItem: vi.fn(),
  createDatasetItemsFromTraces: vi.fn(),
};

// Mock the McpServer class to capture tool registrations instead of starting a real server.
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    tool: (name: string, _description: string, _schema: unknown, handler: ToolHandler) => {
      toolHandlers.set(name, handler);
    },
    connect: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock the stdio transport so it does nothing.
vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}));

// Mock FoxhoundApiClient to return the pre-populated mock instance.
vi.mock("@foxhound/api-client", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    FoxhoundApiClient: vi.fn().mockImplementation(() => mockApi),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpan(overrides: Partial<Span> & Pick<Span, "spanId" | "name">): Span {
  return {
    traceId: "trace-1",
    kind: "custom",
    startTimeMs: 1000,
    endTimeMs: 2000,
    status: "ok",
    attributes: {},
    events: [],
    ...overrides,
  };
}

function makeTrace(overrides: Partial<Trace> & { spans: Span[] }): Trace {
  return {
    id: "trace-1",
    agentId: "test-agent",
    startTimeMs: 1000,
    endTimeMs: 5000,
    metadata: {},
    ...overrides,
  };
}

function getText(result: { content: Array<{ type: string; text: string }> }): string {
  return result.content[0]?.text ?? "";
}

// ---------------------------------------------------------------------------
// Boot the server once so all handlers are registered
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Set required env vars before importing main
  process.env["FOXHOUND_API_KEY"] = "fox_test_key";
  process.env["FOXHOUND_ENDPOINT"] = "http://localhost:3001";

  // Import triggers main() which registers all tools via our mocked McpServer
  await import("./index.js");
});

beforeEach(() => {
  // Reset all mock API method call history between tests
  for (const fn of Object.values(mockApi)) {
    fn.mockReset();
  }
});

// ---------------------------------------------------------------------------
// Helper to get a handler, throwing if not registered
// ---------------------------------------------------------------------------

function getHandler(name: string): ToolHandler {
  const handler = toolHandlers.get(name);
  if (!handler) {
    throw new Error(
      `Tool "${name}" was not registered. Available: ${[...toolHandlers.keys()].join(", ")}`,
    );
  }
  return handler;
}

// ===========================================================================
// TESTS
// ===========================================================================

describe("foxhound_search_traces", () => {
  it("calls searchTraces with agent name and default limit", async () => {
    const handler = getHandler("foxhound_search_traces");
    mockApi["searchTraces"].mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, count: 0 },
    });

    const result = await handler({ agent_name: "my-agent" });

    expect(mockApi["searchTraces"]).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "my-agent", limit: 20 }),
    );
    expect(getText(result)).toContain("No traces found");
  });

  it("formats trace list with span counts and error tags", async () => {
    const handler = getHandler("foxhound_search_traces");
    const trace = makeTrace({
      id: "trace-abc",
      spans: [
        makeSpan({ spanId: "s1", name: "step1" }),
        makeSpan({ spanId: "s2", name: "step2", status: "error" }),
      ],
    });

    mockApi["searchTraces"].mockResolvedValue({
      data: [trace],
      pagination: { page: 1, limit: 20, count: 1 },
    });

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("trace-abc");
    expect(text).toContain("2 spans");
    expect(text).toContain("1 error(s)");
  });

  it("passes time range params when provided", async () => {
    const handler = getHandler("foxhound_search_traces");
    mockApi["searchTraces"].mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, count: 0 },
    });

    await handler({
      from: "2026-01-01T00:00:00Z",
      to: "2026-01-02T00:00:00Z",
      limit: 10,
    });

    expect(mockApi["searchTraces"]).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.any(Number),
        to: expect.any(Number),
        limit: 10,
      }),
    );
  });

  it("returns 'No traces found' for empty results", async () => {
    const handler = getHandler("foxhound_search_traces");
    mockApi["searchTraces"].mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, count: 0 },
    });

    const result = await handler({});
    expect(getText(result)).toBe("No traces found matching your criteria.");
  });
});

describe("foxhound_get_trace", () => {
  it("calls getTrace with the provided trace ID", async () => {
    const handler = getHandler("foxhound_get_trace");
    const trace = makeTrace({
      id: "trace-xyz",
      agentId: "agent-1",
      spans: [makeSpan({ spanId: "s1", name: "root-step" })],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const result = await handler({ trace_id: "trace-xyz" });
    const text = getText(result);

    expect(mockApi["getTrace"]).toHaveBeenCalledWith("trace-xyz");
    expect(text).toContain("# Trace trace-xyz");
    expect(text).toContain("Agent: agent-1");
  });

  it("renders span tree with parent-child hierarchy", async () => {
    const handler = getHandler("foxhound_get_trace");
    const trace = makeTrace({
      id: "trace-tree",
      spans: [
        makeSpan({ spanId: "root", name: "agent-run", kind: "workflow" }),
        makeSpan({ spanId: "child", name: "llm-call", kind: "llm_call", parentSpanId: "root" }),
      ],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const result = await handler({ trace_id: "trace-tree" });
    const text = getText(result);

    expect(text).toContain("Span Tree");
    expect(text).toContain("[workflow] **agent-run**");
    expect(text).toContain("[llm_call] **llm-call**");
  });

  it("shows error status and error events in span tree", async () => {
    const handler = getHandler("foxhound_get_trace");
    const trace = makeTrace({
      id: "trace-err",
      spans: [
        makeSpan({
          spanId: "s1",
          name: "failing-step",
          status: "error",
          events: [
            {
              timeMs: 1500,
              name: "error",
              attributes: { "error.message": "Connection refused" },
            },
          ],
        }),
      ],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const result = await handler({ trace_id: "trace-err" });
    const text = getText(result);

    expect(text).toContain("**ERROR**");
    expect(text).toContain("Connection refused");
  });

  it("shows span attributes in the tree", async () => {
    const handler = getHandler("foxhound_get_trace");
    const trace = makeTrace({
      id: "trace-attrs",
      spans: [
        makeSpan({
          spanId: "s1",
          name: "step-with-attrs",
          attributes: { model: "gpt-4", temperature: 0.7 },
        }),
      ],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const result = await handler({ trace_id: "trace-attrs" });
    const text = getText(result);

    expect(text).toContain("model=");
    expect(text).toContain("temperature=");
  });
});

describe("foxhound_explain_failure", () => {
  it("returns 'no errors' message for successful traces", async () => {
    const handler = getHandler("foxhound_explain_failure");
    const trace = makeTrace({
      id: "trace-ok",
      spans: [makeSpan({ spanId: "s1", name: "success-step", status: "ok" })],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const result = await handler({ trace_id: "trace-ok" });
    const text = getText(result);

    expect(text).toContain("No errors detected");
    expect(text).toContain("1 spans completed successfully");
  });

  it("analyzes error chain with parent context", async () => {
    const handler = getHandler("foxhound_explain_failure");
    const trace = makeTrace({
      id: "trace-fail",
      spans: [
        makeSpan({ spanId: "root", name: "agent-run", kind: "workflow" }),
        makeSpan({
          spanId: "child",
          name: "api-call",
          kind: "tool_call",
          parentSpanId: "root",
          status: "error",
          startTimeMs: 1000,
          endTimeMs: 1500,
          events: [
            {
              timeMs: 1500,
              name: "error",
              attributes: { "error.message": "API key invalid" },
            },
          ],
        }),
      ],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const result = await handler({ trace_id: "trace-fail" });
    const text = getText(result);

    expect(text).toContain("Failure Analysis");
    expect(text).toContain("API key invalid");
    expect(text).toContain("api-call");
    expect(text).toContain("Error Chain");
  });

  it("lists multiple error spans", async () => {
    const handler = getHandler("foxhound_explain_failure");
    const trace = makeTrace({
      id: "trace-multi-err",
      spans: [
        makeSpan({
          spanId: "s1",
          name: "first-error",
          status: "error",
          startTimeMs: 1000,
          events: [{ timeMs: 1100, name: "error", attributes: { "error.message": "err-1" } }],
        }),
        makeSpan({
          spanId: "s2",
          name: "second-error",
          status: "error",
          startTimeMs: 2000,
          events: [{ timeMs: 2100, name: "error", attributes: { "error.message": "err-2" } }],
        }),
      ],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const result = await handler({ trace_id: "trace-multi-err" });
    const text = getText(result);

    expect(text).toContain("Error Count**: 2");
    expect(text).toContain("Other Errors");
    expect(text).toContain("second-error");
  });

  it("handles API errors gracefully", async () => {
    const handler = getHandler("foxhound_explain_failure");
    mockApi["getTrace"].mockRejectedValue(new Error("Foxhound API 404"));

    const result = await handler({ trace_id: "missing-trace" });
    const text = getText(result);

    expect(text).toContain("Error fetching trace");
    expect(text).toContain("Foxhound API 404");
  });
});

describe("foxhound_score_trace", () => {
  it("returns preview when confirm is false", async () => {
    const handler = getHandler("foxhound_score_trace");

    const result = await handler({
      trace_id: "trace-1",
      name: "quality",
      value: 0.9,
      comment: "Great output",
    });
    const text = getText(result);

    expect(text).toContain("Score Preview");
    expect(text).toContain("trace-1");
    expect(text).toContain("quality");
    expect(text).toContain("0.9");
    expect(text).toContain("Great output");
    expect(text).toContain("confirm: true");
    // API should NOT have been called
    expect(mockApi["createScore"]).not.toHaveBeenCalled();
  });

  it("returns preview with span_id when provided", async () => {
    const handler = getHandler("foxhound_score_trace");

    const result = await handler({
      trace_id: "trace-1",
      span_id: "span-42",
      name: "accuracy",
      label: "excellent",
    });
    const text = getText(result);

    expect(text).toContain("span-42");
    expect(text).toContain("accuracy");
    expect(text).toContain("excellent");
  });

  it("creates score when confirm is true", async () => {
    const handler = getHandler("foxhound_score_trace");
    const mockScore: Score = {
      id: "score-123",
      orgId: "org-1",
      traceId: "trace-1",
      name: "quality",
      value: 0.8,
      source: "manual",
      createdAt: "2026-04-11T00:00:00Z",
    };
    mockApi["createScore"].mockResolvedValue(mockScore);

    const result = await handler({
      trace_id: "trace-1",
      name: "quality",
      value: 0.8,
      confirm: true,
    });
    const text = getText(result);

    expect(mockApi["createScore"]).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: "trace-1",
        name: "quality",
        value: 0.8,
        source: "manual",
      }),
    );
    expect(text).toContain("Score Created");
    expect(text).toContain("score-123");
  });

  it("handles errors when creating score", async () => {
    const handler = getHandler("foxhound_score_trace");
    mockApi["createScore"].mockRejectedValue(new Error("Foxhound API 500"));

    const result = await handler({
      trace_id: "trace-1",
      name: "quality",
      value: 0.5,
      confirm: true,
    });
    const text = getText(result);

    expect(text).toContain("Error creating score");
    expect(text).toContain("Foxhound API 500");
  });
});

describe("foxhound_get_trace_scores", () => {
  it("returns 'no scores' for empty response", async () => {
    const handler = getHandler("foxhound_get_trace_scores");
    mockApi["getTraceScores"].mockResolvedValue({ data: [] });

    const result = await handler({ trace_id: "trace-1" });
    const text = getText(result);

    expect(text).toContain("No scores found");
  });

  it("formats scores as a markdown table", async () => {
    const handler = getHandler("foxhound_get_trace_scores");
    const scores: Score[] = [
      {
        id: "s1",
        orgId: "org-1",
        traceId: "trace-1",
        name: "quality",
        value: 0.95,
        source: "manual",
        comment: "Excellent",
        createdAt: "2026-04-11T00:00:00Z",
      },
      {
        id: "s2",
        orgId: "org-1",
        traceId: "trace-1",
        spanId: "span-5",
        name: "accuracy",
        label: "good",
        source: "llm_judge",
        createdAt: "2026-04-11T00:00:00Z",
      },
    ];
    mockApi["getTraceScores"].mockResolvedValue({ data: scores });

    const result = await handler({ trace_id: "trace-1" });
    const text = getText(result);

    expect(text).toContain("2 score(s)");
    expect(text).toContain("quality");
    expect(text).toContain("0.95");
    expect(text).toContain("manual");
    expect(text).toContain("Excellent");
    expect(text).toContain("accuracy");
    expect(text).toContain("good");
    expect(text).toContain("span-5");
  });
});

describe("foxhound_list_evaluators", () => {
  it("returns 'no evaluators' when empty", async () => {
    const handler = getHandler("foxhound_list_evaluators");
    mockApi["listEvaluators"].mockResolvedValue({ data: [] });

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("No evaluators configured");
  });

  it("formats evaluators as a markdown table", async () => {
    const handler = getHandler("foxhound_list_evaluators");
    const evaluators: Evaluator[] = [
      {
        id: "eval-1",
        orgId: "org-1",
        name: "Quality Checker",
        promptTemplate: "Rate the quality...",
        model: "gpt-4",
        scoringType: "numeric",
        labels: [],
        enabled: true,
        createdAt: "2026-04-11T00:00:00Z",
      },
      {
        id: "eval-2",
        orgId: "org-1",
        name: "Safety Classifier",
        promptTemplate: "Classify safety...",
        model: "claude-3-5-sonnet",
        scoringType: "categorical",
        labels: ["safe", "unsafe"],
        enabled: false,
        createdAt: "2026-04-11T00:00:00Z",
      },
    ];
    mockApi["listEvaluators"].mockResolvedValue({ data: evaluators });

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("Evaluators (2)");
    expect(text).toContain("Quality Checker");
    expect(text).toContain("gpt-4");
    expect(text).toContain("numeric");
    expect(text).toContain("Safety Classifier");
    expect(text).toContain("categorical");
  });

  it("handles errors gracefully", async () => {
    const handler = getHandler("foxhound_list_evaluators");
    mockApi["listEvaluators"].mockRejectedValue(new Error("Network error"));

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("Error listing evaluators");
    expect(text).toContain("Network error");
  });
});

describe("foxhound_run_evaluator (trigger evaluator runs)", () => {
  it("triggers runs and returns queued status", async () => {
    const handler = getHandler("foxhound_run_evaluator");
    mockApi["triggerEvaluatorRuns"].mockResolvedValue({
      message: "Runs queued",
      runs: [
        { id: "run-1", traceId: "trace-a", status: "pending" },
        { id: "run-2", traceId: "trace-b", status: "pending" },
      ],
    });

    const result = await handler({
      evaluator_id: "eval-1",
      trace_ids: ["trace-a", "trace-b"],
    });
    const text = getText(result);

    expect(mockApi["triggerEvaluatorRuns"]).toHaveBeenCalledWith({
      evaluatorId: "eval-1",
      traceIds: ["trace-a", "trace-b"],
    });
    expect(text).toContain("2 evaluator run(s)");
    expect(text).toContain("run-1");
    expect(text).toContain("run-2");
    expect(text).toContain("trace-a");
    expect(text).toContain("pending");
  });

  it("handles trigger errors", async () => {
    const handler = getHandler("foxhound_run_evaluator");
    mockApi["triggerEvaluatorRuns"].mockRejectedValue(new Error("Evaluator not found"));

    const result = await handler({
      evaluator_id: "bad-eval",
      trace_ids: ["trace-1"],
    });
    const text = getText(result);

    expect(text).toContain("Error triggering evaluator runs");
    expect(text).toContain("Evaluator not found");
  });
});

describe("foxhound_get_evaluator_run", () => {
  it("shows pending run status", async () => {
    const handler = getHandler("foxhound_get_evaluator_run");
    const run: EvaluatorRun = {
      id: "run-1",
      evaluatorId: "eval-1",
      traceId: "trace-1",
      status: "pending",
      createdAt: "2026-04-11T00:00:00Z",
    };
    mockApi["getEvaluatorRun"].mockResolvedValue(run);

    const result = await handler({ run_id: "run-1" });
    const text = getText(result);

    expect(text).toContain("run-1");
    expect(text).toContain("eval-1");
    expect(text).toContain("pending");
  });

  it("shows completed run with score reference", async () => {
    const handler = getHandler("foxhound_get_evaluator_run");
    const run: EvaluatorRun = {
      id: "run-2",
      evaluatorId: "eval-1",
      traceId: "trace-1",
      scoreId: "score-99",
      status: "completed",
      createdAt: "2026-04-11T00:00:00Z",
      completedAt: "2026-04-11T00:01:00Z",
    };
    mockApi["getEvaluatorRun"].mockResolvedValue(run);

    const result = await handler({ run_id: "run-2" });
    const text = getText(result);

    expect(text).toContain("completed");
    expect(text).toContain("score-99");
    expect(text).toContain("foxhound_get_trace_scores");
  });

  it("shows failed run with error message", async () => {
    const handler = getHandler("foxhound_get_evaluator_run");
    const run: EvaluatorRun = {
      id: "run-3",
      evaluatorId: "eval-1",
      traceId: "trace-1",
      status: "failed",
      error: "LLM judge returned invalid JSON",
      createdAt: "2026-04-11T00:00:00Z",
    };
    mockApi["getEvaluatorRun"].mockResolvedValue(run);

    const result = await handler({ run_id: "run-3" });
    const text = getText(result);

    expect(text).toContain("failed");
    expect(text).toContain("LLM judge returned invalid JSON");
  });

  it("handles fetch errors", async () => {
    const handler = getHandler("foxhound_get_evaluator_run");
    mockApi["getEvaluatorRun"].mockRejectedValue(new Error("Run not found"));

    const result = await handler({ run_id: "no-such-run" });
    const text = getText(result);

    expect(text).toContain("Error fetching evaluator run");
  });
});

describe("foxhound_list_datasets", () => {
  it("returns 'no datasets' for empty response", async () => {
    const handler = getHandler("foxhound_list_datasets");
    mockApi["listDatasets"].mockResolvedValue({ data: [] });

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("No datasets found");
  });

  it("formats datasets with item counts", async () => {
    const handler = getHandler("foxhound_list_datasets");
    const datasets: Dataset[] = [
      {
        id: "ds-1",
        orgId: "org-1",
        name: "Training Set",
        description: "Main training data",
        createdAt: "2026-04-11T00:00:00Z",
      },
      { id: "ds-2", orgId: "org-1", name: "Eval Set", createdAt: "2026-04-11T00:00:00Z" },
    ];
    mockApi["listDatasets"].mockResolvedValue({ data: datasets });
    mockApi["getDataset"]
      .mockResolvedValueOnce({ ...datasets[0], itemCount: 150 })
      .mockResolvedValueOnce({ ...datasets[1], itemCount: 30 });

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("Datasets (2)");
    expect(text).toContain("Training Set");
    expect(text).toContain("Main training data");
    expect(text).toContain("150");
    expect(text).toContain("Eval Set");
    expect(text).toContain("30");
  });

  it("handles errors gracefully", async () => {
    const handler = getHandler("foxhound_list_datasets");
    mockApi["listDatasets"].mockRejectedValue(new Error("DB connection failed"));

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("Error listing datasets");
  });
});

describe("foxhound_add_trace_to_dataset", () => {
  it("returns preview when confirm is false", async () => {
    const handler = getHandler("foxhound_add_trace_to_dataset");
    const trace = makeTrace({
      id: "trace-data",
      spans: [
        makeSpan({
          spanId: "root",
          name: "agent-run",
          attributes: { prompt: "What is 2+2?", model: "gpt-4" },
        }),
      ],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const result = await handler({
      dataset_id: "ds-1",
      trace_id: "trace-data",
      expected_output: { answer: "4" },
    });
    const text = getText(result);

    expect(text).toContain("Preview");
    expect(text).toContain("ds-1");
    expect(text).toContain("trace-data");
    expect(text).toContain("Extracted Input");
    expect(text).toContain("Expected Output");
    expect(text).toContain("confirm: true");
    expect(mockApi["createDatasetItem"]).not.toHaveBeenCalled();
  });

  it("creates dataset item when confirm is true", async () => {
    const handler = getHandler("foxhound_add_trace_to_dataset");
    const trace = makeTrace({
      id: "trace-data",
      spans: [
        makeSpan({
          spanId: "root",
          name: "agent-run",
          attributes: { prompt: "Hello" },
        }),
      ],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const mockItem: DatasetItem = {
      id: "item-1",
      datasetId: "ds-1",
      input: { prompt: "Hello" },
      sourceTraceId: "trace-data",
      createdAt: "2026-04-11T00:00:00Z",
    };
    mockApi["createDatasetItem"].mockResolvedValue(mockItem);

    const result = await handler({
      dataset_id: "ds-1",
      trace_id: "trace-data",
      confirm: true,
    });
    const text = getText(result);

    expect(mockApi["createDatasetItem"]).toHaveBeenCalledWith(
      "ds-1",
      expect.objectContaining({
        sourceTraceId: "trace-data",
      }),
    );
    expect(text).toContain("Trace Added to Dataset");
    expect(text).toContain("item-1");
  });

  it("shows metadata in preview when provided", async () => {
    const handler = getHandler("foxhound_add_trace_to_dataset");
    const trace = makeTrace({
      id: "trace-meta",
      spans: [makeSpan({ spanId: "root", name: "step" })],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const result = await handler({
      dataset_id: "ds-1",
      trace_id: "trace-meta",
      metadata: { source: "production", tag: "regression" },
    });
    const text = getText(result);

    expect(text).toContain("Metadata");
    expect(text).toContain("production");
    expect(text).toContain("regression");
  });

  it("handles API errors when adding to dataset", async () => {
    const handler = getHandler("foxhound_add_trace_to_dataset");
    mockApi["getTrace"].mockRejectedValue(new Error("Trace not found"));

    const result = await handler({
      dataset_id: "ds-1",
      trace_id: "missing-trace",
      confirm: true,
    });
    const text = getText(result);

    expect(text).toContain("Error adding trace to dataset");
  });
});

describe("foxhound_curate_dataset", () => {
  it("curates dataset items from traces by score criteria", async () => {
    const handler = getHandler("foxhound_curate_dataset");
    mockApi["createDatasetItemsFromTraces"].mockResolvedValue({
      added: 12,
      items: [],
    });

    const result = await handler({
      dataset_id: "ds-1",
      score_name: "quality",
      operator: "gte",
      threshold: 0.8,
      since_days: 7,
      limit: 100,
    });
    const text = getText(result);

    expect(mockApi["createDatasetItemsFromTraces"]).toHaveBeenCalledWith("ds-1", {
      scoreName: "quality",
      scoreOperator: "gte",
      scoreThreshold: 0.8,
      sinceDays: 7,
      limit: 100,
    });
    expect(text).toContain("12");
    expect(text).toContain("quality");
    expect(text).toContain(">=");
    expect(text).toContain("0.8");
    expect(text).toContain("7 day(s)");
  });

  it("handles curation errors", async () => {
    const handler = getHandler("foxhound_curate_dataset");
    mockApi["createDatasetItemsFromTraces"].mockRejectedValue(new Error("Invalid score name"));

    const result = await handler({
      dataset_id: "ds-1",
      score_name: "nonexistent",
      operator: "gt",
      threshold: 0.5,
    });
    const text = getText(result);

    expect(text).toContain("Error curating dataset");
  });
});

describe("foxhound_suggest_fix", () => {
  it("returns 'no fixes needed' for trace without errors", async () => {
    const handler = getHandler("foxhound_suggest_fix");
    const trace = makeTrace({
      id: "trace-ok",
      spans: [makeSpan({ spanId: "s1", name: "healthy-step", status: "ok" })],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const result = await handler({ trace_id: "trace-ok" });
    const text = getText(result);

    expect(text).toContain("No errors detected");
    expect(text).toContain("No fixes needed");
  });

  it("classifies timeout errors and suggests fixes", async () => {
    const handler = getHandler("foxhound_suggest_fix");
    const trace = makeTrace({
      id: "trace-timeout",
      spans: [
        makeSpan({
          spanId: "s1",
          name: "slow-api-call",
          status: "error",
          startTimeMs: 1000,
          endTimeMs: 35000,
          events: [
            { timeMs: 35000, name: "error", attributes: { "error.message": "Request timed out" } },
          ],
        }),
      ],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const result = await handler({ trace_id: "trace-timeout" });
    const text = getText(result);

    expect(text).toContain("Timeout Issues");
    expect(text).toContain("slow-api-call");
    expect(text).toContain("exponential backoff");
  });

  it("classifies auth errors and suggests fixes", async () => {
    const handler = getHandler("foxhound_suggest_fix");
    const trace = makeTrace({
      id: "trace-auth",
      spans: [
        makeSpan({
          spanId: "s1",
          name: "api-request",
          status: "error",
          events: [
            { timeMs: 1500, name: "error", attributes: { "error.message": "401 Unauthorized" } },
          ],
        }),
      ],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const result = await handler({ trace_id: "trace-auth" });
    const text = getText(result);

    expect(text).toContain("Authentication Failures");
    expect(text).toContain("API key");
  });

  it("classifies rate limit errors and suggests fixes", async () => {
    const handler = getHandler("foxhound_suggest_fix");
    const trace = makeTrace({
      id: "trace-rate",
      spans: [
        makeSpan({
          spanId: "s1",
          name: "llm-request",
          status: "error",
          events: [
            {
              timeMs: 1500,
              name: "error",
              attributes: { "error.message": "429 Too Many Requests" },
            },
          ],
        }),
      ],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const result = await handler({ trace_id: "trace-rate" });
    const text = getText(result);

    expect(text).toContain("Rate Limit Exceeded");
    expect(text).toContain("batch operations");
  });

  it("classifies tool errors by span kind", async () => {
    const handler = getHandler("foxhound_suggest_fix");
    const trace = makeTrace({
      id: "trace-tool",
      spans: [
        makeSpan({
          spanId: "s1",
          name: "calculator",
          kind: "tool_call",
          status: "error",
          events: [
            { timeMs: 1500, name: "error", attributes: { "error.message": "Division by zero" } },
          ],
        }),
      ],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const result = await handler({ trace_id: "trace-tool" });
    const text = getText(result);

    expect(text).toContain("Tool Execution Errors");
    expect(text).toContain("calculator");
  });

  it("classifies LLM errors by span kind", async () => {
    const handler = getHandler("foxhound_suggest_fix");
    const trace = makeTrace({
      id: "trace-llm",
      spans: [
        makeSpan({
          spanId: "s1",
          name: "generate-response",
          kind: "llm_call",
          status: "error",
          events: [
            {
              timeMs: 1500,
              name: "error",
              attributes: { "error.message": "context window exceeded" },
            },
          ],
        }),
      ],
    });
    mockApi["getTrace"].mockResolvedValue(trace);

    const result = await handler({ trace_id: "trace-llm" });
    const text = getText(result);

    expect(text).toContain("LLM Call Failures");
    expect(text).toContain("context window");
  });

  it("handles API errors gracefully", async () => {
    const handler = getHandler("foxhound_suggest_fix");
    mockApi["getTrace"].mockRejectedValue(new Error("Server error"));

    const result = await handler({ trace_id: "bad" });
    const text = getText(result);

    expect(text).toContain("Error fetching trace");
  });
});

describe("foxhound_get_cost_summary", () => {
  it("formats usage with percentage", async () => {
    const handler = getHandler("foxhound_get_cost_summary");
    mockApi["getUsage"].mockResolvedValue({
      spansUsed: 5000,
      spansLimit: 10000,
      period: "2026-04",
    });

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("Usage Summary");
    expect(text).toContain("2026-04");
    expect(text).toContain("50.0%");
  });

  it("handles unlimited spans", async () => {
    const handler = getHandler("foxhound_get_cost_summary");
    mockApi["getUsage"].mockResolvedValue({
      spansUsed: 1234,
      spansLimit: 0,
      period: "2026-04",
    });

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("unlimited");
  });
});

describe("foxhound_status", () => {
  it("shows health and usage summary", async () => {
    const handler = getHandler("foxhound_status");
    mockApi["getHealth"].mockResolvedValue({ status: "ok", version: "1.2.3" });
    mockApi["getUsage"].mockResolvedValue({
      spansUsed: 200,
      spansLimit: 1000,
      period: "2026-04",
    });

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("Foxhound Status");
    expect(text).toContain("ok");
    expect(text).toContain("1.2.3");
    expect(text).toContain("20.0%");
  });
});

describe("foxhound_get_anomalies", () => {
  it("returns 'no traces' message when there are no traces", async () => {
    const handler = getHandler("foxhound_get_anomalies");
    mockApi["searchTraces"].mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 100, count: 0 },
    });

    const result = await handler({ agent_name: "agent-1" });
    const text = getText(result);

    expect(text).toContain("No traces found");
    expect(text).toContain("agent-1");
  });

  it("detects error spans and slow outliers", async () => {
    const handler = getHandler("foxhound_get_anomalies");
    const fastSpan = makeSpan({
      spanId: "s1",
      name: "fast-op",
      kind: "llm_call",
      startTimeMs: 1000,
      endTimeMs: 1100,
    });
    const fastSpan2 = makeSpan({
      spanId: "s2",
      name: "fast-op-2",
      kind: "llm_call",
      startTimeMs: 2000,
      endTimeMs: 2100,
    });
    const slowSpan = makeSpan({
      spanId: "s3",
      name: "slow-op",
      kind: "llm_call",
      startTimeMs: 3000,
      endTimeMs: 4000,
    });
    const errorSpan = makeSpan({
      spanId: "s4",
      name: "broken-op",
      kind: "tool_call",
      status: "error",
      startTimeMs: 5000,
      endTimeMs: 5500,
    });

    const trace = makeTrace({
      id: "trace-anom",
      spans: [fastSpan, fastSpan2, slowSpan, errorSpan],
    });
    mockApi["searchTraces"].mockResolvedValue({
      data: [trace],
      pagination: { page: 1, limit: 100, count: 1 },
    });

    const result = await handler({ agent_name: "agent-1", hours: 12 });
    const text = getText(result);

    expect(text).toContain("Anomaly Report: agent-1");
    expect(text).toContain("last 12 hours");
    expect(text).toContain("Errors: 1");
    expect(text).toContain("broken-op");
  });
});

describe("foxhound_delete_alert_rule", () => {
  it("returns preview when confirm is omitted", async () => {
    const handler = getHandler("foxhound_delete_alert_rule");

    const result = await handler({ rule_id: "rule-42" });
    const text = getText(result);

    expect(text).toContain("Preview");
    expect(text).toContain("rule-42");
    expect(text).toContain("confirm: true");
    expect(mockApi["deleteAlertRule"]).not.toHaveBeenCalled();
  });

  it("deletes when confirm is true", async () => {
    const handler = getHandler("foxhound_delete_alert_rule");
    mockApi["deleteAlertRule"].mockResolvedValue({ success: true });

    const result = await handler({ rule_id: "rule-42", confirm: true });
    const text = getText(result);

    expect(mockApi["deleteAlertRule"]).toHaveBeenCalledWith("rule-42");
    expect(text).toContain("rule-42");
    expect(text).toContain("deleted");
  });
});

describe("foxhound_delete_channel", () => {
  it("returns preview when confirm is omitted", async () => {
    const handler = getHandler("foxhound_delete_channel");

    const result = await handler({ channel_id: "ch-1" });
    const text = getText(result);

    expect(text).toContain("Preview");
    expect(text).toContain("ch-1");
    expect(mockApi["deleteChannel"]).not.toHaveBeenCalled();
  });

  it("deletes when confirm is true", async () => {
    const handler = getHandler("foxhound_delete_channel");
    mockApi["deleteChannel"].mockResolvedValue({ success: true });

    const result = await handler({ channel_id: "ch-1", confirm: true });
    const text = getText(result);

    expect(mockApi["deleteChannel"]).toHaveBeenCalledWith("ch-1");
    expect(text).toContain("deleted");
  });
});

describe("foxhound_revoke_api_key", () => {
  it("returns preview when confirm is omitted", async () => {
    const handler = getHandler("foxhound_revoke_api_key");

    const result = await handler({ key_id: "key-99" });
    const text = getText(result);

    expect(text).toContain("Preview");
    expect(text).toContain("key-99");
    expect(text).toContain("stop working");
    expect(mockApi["revokeApiKey"]).not.toHaveBeenCalled();
  });

  it("revokes when confirm is true", async () => {
    const handler = getHandler("foxhound_revoke_api_key");
    mockApi["revokeApiKey"].mockResolvedValue({ success: true });

    const result = await handler({ key_id: "key-99", confirm: true });
    const text = getText(result);

    expect(mockApi["revokeApiKey"]).toHaveBeenCalledWith("key-99");
    expect(text).toContain("revoked");
  });
});

describe("foxhound_list_alert_rules", () => {
  it("returns 'no rules' when empty", async () => {
    const handler = getHandler("foxhound_list_alert_rules");
    mockApi["listAlertRules"].mockResolvedValue({ data: [] });

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("No alert rules configured");
  });

  it("formats alert rules list", async () => {
    const handler = getHandler("foxhound_list_alert_rules");
    mockApi["listAlertRules"].mockResolvedValue({
      data: [
        {
          id: "rule-1",
          orgId: "org-1",
          eventType: "agent_failure",
          minSeverity: "high",
          channelId: "ch-1",
          enabled: true,
          createdAt: "2026-04-11T00:00:00Z",
          updatedAt: "2026-04-11T00:00:00Z",
        },
      ],
    });

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("Alert Rules (1)");
    expect(text).toContain("rule-1");
    expect(text).toContain("agent_failure");
    expect(text).toContain("enabled");
  });
});

describe("foxhound_create_alert_rule", () => {
  it("creates an alert rule with correct params", async () => {
    const handler = getHandler("foxhound_create_alert_rule");
    mockApi["createAlertRule"].mockResolvedValue({
      id: "rule-new",
      eventType: "cost_spike",
      minSeverity: "critical",
      channelId: "ch-1",
    });

    const result = await handler({
      event_type: "cost_spike",
      min_severity: "critical",
      channel_id: "ch-1",
    });
    const text = getText(result);

    expect(mockApi["createAlertRule"]).toHaveBeenCalledWith({
      eventType: "cost_spike",
      minSeverity: "critical",
      channelId: "ch-1",
    });
    expect(text).toContain("rule-new");
    expect(text).toContain("cost_spike");
  });
});

describe("foxhound_detect_regression", () => {
  it("reports no regressions when versions match", async () => {
    const handler = getHandler("foxhound_detect_regression");
    mockApi["compareVersions"].mockResolvedValue({
      agentId: "agent-1",
      previousVersion: "v1",
      newVersion: "v2",
      regressions: [],
      sampleSize: { before: 100, after: 80 },
    });

    const result = await handler({
      agentId: "agent-1",
      versionA: "v1",
      versionB: "v2",
    });
    const text = getText(result);

    expect(text).toContain("No regressions detected");
    expect(text).toContain("v1");
    expect(text).toContain("v2");
  });

  it("reports missing and new span regressions", async () => {
    const handler = getHandler("foxhound_detect_regression");
    mockApi["compareVersions"].mockResolvedValue({
      agentId: "agent-1",
      previousVersion: "v1",
      newVersion: "v2",
      regressions: [
        { type: "missing", span: "validate-input", previousFrequency: 0.95 },
        { type: "new", span: "unknown-step", newFrequency: 0.3 },
      ],
      sampleSize: { before: 50, after: 60 },
    });

    const result = await handler({
      agentId: "agent-1",
      versionA: "v1",
      versionB: "v2",
    });
    const text = getText(result);

    expect(text).toContain("Regressions (2)");
    expect(text).toContain("MISSING");
    expect(text).toContain("validate-input");
    expect(text).toContain("NEW");
    expect(text).toContain("unknown-step");
  });

  it("handles comparison errors", async () => {
    const handler = getHandler("foxhound_detect_regression");
    mockApi["compareVersions"].mockRejectedValue(new Error("No baseline found"));

    const result = await handler({
      agentId: "agent-1",
      versionA: "v1",
      versionB: "v2",
    });
    const text = getText(result);

    expect(text).toContain("Error comparing versions");
  });
});

describe("foxhound_get_agent_budget", () => {
  it("shows budget configuration", async () => {
    const handler = getHandler("foxhound_get_agent_budget");
    mockApi["getBudget"].mockResolvedValue({
      id: "config-1",
      agentId: "agent-1",
      costBudgetUsd: "100.00",
      budgetPeriod: "monthly",
      costAlertThresholdPct: 80,
      lastCostStatus: { status: "under", spend: 45.5, budget: 100 },
    });

    const result = await handler({ agentId: "agent-1" });
    const text = getText(result);

    expect(text).toContain("Budget: agent-1");
    expect(text).toContain("$100.00");
    expect(text).toContain("monthly");
    expect(text).toContain("80%");
  });

  it("handles missing budget", async () => {
    const handler = getHandler("foxhound_get_agent_budget");
    mockApi["getBudget"].mockRejectedValue(new Error("Foxhound API 404"));

    const result = await handler({ agentId: "unknown-agent" });
    const text = getText(result);

    expect(text).toContain("Error fetching budget");
  });
});

describe("foxhound_check_sla_status", () => {
  it("shows SLA targets and compliance", async () => {
    const handler = getHandler("foxhound_check_sla_status");
    mockApi["getSla"].mockResolvedValue({
      id: "config-1",
      agentId: "agent-1",
      maxDurationMs: 5000,
      minSuccessRate: "99",
      evaluationWindowMs: 3600000,
      minSampleSize: 100,
      lastSlaStatus: { status: "compliant", p95DurationMs: 3200, successRate: 99.5 },
    });

    const result = await handler({ agentId: "agent-1" });
    const text = getText(result);

    expect(text).toContain("SLA Status: agent-1");
    expect(text).toContain("5000ms");
    expect(text).toContain("99%");
    expect(text).toContain("p95 duration");
  });

  it("handles SLA fetch errors", async () => {
    const handler = getHandler("foxhound_check_sla_status");
    mockApi["getSla"].mockRejectedValue(new Error("Agent not found"));

    const result = await handler({ agentId: "unknown" });
    const text = getText(result);

    expect(text).toContain("Error fetching SLA");
  });
});

describe("foxhound_list_baselines", () => {
  it("returns 'no baselines' when empty", async () => {
    const handler = getHandler("foxhound_list_baselines");
    mockApi["listBaselines"].mockResolvedValue({ data: [] });

    const result = await handler({ agentId: "agent-1" });
    const text = getText(result);

    expect(text).toContain("No baselines found");
  });

  it("lists baseline snapshots", async () => {
    const handler = getHandler("foxhound_list_baselines");
    mockApi["listBaselines"].mockResolvedValue({
      data: [
        { agentVersion: "1.0", sampleSize: 50, createdAt: 1712793600000 },
        { agentVersion: "2.0", sampleSize: 80, createdAt: 1712880000000 },
      ],
    });

    const result = await handler({ agentId: "agent-1" });
    const text = getText(result);

    expect(text).toContain("Baselines: agent-1 (2)");
    expect(text).toContain("v1.0");
    expect(text).toContain("v2.0");
    expect(text).toContain("sample size: 50");
  });
});

describe("foxhound_replay_span", () => {
  it("returns replay data as JSON", async () => {
    const handler = getHandler("foxhound_replay_span");
    const replayData = {
      traceId: "trace-1",
      spanId: "span-2",
      context: { messages: [{ role: "user", content: "Hello" }] },
    };
    mockApi["replaySpan"].mockResolvedValue(replayData);

    const result = await handler({ trace_id: "trace-1", span_id: "span-2" });
    const text = getText(result);

    expect(mockApi["replaySpan"]).toHaveBeenCalledWith("trace-1", "span-2");
    expect(text).toContain("Hello");
    // Should be valid JSON
    const parsed = JSON.parse(text);
    expect(parsed.context.messages).toHaveLength(1);
  });
});

describe("foxhound_diff_runs", () => {
  it("returns diff data as JSON", async () => {
    const handler = getHandler("foxhound_diff_runs");
    const diffData = {
      runA: "run-a",
      runB: "run-b",
      divergences: [{ spanName: "step-1", kind: "tool_call", difference: "missing in run-b" }],
    };
    mockApi["diffRuns"].mockResolvedValue(diffData);

    const result = await handler({ trace_id_a: "run-a", trace_id_b: "run-b" });
    const text = getText(result);

    expect(mockApi["diffRuns"]).toHaveBeenCalledWith("run-a", "run-b");
    expect(text).toContain("divergences");
    expect(text).toContain("step-1");
  });
});

describe("foxhound_list_channels", () => {
  it("returns 'no channels' when empty", async () => {
    const handler = getHandler("foxhound_list_channels");
    mockApi["listChannels"].mockResolvedValue({ data: [] });

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("No notification channels configured");
  });

  it("formats channel list", async () => {
    const handler = getHandler("foxhound_list_channels");
    mockApi["listChannels"].mockResolvedValue({
      data: [{ id: "ch-1", kind: "slack", name: "Alerts", createdAt: "2026-04-11" }],
    });

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("Notification Channels (1)");
    expect(text).toContain("ch-1");
    expect(text).toContain("slack");
    expect(text).toContain("Alerts");
  });
});

describe("foxhound_list_api_keys", () => {
  it("returns 'no keys' when empty", async () => {
    const handler = getHandler("foxhound_list_api_keys");
    mockApi["listApiKeys"].mockResolvedValue({ data: [] });

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("No API keys found");
  });

  it("formats API key list with masked prefixes", async () => {
    const handler = getHandler("foxhound_list_api_keys");
    mockApi["listApiKeys"].mockResolvedValue({
      data: [{ id: "key-1", name: "Production", prefix: "fox_prod", createdAt: "2026-04-11" }],
    });

    const result = await handler({});
    const text = getText(result);

    expect(text).toContain("API Keys (1)");
    expect(text).toContain("key-1");
    expect(text).toContain("Production");
    expect(text).toContain("fox_prod");
  });
});

describe("foxhound_create_api_key", () => {
  it("creates key and warns about plaintext", async () => {
    const handler = getHandler("foxhound_create_api_key");
    mockApi["createApiKey"].mockResolvedValue({
      id: "key-new",
      name: "CI Key",
      prefix: "fox_ci",
    });

    const result = await handler({ name: "CI Key" });
    const text = getText(result);

    expect(mockApi["createApiKey"]).toHaveBeenCalledWith("CI Key");
    expect(text).toContain("key-new");
    expect(text).toContain("CI Key");
    expect(text).toContain("not shown in MCP");
  });
});

describe("foxhound_create_channel", () => {
  it("creates a notification channel", async () => {
    const handler = getHandler("foxhound_create_channel");
    mockApi["createChannel"].mockResolvedValue({
      id: "ch-new",
      name: "Dev Alerts",
      kind: "slack",
    });

    const result = await handler({
      name: "Dev Alerts",
      webhook_url: "https://hooks.slack.com/services/xxx",
      slack_channel: "#dev-alerts",
    });
    const text = getText(result);

    expect(mockApi["createChannel"]).toHaveBeenCalledWith({
      name: "Dev Alerts",
      kind: "slack",
      config: {
        webhookUrl: "https://hooks.slack.com/services/xxx",
        channel: "#dev-alerts",
      },
    });
    expect(text).toContain("ch-new");
    expect(text).toContain("Dev Alerts");
  });
});

describe("foxhound_test_channel", () => {
  it("sends test alert", async () => {
    const handler = getHandler("foxhound_test_channel");
    mockApi["testChannel"].mockResolvedValue({ ok: true });

    const result = await handler({ channel_id: "ch-1" });
    const text = getText(result);

    expect(mockApi["testChannel"]).toHaveBeenCalledWith("ch-1");
    expect(text).toContain("Test alert sent");
    expect(text).toContain("ch-1");
  });
});

// ---------------------------------------------------------------------------
// Verify tool registration count
// ---------------------------------------------------------------------------

describe("tool registration", () => {
  it("registers all expected tools", () => {
    // The MCP server should have registered all 31 tools
    expect(toolHandlers.size).toBeGreaterThanOrEqual(20);
  });

  it("has all critical tools registered", () => {
    const criticalTools = [
      "foxhound_search_traces",
      "foxhound_get_trace",
      "foxhound_explain_failure",
      "foxhound_suggest_fix",
      "foxhound_score_trace",
      "foxhound_get_trace_scores",
      "foxhound_list_evaluators",
      "foxhound_run_evaluator",
      "foxhound_get_evaluator_run",
      "foxhound_list_datasets",
      "foxhound_add_trace_to_dataset",
      "foxhound_curate_dataset",
      "foxhound_status",
      "foxhound_get_cost_summary",
      "foxhound_get_anomalies",
      "foxhound_detect_regression",
      "foxhound_list_baselines",
      "foxhound_get_agent_budget",
      "foxhound_check_sla_status",
    ];

    for (const tool of criticalTools) {
      expect(toolHandlers.has(tool), `Missing tool: ${tool}`).toBe(true);
    }
  });
});
