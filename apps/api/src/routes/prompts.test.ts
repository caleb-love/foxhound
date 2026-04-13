import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { promptsRoutes } from "./prompts.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  touchApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
  createPrompt: vi.fn(),
  listPrompts: vi.fn(),
  getPrompt: vi.fn(),
  getPromptByName: vi.fn(),
  deletePrompt: vi.fn(),
  createPromptVersion: vi.fn(),
  listPromptVersions: vi.fn(),
  getPromptVersionByNumber: vi.fn(),
  getPromptVersionByLabel: vi.fn(),
  setPromptLabel: vi.fn(),
  getLabelsForVersions: vi.fn(),
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

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

function mockApiKey(orgId = "org_1") {
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
      scopes: null,
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
});

describe("GET /v1/prompts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists prompts for the org", async () => {
    mockApiKey();
    vi.mocked(db.listPrompts).mockResolvedValue([]);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/prompts",
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ data: [] });
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

// ── Labels ────────────────────────────────────────────────────────────────

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

  it("defaults to production label", async () => {
    mockApiKey();
    vi.mocked(db.getPromptVersionByLabel).mockResolvedValue({
      id: "pmv_1",
      promptId: "pmt_123",
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
      url: "/v1/prompts/resolve?name=support-agent",
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(db.getPromptVersionByLabel)).toHaveBeenCalledWith(
      "org_1",
      "support-agent",
      "production",
    );
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
