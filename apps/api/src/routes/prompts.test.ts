import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { promptsRoutes } from "./prompts.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  touchApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
  createPrompt: vi.fn(),
  listPrompts: vi.fn(),
  countPrompts: vi.fn(),
  getPrompt: vi.fn(),
  getPromptByName: vi.fn(),
  deletePrompt: vi.fn(),
  createPromptVersion: vi.fn(),
  listPromptVersions: vi.fn(),
  getPromptVersionByNumber: vi.fn(),
  getPromptVersionByLabel: vi.fn(),
  diffPromptVersions: vi.fn(),
  setPromptLabel: vi.fn(),
  getLabelsForVersions: vi.fn(),
  deletePromptLabel: vi.fn(),
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const makeUniqueViolation = (constraint: string) => {
  const error = new Error("duplicate key value violates unique constraint");
  Object.assign(error, { code: "23505", constraint });
  return error;
};

vi.mock("@foxhound/billing", () => ({
  getEntitlements: vi.fn().mockResolvedValue({
    canReplay: true,
    canRunDiff: true,
    canAuditLog: true,
    canEvaluate: true,
    canManagePrompts: true,
    maxSpans: -1,
    maxProjects: -1,
    maxSeats: -1,
    retentionDays: 365,
  }),
  invalidateEntitlements: vi.fn(),
}));

import * as db from "@foxhound/db";

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(promptsRoutes);
  return app;
}

function mockApiKey(orgId = "org_1", scopes: string | null = null) {
  vi.mocked(db.resolveApiKey).mockResolvedValue({
    apiKey: {
      id: "key_1",
      orgId,
      keyHash: "hash",
      prefix: "sk-test",
      name: "Test Key",
      createdByUserId: null,
      revokedAt: null,
      expiresAt: null,
      scopes,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    org: {
      id: orgId,
      name: "Test Org",
      slug: "test-org",
      plan: "pro" as const,
      stripeCustomerId: null,
      retentionDays: 90,
      samplingRate: 1.0,
      llmEvaluationEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

const headers = { authorization: "Bearer sk-testkey123" };

// ── Prompt CRUD ───────────────────────────────────────────────────────────

describe("POST /v1/prompts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a prompt", async () => {
    mockApiKey();
    vi.mocked(db.getPromptByName).mockResolvedValue(null);
    const created = {
      id: "pmt_123",
      orgId: "org_1",
      name: "support-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(db.createPrompt).mockResolvedValue(created);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/prompts",
      headers,
      payload: { name: "support-agent" },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject({ name: "support-agent" });
  });

  it("rejects duplicate name", async () => {
    mockApiKey();
    vi.mocked(db.getPromptByName).mockResolvedValue({
      id: "pmt_existing",
      orgId: "org_1",
      name: "support-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/prompts",
      headers,
      payload: { name: "support-agent" },
    });

    expect(res.statusCode).toBe(409);
  });

  it("rejects invalid name with spaces", async () => {
    mockApiKey();
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/prompts",
      headers,
      payload: { name: "has spaces" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 409 when db unique constraint fires", async () => {
    mockApiKey();
    vi.mocked(db.getPromptByName).mockResolvedValue(null);
    vi.mocked(db.createPrompt).mockRejectedValue(makeUniqueViolation("prompts_org_name_unique"));

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/prompts",
      headers,
      payload: { name: "support-agent" },
    });

    expect(res.statusCode).toBe(409);
  });

  it("returns 401 without auth header", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/prompts",
      payload: { name: "support-agent" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 403 when api key lacks prompts:write scope", async () => {
    mockApiKey("org_1", "prompts:read");

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/prompts",
      headers,
      payload: { name: "support-agent" },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toContain("prompts:write");
  });
});

describe("GET /v1/prompts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists prompts for the org", async () => {
    mockApiKey();
    vi.mocked(db.listPrompts).mockResolvedValue([]);
    vi.mocked(db.countPrompts).mockResolvedValue(12);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts",
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ data: [], pagination: { count: 12 } });
    expect(vi.mocked(db.listPrompts)).toHaveBeenCalledWith({
      orgId: "org_1",
      page: 1,
      limit: 50,
      searchQuery: undefined,
      promptIds: undefined,
    });
    expect(vi.mocked(db.countPrompts)).toHaveBeenCalledWith({
      orgId: "org_1",
      page: 1,
      limit: 50,
      searchQuery: undefined,
      promptIds: undefined,
    });
  });

  it("passes pagination params through to listPrompts", async () => {
    mockApiKey();
    vi.mocked(db.listPrompts).mockResolvedValue([]);
    vi.mocked(db.countPrompts).mockResolvedValue(23);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts?page=2&limit=10",
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(db.listPrompts)).toHaveBeenCalledWith({
      orgId: "org_1",
      page: 2,
      limit: 10,
      searchQuery: undefined,
      promptIds: undefined,
    });
    expect(vi.mocked(db.countPrompts)).toHaveBeenCalledWith({
      orgId: "org_1",
      page: 2,
      limit: 10,
      searchQuery: undefined,
      promptIds: undefined,
    });
    expect(JSON.parse(res.body).pagination).toMatchObject({ page: 2, limit: 10, count: 23 });
  });

  it("accepts shared-style search and promptId filters without applying default time-window semantics", async () => {
    mockApiKey();
    vi.mocked(db.listPrompts).mockResolvedValue([]);
    vi.mocked(db.countPrompts).mockResolvedValue(0);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts?q=support&promptId=support-agent&start=2026-04-15T00:00:00.000Z&end=2026-04-16T00:00:00.000Z&status=error",
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(db.listPrompts)).toHaveBeenCalledWith({
      orgId: "org_1",
      page: 1,
      limit: 50,
      searchQuery: "support",
      promptIds: ["support-agent"],
    });
    expect(vi.mocked(db.countPrompts)).toHaveBeenCalledWith({
      orgId: "org_1",
      page: 1,
      limit: 50,
      searchQuery: "support",
      promptIds: ["support-agent"],
    });
  });

  it("returns 403 when api key lacks prompts:read scope", async () => {
    mockApiKey("org_1", "scores:read");

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts",
      headers,
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toContain("prompts:read");
  });
});

