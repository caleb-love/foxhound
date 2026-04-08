import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { authRoutes } from "./auth.js";
import { registerAuth } from "../plugins/auth.js";
import type { JwtPayload } from "../plugins/auth.js";

// Mock @foxhound/db
vi.mock("@foxhound/db", () => ({
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  getMembershipsByUser: vi.fn(),
  signup: vi.fn(),
  hashPassword: vi.fn((p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(),
  resolveApiKey: vi.fn(),
  getSsoConfigByOrg: vi.fn().mockResolvedValue(null),
}));

import * as db from "@foxhound/db";

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(authRoutes);
  return app;
}

describe("POST /v1/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid body", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/signup",
      body: { email: "not-an-email" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 409 if email already registered", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      passwordHash: "x",
      name: "A",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/signup",
      body: { name: "Alice", email: "a@b.com", password: "password123", orgName: "ACME" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("creates user + org and returns token on success", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(null);
    vi.mocked(db.signup).mockResolvedValue({
      org: {
        id: "org_1",
        name: "ACME",
        slug: "acme",
        plan: "free" as const,
        stripeCustomerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      user: {
        id: "usr_1",
        email: "a@b.com",
        name: "Alice",
        passwordHash: "hashed:password123",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/signup",
      body: { name: "Alice", email: "a@b.com", password: "password123", orgName: "ACME" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe("a@b.com");
    expect(body.org.slug).toBe("acme");
  });
});

describe("POST /v1/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unknown email", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(null);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      body: { email: "unknown@x.com", password: "pass1234" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 for wrong password", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      passwordHash: "hashed:correctpass",
      name: "Alice",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.verifyPassword).mockReturnValue(false);
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      body: { email: "a@b.com", password: "wrongpass" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 for invalid login body", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      body: { email: "not-an-email" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns token on valid credentials", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      passwordHash: "hashed:correctpass",
      name: "Alice",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.verifyPassword).mockReturnValue(true);
    vi.mocked(db.getMembershipsByUser).mockResolvedValue([
      {
        org: {
          id: "org_1",
          name: "ACME",
          slug: "acme",
          plan: "free" as const,
          stripeCustomerId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        role: "owner",
      },
    ]);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      body: { email: "a@b.com", password: "correctpass" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.id).toBe("u1");
  });
});

describe("GET /v1/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function getJwt(app: ReturnType<typeof buildApp>, payload: JwtPayload): Promise<string> {
    await app.ready();
    return app.jwt.sign(payload);
  }

  it("returns 401 without JWT", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("returns user and org for valid JWT", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "Alice",
      passwordHash: "hash",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.getMembershipsByUser).mockResolvedValue([
      {
        org: {
          id: "org_1",
          name: "ACME",
          slug: "acme",
          plan: "free" as const,
          stripeCustomerId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        role: "owner",
      },
    ]);

    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });
    const res = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.id).toBe("u1");
    expect(body.user.email).toBe("a@b.com");
    expect(body.org.id).toBe("org_1");
    expect(body.role).toBe("owner");
  });

  it("returns 404 when user not found", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(null);

    const app = buildApp();
    const token = await getJwt(app, { userId: "u_ghost", orgId: "org_1" });
    const res = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });
});
