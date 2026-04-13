import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { apiKeysRoutes } from "./apiKeys.js";
import { registerAuth } from "../plugins/auth.js";
import type { JwtPayload } from "../plugins/auth.js";

vi.mock("@foxhound/db", () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  revokeApiKey: vi.fn(),
  generateApiKey: vi.fn(() => ({ key: "sk-abc123", prefix: "sk-abc123xx", keyHash: "hashval" })),
  resolveApiKey: vi.fn(),
  touchApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import * as db from "@foxhound/db";

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(apiKeysRoutes);
  return app;
}

async function getJwt(app: ReturnType<typeof buildApp>, payload: JwtPayload): Promise<string> {
  await app.ready();
  return app.jwt.sign(payload);
}

describe("POST /v1/api-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without JWT", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/v1/api-keys", body: { name: "My Key" } });
    expect(res.statusCode).toBe(401);
  });

  it("creates API key and returns plaintext key once", async () => {
    vi.mocked(db.createApiKey).mockResolvedValue({
      id: "key_1",
      orgId: "org_1",
      keyHash: "hashval",
      prefix: "sk-abc123xx",
      name: "My Key",
      createdByUserId: "u1",
      revokedAt: null,
      expiresAt: null,
      scopes: null,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });

    const res = await app.inject({
      method: "POST",
      url: "/v1/api-keys",
      headers: { authorization: `Bearer ${token}` },
      body: { name: "My Key" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.key).toBe("sk-abc123");
    expect(body.prefix).toBe("sk-abc123xx");
  });
});

describe("GET /v1/api-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without JWT", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/api-keys" });
    expect(res.statusCode).toBe(401);
  });

  it("lists keys for the authenticated org only", async () => {
    const mockKeys = [
      {
        id: "key_1",
        orgId: "org_1",
        prefix: "sk-abc123xx",
        name: "Key A",
        createdByUserId: "u1",
        revokedAt: null,
        expiresAt: null,
        scopes: null,
        lastUsedAt: null,
        createdAt: new Date(),
        isExpired: false,
      },
    ];
    vi.mocked(db.listApiKeys).mockResolvedValue(mockKeys);

    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });

    const res = await app.inject({
      method: "GET",
      url: "/v1/api-keys",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    // Verify it only queried for org_1
    expect(vi.mocked(db.listApiKeys)).toHaveBeenCalledWith("org_1");
    const body = res.json();
    expect(body.data).toHaveLength(1);
  });

  it("does not leak keys across orgs", async () => {
    vi.mocked(db.listApiKeys).mockResolvedValue([]);

    const app = buildApp();
    // org_2 token — should only see org_2 keys
    const token = await getJwt(app, { userId: "u2", orgId: "org_2" });

    await app.inject({
      method: "GET",
      url: "/v1/api-keys",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(vi.mocked(db.listApiKeys)).toHaveBeenCalledWith("org_2");
    expect(vi.mocked(db.listApiKeys)).not.toHaveBeenCalledWith("org_1");
  });
});

describe("DELETE /v1/api-keys/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for key not in org", async () => {
    vi.mocked(db.revokeApiKey).mockResolvedValue(false);
    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });

    const res = await app.inject({
      method: "DELETE",
      url: "/v1/api-keys/key_999",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it("revokes the key scoped to the authenticated org", async () => {
    vi.mocked(db.revokeApiKey).mockResolvedValue(true);
    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });

    const res = await app.inject({
      method: "DELETE",
      url: "/v1/api-keys/key_1",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(db.revokeApiKey)).toHaveBeenCalledWith("key_1", "org_1");
  });
});