describe("GET /v1/prompts/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a single prompt", async () => {
    mockApiKey();
    vi.mocked(db.getPrompt).mockResolvedValue({
      id: "pmt_123",
      orgId: "org_1",
      name: "support-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts/pmt_123",
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ id: "pmt_123", name: "support-agent" });
  });

  it("returns 404 for missing prompt", async () => {
    mockApiKey();
    vi.mocked(db.getPrompt).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts/pmt_missing",
      headers,
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /v1/prompts/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a prompt", async () => {
    mockApiKey();
    vi.mocked(db.deletePrompt).mockResolvedValue(true);

    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/prompts/pmt_123",
      headers,
    });

    expect(res.statusCode).toBe(204);
  });

  it("returns 404 for non-existent prompt", async () => {
    mockApiKey();
    vi.mocked(db.deletePrompt).mockResolvedValue(false);

    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/prompts/pmt_missing",
      headers,
    });

    expect(res.statusCode).toBe(404);
  });
});

// ── Versions ──────────────────────────────────────────────────────────────

describe("POST /v1/prompts/:id/versions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new version", async () => {
    mockApiKey();
    vi.mocked(db.getPrompt).mockResolvedValue({
      id: "pmt_123",
      orgId: "org_1",
      name: "support-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.createPromptVersion).mockResolvedValue({
      id: "pmv_2",
      promptId: "pmt_123",
      version: 3,
      content: "You are a helpful support agent...",
      model: "gpt-4o",
      config: {},
      createdAt: new Date(),
      createdBy: null,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/prompts/pmt_123/versions",
      headers,
      payload: {
        content: "You are a helpful support agent...",
        model: "gpt-4o",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject({ version: 3 });
    expect(vi.mocked(db.createPromptVersion)).toHaveBeenCalledWith(
      expect.objectContaining({ promptId: "pmt_123", orgId: "org_1" }),
    );
  });

  it("returns 404 for non-existent prompt", async () => {
    mockApiKey();
    vi.mocked(db.getPrompt).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/prompts/pmt_missing/versions",
      headers,
      payload: { content: "hello" },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /v1/prompts/:id/versions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists versions with batch-fetched labels", async () => {
    mockApiKey();
    vi.mocked(db.getPrompt).mockResolvedValue({
      id: "pmt_123",
      orgId: "org_1",
      name: "support-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.listPromptVersions).mockResolvedValue([
      {
        id: "pmv_1",
        promptId: "pmt_123",
        version: 1,
        content: "v1",
        model: null,
        config: {},
        createdAt: new Date(),
        createdBy: null,
      },
      {
        id: "pmv_2",
        promptId: "pmt_123",
        version: 2,
        content: "v2",
        model: "gpt-4o",
        config: { temperature: 0.2 },
        createdAt: new Date(),
        createdBy: null,
      },
    ]);
    vi.mocked(db.getLabelsForVersions).mockResolvedValue([
      { promptVersionId: "pmv_1", label: "production" },
      { promptVersionId: "pmv_2", label: "staging" },
      { promptVersionId: "pmv_2", label: "candidate" },
    ] as never);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts/pmt_123/versions",
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({ id: "pmv_1", labels: ["production"] });
    expect(body.data[1]).toMatchObject({ id: "pmv_2", labels: ["staging", "candidate"] });
    expect(vi.mocked(db.getLabelsForVersions)).toHaveBeenCalledWith(["pmv_1", "pmv_2"]);
  });

  it("returns 404 when prompt is missing", async () => {
    mockApiKey();
    vi.mocked(db.getPrompt).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts/pmt_missing/versions",
      headers,
    });

    expect(res.statusCode).toBe(404);
  });
});

