import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import { ssoRoutes } from "./sso.js";
import { registerAuth } from "../plugins/auth.js";
import type { JwtPayload } from "../plugins/auth.js";

// Mock @foxhound/db
vi.mock("@foxhound/db", () => ({
  getSsoConfigByOrg: vi.fn(),
  upsertSsoConfig: vi.fn(),
  deleteSsoConfig: vi.fn(),
  updateSsoEnforcement: vi.fn(),
  jitProvisionUser: vi.fn(),
  createSsoSession: vi.fn(),
  deleteSsoSessionsByUser: vi.fn(),
  getOrganizationBySlug: vi.fn(),
  resolveApiKey: vi.fn(),
  touchApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import * as db from "@foxhound/db";

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  process.env["APP_BASE_URL"] = "http://localhost:3001";
  process.env["FRONTEND_URL"] = "http://localhost:3000";
  registerAuth(app);
  void app.register(ssoRoutes);
  return app;
}

async function getJwt(app: ReturnType<typeof buildApp>, payload: JwtPayload): Promise<string> {
  await app.ready();
  return app.jwt.sign(payload);
}

const mockOrg = {
  id: "org_1",
  name: "ACME",
  slug: "acme",
  plan: "enterprise" as const,
  stripeCustomerId: null,
  retentionDays: 90,
  samplingRate: 1.0,
  llmEvaluationEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSsoConfig = {
  id: "sso_1",
  orgId: "org_1",
  provider: "saml" as const,
  config: {
    entryPoint: "https://idp.example.com/sso",
    issuer: "foxhound-sp",
    cert: "MIIC...",
  },
  enforceSso: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockOidcConfig = {
  id: "sso_2",
  orgId: "org_1",
  provider: "oidc" as const,
  config: {
    issuer: "https://login.microsoftonline.com/tenant-id/v2.0",
    clientId: "client-123",
    clientSecret: "secret-456",
  },
  enforceSso: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

afterEach(() => {
  delete process.env["OIDC_STATE_SECRET"];
  fetchMock.mockReset();
});

// ──────────────────────────────────────────────────────────────────────────────
// SSO Config Management (JWT-authenticated)
// ──────────────────────────────────────────────────────────────────────────────

describe("GET /v1/sso/config", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without JWT", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/sso/config" });
    expect(res.statusCode).toBe(401);
  });

  it("returns configured=false when no SSO config exists", async () => {
    vi.mocked(db.getSsoConfigByOrg).mockResolvedValue(null);
    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });
    const res = await app.inject({
      method: "GET",
      url: "/v1/sso/config",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().configured).toBe(false);
  });

  it("returns config with redacted secrets for SAML", async () => {
    vi.mocked(db.getSsoConfigByOrg).mockResolvedValue(mockSsoConfig);
    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });
    const res = await app.inject({
      method: "GET",
      url: "/v1/sso/config",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.configured).toBe(true);
    expect(body.provider).toBe("saml");
    expect(body.enforceSso).toBe(false);
  });

  it("redacts clientSecret for OIDC config", async () => {
    vi.mocked(db.getSsoConfigByOrg).mockResolvedValue(mockOidcConfig);
    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });
    const res = await app.inject({
      method: "GET",
      url: "/v1/sso/config",
      headers: { authorization: `Bearer ${token}` },
    });
    const body = res.json();
    expect(body.config.clientSecret).toBe("••••••••");
    expect(body.config.clientId).toBe("client-123");
  });
});

describe("PUT /v1/sso/config", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid config", async () => {
    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });
    const res = await app.inject({
      method: "PUT",
      url: "/v1/sso/config",
      headers: { authorization: `Bearer ${token}` },
      body: { provider: "invalid" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("creates SAML config successfully", async () => {
    vi.mocked(db.upsertSsoConfig).mockResolvedValue(mockSsoConfig);
    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });
    const res = await app.inject({
      method: "PUT",
      url: "/v1/sso/config",
      headers: { authorization: `Bearer ${token}` },
      body: {
        provider: "saml",
        entryPoint: "https://idp.example.com/sso",
        issuer: "foxhound-sp",
        cert: "MIIC...",
      },
    });
    if (res.statusCode === 500) console.error(res.body);
    expect(res.statusCode).toBe(200);
    expect(res.json().provider).toBe("saml");
    expect(db.upsertSsoConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org_1",
        provider: "saml",
        config: {
          entryPoint: "https://idp.example.com/sso",
          issuer: "foxhound-sp",
          cert: "MIIC...",
        },
      }),
    );
  });

  it("creates OIDC config successfully", async () => {
    vi.mocked(db.upsertSsoConfig).mockResolvedValue(mockOidcConfig);
    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });
    const res = await app.inject({
      method: "PUT",
      url: "/v1/sso/config",
      headers: { authorization: `Bearer ${token}` },
      body: {
        provider: "oidc",
        issuer: "https://login.microsoftonline.com/tenant-id/v2.0",
        clientId: "client-123",
        clientSecret: "secret-456",
      },
    });
    if (res.statusCode === 500) console.error(res.body);
    expect(res.statusCode).toBe(200);
    expect(res.json().provider).toBe("oidc");
  });
});

