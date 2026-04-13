import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerAuth } from "../plugins/auth.js";
import { waitlistRoutes } from "./waitlist.js";

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  touchApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
  insertWaitlistSignup: vi.fn(),
}));

import * as db from "@foxhound/db";

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(waitlistRoutes);
  return app;
}

describe("POST /v1/waitlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 for valid email signup", async () => {
    vi.mocked(db.insertWaitlistSignup).mockResolvedValue({ alreadyExists: false });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/waitlist",
      body: { email: "alice@example.com" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.alreadyExists).toBe(false);
    expect(vi.mocked(db.insertWaitlistSignup)).toHaveBeenCalledOnce();
    expect(vi.mocked(db.insertWaitlistSignup)).toHaveBeenCalledWith(
      expect.any(String),
      "alice@example.com",
    );
  });

  it("returns 200 and alreadyExists:true for duplicate", async () => {
    vi.mocked(db.insertWaitlistSignup).mockResolvedValue({ alreadyExists: true });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/waitlist",
      body: { email: "alice@example.com" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.alreadyExists).toBe(true);
  });

  it("returns 400 for invalid email", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/waitlist",
      body: { email: "not-an-email" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe("Bad Request");
    expect(body.issues).toBeDefined();
    expect(vi.mocked(db.insertWaitlistSignup)).not.toHaveBeenCalled();
  });

  it("returns 400 for missing body", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/waitlist",
      body: {},
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe("Bad Request");
    expect(vi.mocked(db.insertWaitlistSignup)).not.toHaveBeenCalled();
  });
});