// ── Labels ────────────────────────────────────────────────────────────────

describe("GET /v1/prompts/:id/diff", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a structured diff for two prompt versions", async () => {
    mockApiKey();
    vi.mocked(db.getPrompt).mockResolvedValue({
      id: "pmt_123",
      orgId: "org_1",
      name: "support-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.diffPromptVersions).mockResolvedValue({
      promptId: "pmt_123",
      versionA: 1,
      versionB: 2,
      hasChanges: true,
      changes: [
        {
          field: "content",
          before: "Be concise.",
          after: "Be concise and cite sources.",
        },
      ],
    });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts/pmt_123/diff?versionA=1&versionB=2",
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      promptId: "pmt_123",
      promptName: "support-agent",
      versionA: 1,
      versionB: 2,
      hasChanges: true,
      changes: [
        {
          field: "content",
          before: "Be concise.",
          after: "Be concise and cite sources.",
        },
      ],
    });
  });

  it("returns 404 when prompt is missing", async () => {
    mockApiKey();
    vi.mocked(db.getPrompt).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts/pmt_missing/diff?versionA=1&versionB=2",
      headers,
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when one or both versions are missing", async () => {
    mockApiKey();
    vi.mocked(db.getPrompt).mockResolvedValue({
      id: "pmt_123",
      orgId: "org_1",
      name: "support-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.diffPromptVersions).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts/pmt_123/diff?versionA=1&versionB=99",
      headers,
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for invalid query params", async () => {
    mockApiKey();
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts/pmt_123/diff?versionA=0&versionB=2",
      headers,
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 403 when api key lacks prompts:read scope", async () => {
    mockApiKey("org_1", "scores:read");

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts/pmt_123/diff?versionA=1&versionB=2",
      headers,
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toContain("prompts:read");
  });
});