describe("DELETE /v1/sso/config", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when no config exists", async () => {
    vi.mocked(db.deleteSsoConfig).mockResolvedValue(false);
    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/sso/config",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("deletes config successfully", async () => {
    vi.mocked(db.deleteSsoConfig).mockResolvedValue(true);
    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/sso/config",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().deleted).toBe(true);
  });
});

describe("PATCH /v1/sso/enforce", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid body", async () => {
    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });
    const res = await app.inject({
      method: "PATCH",
      url: "/v1/sso/enforce",
      headers: { authorization: `Bearer ${token}` },
      body: { enforce: "yes" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when SSO not configured", async () => {
    vi.mocked(db.updateSsoEnforcement).mockResolvedValue(null);
    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });
    const res = await app.inject({
      method: "PATCH",
      url: "/v1/sso/enforce",
      headers: { authorization: `Bearer ${token}` },
      body: { enforce: true },
    });
    expect(res.statusCode).toBe(404);
  });

  it("enables SSO enforcement", async () => {
    vi.mocked(db.updateSsoEnforcement).mockResolvedValue({
      ...mockSsoConfig,
      enforceSso: true,
      updatedAt: new Date(),
    });
    const app = buildApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });
    const res = await app.inject({
      method: "PATCH",
      url: "/v1/sso/enforce",
      headers: { authorization: `Bearer ${token}` },
      body: { enforce: true },
    });
    if (res.statusCode === 500) console.error(res.body);
    expect(res.statusCode).toBe(200);
    expect(res.json().enforceSso).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SSO Login Initiation
// ──────────────────────────────────────────────────────────────────────────────