describe("POST /v1/prompts/:id/labels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets a label on a version", async () => {
    mockApiKey();
    vi.mocked(db.getPrompt).mockResolvedValue({
      id: "pmt_123",
      orgId: "org_1",
      name: "support-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.getPromptVersionByNumber).mockResolvedValue({
      id: "pmv_1",
      promptId: "pmt_123",
      version: 1,
      content: "content",
      model: null,
      config: {},
      createdAt: new Date(),
      createdBy: null,
    });
    vi.mocked(db.setPromptLabel).mockResolvedValue({
      id: "pml_1",
      promptVersionId: "pmv_1",
      label: "production",
      createdAt: new Date(),
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/prompts/pmt_123/labels",
      headers,
      payload: { label: "production", versionNumber: 1 },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toContain("production");
  });

  it("returns 404 for missing version", async () => {
    mockApiKey();
    vi.mocked(db.getPrompt).mockResolvedValue({
      id: "pmt_123",
      orgId: "org_1",
      name: "support-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.getPromptVersionByNumber).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/prompts/pmt_123/labels",
      headers,
      payload: { label: "production", versionNumber: 99 },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ── SDK Resolution ────────────────────────────────────────────────────────

describe("DELETE /v1/prompts/:id/labels/:label", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes an existing label", async () => {
    mockApiKey();
    vi.mocked(db.getPrompt).mockResolvedValue({
      id: "pmt_123",
      orgId: "org_1",
      name: "support-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.getPromptVersionByLabel).mockResolvedValue({
      id: "pmv_2",
      promptId: "pmt_123",
      version: 2,
      content: "content",
      model: null,
      config: {},
      createdAt: new Date(),
      createdBy: null,
    });
    vi.mocked(db.deletePromptLabel).mockResolvedValue(true);

    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/prompts/pmt_123/labels/production",
      headers,
    });

    expect(res.statusCode).toBe(204);
    expect(vi.mocked(db.deletePromptLabel)).toHaveBeenCalledWith("pmv_2", "production");
  });

  it("returns 404 when prompt is missing", async () => {
    mockApiKey();
    vi.mocked(db.getPrompt).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/prompts/pmt_missing/labels/production",
      headers,
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when label is missing", async () => {
    mockApiKey();
    vi.mocked(db.getPrompt).mockResolvedValue({
      id: "pmt_123",
      orgId: "org_1",
      name: "support-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.getPromptVersionByLabel).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/prompts/pmt_123/labels/production",
      headers,
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when label resolves to another prompt", async () => {
    mockApiKey();
    vi.mocked(db.getPrompt).mockResolvedValue({
      id: "pmt_123",
      orgId: "org_1",
      name: "support-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.getPromptVersionByLabel).mockResolvedValue({
      id: "pmv_other",
      promptId: "pmt_other",
      version: 1,
      content: "content",
      model: null,
      config: {},
      createdAt: new Date(),
      createdBy: null,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/prompts/pmt_123/labels/production",
      headers,
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /v1/prompts/resolve", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves prompt by name and label", async () => {
    mockApiKey();
    vi.mocked(db.getPromptVersionByLabel).mockResolvedValue({
      id: "pmv_1",
      promptId: "pmt_123",
      version: 3,
      content: "You are a helpful support agent...",
      model: "gpt-4o",
      config: { temperature: 0.7 },
      createdAt: new Date(),
      createdBy: null,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts/resolve?name=support-agent&label=production",
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      name: "support-agent",
      label: "production",
      version: 3,
      content: "You are a helpful support agent...",
      model: "gpt-4o",
    });
  });

  it("serves repeated resolves successfully for the same prompt key", async () => {
    mockApiKey();
    vi.mocked(db.getPromptVersionByLabel).mockResolvedValue({
      id: "pmv_1",
      promptId: "pmt_123",
      version: 3,
      content: "You are a helpful support agent...",
      model: "gpt-4o",
      config: { temperature: 0.7 },
      createdAt: new Date(),
      createdBy: null,
    });

    const app = buildApp();

    const first = await app.inject({
      method: "GET",
      url: "/v1/prompts/resolve?name=support-agent&label=production",
      headers,
    });
    const second = await app.inject({
      method: "GET",
      url: "/v1/prompts/resolve?name=support-agent&label=production",
      headers,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body)).toMatchObject({
      name: "support-agent",
      label: "production",
      version: 3,
    });
  });

  it("defaults to production label", async () => {
    mockApiKey();
    vi.mocked(db.getPromptVersionByLabel).mockResolvedValue({
      id: "pmv_default_label",
      promptId: "pmt_default_label",
      version: 1,
      content: "content",
      model: null,
      config: {},
      createdAt: new Date(),
      createdBy: null,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts/resolve?name=support-agent-default-label-check",
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      name: "support-agent-default-label-check",
      label: "production",
      version: 1,
    });
  });

  it("returns 404 when prompt not found", async () => {
    mockApiKey();
    vi.mocked(db.getPromptVersionByLabel).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts/resolve?name=missing&label=production",
      headers,
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when name is missing", async () => {
    mockApiKey();
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts/resolve",
      headers,
    });

    expect(res.statusCode).toBe(400);
  });
});