describe("GET /v1/sso/login/:orgSlug", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for unknown org slug", async () => {
    vi.mocked(db.getOrganizationBySlug).mockResolvedValue(null);
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/sso/login/unknown-org" });
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when SSO not configured for org", async () => {
    vi.mocked(db.getOrganizationBySlug).mockResolvedValue(mockOrg);
    vi.mocked(db.getSsoConfigByOrg).mockResolvedValue(null);
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/sso/login/acme" });
    expect(res.statusCode).toBe(404);
  });

  it("redirects to SAML IdP for SAML-configured org", async () => {
    vi.mocked(db.getOrganizationBySlug).mockResolvedValue(mockOrg);
    vi.mocked(db.getSsoConfigByOrg).mockResolvedValue(mockSsoConfig);
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/v1/sso/login/acme" });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("https://idp.example.com/sso");
    expect(res.headers.location).toContain("SAMLRequest=");
    expect(res.headers.location).toContain("RelayState=");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SAML Callback
// ──────────────────────────────────────────────────────────────────────────────

describe("POST /v1/sso/callback/saml", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for missing SAMLResponse", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/sso/callback/saml",
      body: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for invalid RelayState", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/sso/callback/saml",
      body: {
        SAMLResponse: Buffer.from("<saml:NameID>user@acme.com</saml:NameID>").toString("base64"),
        RelayState: "not-valid-base64-json",
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when SAML not configured for org", async () => {
    vi.mocked(db.getSsoConfigByOrg).mockResolvedValue(null);
    const app = buildApp();
    const relayState = Buffer.from(JSON.stringify({ orgId: "org_1" })).toString("base64");
    const samlResponse = Buffer.from(
      "<samlp:Response><saml:Assertion><saml:NameID>user@acme.com</saml:NameID></saml:Assertion></samlp:Response>",
    ).toString("base64");
    const res = await app.inject({
      method: "POST",
      url: "/v1/sso/callback/saml",
      body: { SAMLResponse: samlResponse, RelayState: relayState },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 503 because insecure SAML callback flow is disabled", async () => {
    vi.mocked(db.getSsoConfigByOrg).mockResolvedValue(mockSsoConfig);

    const app = buildApp();
    const relayState = Buffer.from(JSON.stringify({ orgId: "org_1" })).toString("base64");
    const samlResponse = Buffer.from("<fake />").toString("base64");

    const res = await app.inject({
      method: "POST",
      url: "/v1/sso/callback/saml",
      body: { SAMLResponse: samlResponse, RelayState: relayState },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json().message).toContain("temporarily disabled");
    expect(db.jitProvisionUser).not.toHaveBeenCalled();
    expect(db.createSsoSession).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// OIDC Callback
// ──────────────────────────────────────────────────────────────────────────────

describe("GET /v1/sso/callback/oidc", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for missing code parameter", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/sso/callback/oidc?state=abc",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for invalid state", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/v1/sso/callback/oidc?code=abc123&state=invalid-base64",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when state was not issued by the server", async () => {
    process.env["OIDC_STATE_SECRET"] = "test-oidc-state-secret";
    const forgedState = Buffer.from(
      JSON.stringify({ sid: "fake", orgId: "org_1", sig: "abcd" }),
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/v1/sso/callback/oidc?code=abc123&state=${forgedState}`,
    });
    expect(res.statusCode).toBe(400);
  });

  it("sets an HttpOnly cookie and redirects without query token on successful OIDC callback", async () => {
    process.env["OIDC_STATE_SECRET"] = "test-oidc-state-secret";
    vi.mocked(db.getOrganizationBySlug).mockResolvedValue(mockOrg);
    vi.mocked(db.getSsoConfigByOrg).mockResolvedValue(mockOidcConfig);
    vi.mocked(db.jitProvisionUser).mockResolvedValue({
      user: {
        id: "usr_oidc",
        email: "user@acme.com",
        name: "Alice",
        passwordHash: "sso-only:no-password-login",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      provisioned: true,
    });
    vi.mocked(db.deleteSsoSessionsByUser).mockResolvedValue(undefined);
    vi.mocked(db.createSsoSession).mockResolvedValue({
      id: "sso_sess_2",
      userId: "usr_oidc",
      orgId: "org_1",
      idpSessionId: "oidc-subject-1",
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
    });

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ authorization_endpoint: "https://issuer.example.com/auth" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          token_endpoint: "https://issuer.example.com/token",
          userinfo_endpoint: "https://issuer.example.com/userinfo",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "access-token", id_token: "id-token", token_type: "Bearer" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sub: "oidc-subject-1", email: "user@acme.com", name: "Alice" }),
      });

    const app = buildApp();
    const loginRes = await app.inject({ method: "GET", url: "/v1/sso/login/acme" });
    expect(loginRes.statusCode).toBe(302);
    const location = loginRes.headers.location as string;
    const authUrl = new URL(location);
    const state = authUrl.searchParams.get("state");
    expect(state).toBeTruthy();

    const callbackRes = await app.inject({
      method: "GET",
      url: `/v1/sso/callback/oidc?code=auth-code&state=${encodeURIComponent(state!)}`,
    });

    if (callbackRes.statusCode === 500) console.error(callbackRes.body);
    expect(callbackRes.statusCode).toBe(302);
    expect(callbackRes.headers.location).toBe("http://localhost:3000/sso/complete");
    expect((callbackRes.headers["set-cookie"] as string) || "").toContain("foxhound_token=");
    expect((callbackRes.headers["set-cookie"] as string) || "").toContain("HttpOnly");
    expect(callbackRes.headers.location).not.toContain("token=");
  });

  it("returns 400 when OIDC not configured for org", async () => {
    vi.mocked(db.getSsoConfigByOrg).mockResolvedValue(null);
    const app = buildApp();
    const state = Buffer.from(JSON.stringify({ orgId: "org_1", nonce: "abc" })).toString("base64");
    const res = await app.inject({
      method: "GET",
      url: `/v1/sso/callback/oidc?code=auth-code&state=${encodeURIComponent(state)}`,
    });
    expect(res.statusCode).toBe(400);
  });
});
