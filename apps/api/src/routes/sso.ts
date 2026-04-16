import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID, createHash, timingSafeEqual } from "crypto";
import {
  getSsoConfigByOrg,
  upsertSsoConfig,
  deleteSsoConfig,
  updateSsoEnforcement,
  jitProvisionUser,
  createSsoSession,
  deleteSsoSessionsByUser,
  getOrganizationBySlug,
} from "@foxhound/db";
import type { JwtPayload } from "../plugins/auth.js";
import { trackPendoEvent } from "../lib/pendo.js";
import { parseParams, OrgSlugParamSchema } from "../lib/params.js";

const SamlConfigSchema = z.object({
  provider: z.literal("saml"),
  entryPoint: z.string().url(),
  issuer: z.string().min(1),
  cert: z.string().min(1),
  enforceSso: z.boolean().optional().default(false),
});

const OidcConfigSchema = z.object({
  provider: z.literal("oidc"),
  issuer: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  enforceSso: z.boolean().optional().default(false),
});

const SsoConfigSchema = z.discriminatedUnion("provider", [SamlConfigSchema, OidcConfigSchema]);

const SamlCallbackSchema = z.object({
  SAMLResponse: z.string().min(1),
  RelayState: z.string().optional(),
});

const OidcCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const EnforceSsoSchema = z.object({
  enforce: z.boolean(),
});

interface OidcTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in?: number;
}

interface OidcUserInfo {
  sub: string;
  email: string;
  name?: string;
  preferred_username?: string;
}

const OIDC_STATE_TTL_MS = 10 * 60 * 1000;
const oidcStateStore = new Map<string, { orgId: string; expiresAt: number }>();

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf-8");
}

function getOidcStateSecret(): string {
  return process.env["OIDC_STATE_SECRET"] ?? process.env["JWT_SECRET"] ?? "foxhound-dev-state-secret";
}

function signOidcState(stateId: string, orgId: string): string {
  return createHash("sha256")
    .update(`${getOidcStateSecret()}:${stateId}:${orgId}`)
    .digest("hex");
}

function createOidcState(orgId: string): string {
  const stateId = randomUUID().replace(/-/g, "");
  oidcStateStore.set(stateId, { orgId, expiresAt: Date.now() + OIDC_STATE_TTL_MS });
  return base64UrlEncode(
    JSON.stringify({ sid: stateId, orgId, sig: signOidcState(stateId, orgId) }),
  );
}

function consumeOidcState(state: string): string {
  let parsed: { sid?: string; orgId?: string; sig?: string };
  try {
    parsed = JSON.parse(base64UrlDecode(state)) as { sid?: string; orgId?: string; sig?: string };
  } catch {
    throw new Error("Invalid state parameter");
  }

  const stateId = parsed.sid;
  const orgId = parsed.orgId;
  const sig = parsed.sig;
  if (!stateId || !orgId || !sig) {
    throw new Error("Invalid state parameter");
  }

  const expectedSig = signOidcState(stateId, orgId);
  const sigBuf = Buffer.from(sig, "hex");
  const expectedBuf = Buffer.from(expectedSig, "hex");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error("Invalid state parameter");
  }

  const stored = oidcStateStore.get(stateId);
  oidcStateStore.delete(stateId);
  if (!stored || stored.orgId !== orgId || stored.expiresAt < Date.now()) {
    throw new Error("Expired or unknown state parameter");
  }

  return orgId;
}

function buildSsoDisabledMessage(provider: "saml" | "oidc"): string {
  return `${provider.toUpperCase()} SSO is temporarily disabled until secure assertion validation is implemented.`;
}

async function exchangeOidcCode(
  config: { issuer: string; clientId: string; clientSecret: string },
  code: string,
  redirectUri: string,
): Promise<{ tokenResponse: OidcTokenResponse; userInfo: OidcUserInfo }> {
  const wellKnownUrl = `${config.issuer}/.well-known/openid-configuration`;
  const discovery = await fetch(wellKnownUrl);
  if (!discovery.ok) {
    throw new Error(`OIDC discovery failed: ${discovery.status}`);
  }
  const discoveryData = (await discovery.json()) as {
    token_endpoint: string;
    userinfo_endpoint: string;
  };

  const tokenRes = await fetch(discoveryData.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`OIDC token exchange failed: ${tokenRes.status} ${body}`);
  }

  const tokenResponse = (await tokenRes.json()) as OidcTokenResponse;

  const userInfoRes = await fetch(discoveryData.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
  });

  if (!userInfoRes.ok) {
    throw new Error(`OIDC userinfo failed: ${userInfoRes.status}`);
  }

  const userInfo = (await userInfoRes.json()) as OidcUserInfo;
  return { tokenResponse, userInfo };
}

export function ssoRoutes(fastify: FastifyInstance): void {
  const baseUrl = process.env["APP_BASE_URL"] ?? "http://localhost:3001";

  fastify.get("/v1/sso/config", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const config = await getSsoConfigByOrg(request.orgId);
    if (!config) {
      return reply.code(200).send({ configured: false });
    }
    const safeConfig = { ...(config.config as unknown as Record<string, unknown>) };
    if (config.provider === "oidc") {
      safeConfig["clientSecret"] = "••••••••";
    }
    return reply.code(200).send({
      configured: true,
      provider: config.provider,
      enforceSso: config.enforceSso,
      config: safeConfig,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });
  });

  fastify.put("/v1/sso/config", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = SsoConfigSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const { provider, enforceSso, ...providerConfig } = result.data;
    const config = await upsertSsoConfig({
      id: `sso_${randomUUID().replace(/-/g, "")}`,
      orgId: request.orgId,
      provider,
      config: providerConfig as Record<string, unknown>,
      enforceSso,
    });

    void trackPendoEvent({
      event: "sso_config_created",
      visitorId: request.userId ?? "system",
      accountId: request.orgId,
      properties: { provider, enforceSso },
      context: { ip: request.ip },
    });

    return reply.code(200).send({
      id: config.id,
      provider: config.provider,
      enforceSso: config.enforceSso,
      updatedAt: config.updatedAt,
    });
  });

  fastify.delete("/v1/sso/config", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const deleted = await deleteSsoConfig(request.orgId);
    if (!deleted) {
      return reply.code(404).send({ error: "Not Found", message: "No SSO config found" });
    }
    return reply.code(200).send({ deleted: true });
  });

  fastify.patch("/v1/sso/enforce", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = EnforceSsoSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const config = await updateSsoEnforcement(request.orgId, result.data.enforce);
    if (!config) {
      return reply
        .code(404)
        .send({ error: "Not Found", message: "Configure SSO before enabling enforcement" });
    }

    void trackPendoEvent({
      event: "sso_enforcement_toggled",
      visitorId: request.userId ?? "system",
      accountId: request.orgId,
      properties: { enforce: result.data.enforce },
      context: { ip: request.ip },
    });

    return reply.code(200).send({ enforceSso: config.enforceSso, updatedAt: config.updatedAt });
  });

  fastify.get(
    "/v1/sso/login/:orgSlug",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const p = parseParams(request, reply, OrgSlugParamSchema);
      if (!p) return;
      const { orgSlug } = p;
      const org = await getOrganizationBySlug(orgSlug);

      if (!org) {
        return reply.code(404).send({ error: "Not Found", message: "Organization not found" });
      }

      const ssoConfig = await getSsoConfigByOrg(org.id);
      if (!ssoConfig) {
        return reply
          .code(404)
          .send({ error: "Not Found", message: "SSO not configured for this organization" });
      }

      if (ssoConfig.provider === "saml") {
        const config = ssoConfig.config as { entryPoint: string; issuer: string };
        const callbackUrl = `${baseUrl}/v1/sso/callback/saml`;
        const relayState = Buffer.from(JSON.stringify({ orgId: org.id })).toString("base64");
        const samlRequest = Buffer.from(
          `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
            `ID="_${randomUUID()}" Version="2.0" IssueInstant="${new Date().toISOString()}" ` +
            `AssertionConsumerServiceURL="${callbackUrl}" ` +
            `Destination="${config.entryPoint}">` +
            `<saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${config.issuer}</saml:Issuer>` +
            `</samlp:AuthnRequest>`,
        ).toString("base64");

        const redirectUrl =
          `${config.entryPoint}?SAMLRequest=${encodeURIComponent(samlRequest)}` +
          `&RelayState=${encodeURIComponent(relayState)}`;

        return reply.redirect(redirectUrl);
      }

      if (ssoConfig.provider === "oidc") {
        const config = ssoConfig.config as { issuer: string; clientId: string };
        const wellKnownUrl = `${config.issuer}/.well-known/openid-configuration`;
        const discovery = await fetch(wellKnownUrl);
        if (!discovery.ok) {
          return reply.code(502).send({ error: "Bad Gateway", message: "OIDC discovery failed" });
        }
        const { authorization_endpoint } = (await discovery.json()) as {
          authorization_endpoint: string;
        };

        const statePayload = createOidcState(org.id);
        const redirectUri = `${baseUrl}/v1/sso/callback/oidc`;
        const authUrl =
          `${authorization_endpoint}?response_type=code` +
          `&client_id=${encodeURIComponent(config.clientId)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${encodeURIComponent("openid email profile")}` +
          `&state=${encodeURIComponent(statePayload)}`;

        return reply.redirect(authUrl);
      }

      return reply.code(400).send({ error: "Bad Request", message: "Unknown SSO provider" });
    },
  );

  fastify.post(
    "/v1/sso/callback/saml",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const result = SamlCallbackSchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const { RelayState } = result.data;
      let orgId: string;
      try {
        const relayData = JSON.parse(Buffer.from(RelayState ?? "", "base64").toString("utf-8")) as {
          orgId: string;
        };
        orgId = relayData.orgId;
      } catch {
        return reply.code(400).send({ error: "Bad Request", message: "Invalid RelayState" });
      }

      const ssoConfig = await getSsoConfigByOrg(orgId);
      if (!ssoConfig || ssoConfig.provider !== "saml") {
        return reply
          .code(400)
          .send({ error: "Bad Request", message: "SAML not configured for this org" });
      }

      return reply.code(503).send({
        error: "Service Unavailable",
        message: buildSsoDisabledMessage("saml"),
      });
    },
  );

  fastify.get(
    "/v1/sso/callback/oidc",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const result = OidcCallbackSchema.safeParse(request.query);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const { code, state } = result.data;
      let orgId: string;
      try {
        orgId = consumeOidcState(state);
      } catch (err) {
        return reply.code(400).send({
          error: "Bad Request",
          message: (err as Error).message,
        });
      }

      const ssoConfig = await getSsoConfigByOrg(orgId);
      if (!ssoConfig || ssoConfig.provider !== "oidc") {
        return reply
          .code(400)
          .send({ error: "Bad Request", message: "OIDC not configured for this org" });
      }

      const config = ssoConfig.config as {
        issuer: string;
        clientId: string;
        clientSecret: string;
      };

      let userInfo: OidcUserInfo;
      try {
        const redirectUri = `${baseUrl}/v1/sso/callback/oidc`;
        const exchange = await exchangeOidcCode(config, code, redirectUri);
        userInfo = exchange.userInfo;
      } catch (err) {
        return reply.code(502).send({
          error: "Bad Gateway",
          message: `OIDC token exchange failed: ${(err as Error).message}`,
        });
      }

      if (!userInfo.email) {
        return reply
          .code(400)
          .send({ error: "Bad Request", message: "OIDC provider did not return email" });
      }

      const { user } = await jitProvisionUser({
        userId: `usr_${randomUUID().replace(/-/g, "")}`,
        email: userInfo.email,
        name:
          userInfo.name ??
          userInfo.preferred_username ??
          userInfo.email.split("@")[0] ??
          "SSO User",
        orgId,
      });

      const sessionId = `sso_${randomUUID().replace(/-/g, "")}`;
      await deleteSsoSessionsByUser(user.id, orgId);
      await createSsoSession({
        id: sessionId,
        userId: user.id,
        orgId,
        idpSessionId: userInfo.sub,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      void trackPendoEvent({
        event: "sso_login_completed",
        visitorId: user.id,
        accountId: orgId,
        properties: { sso_provider: "oidc" },
        context: { ip: request.ip },
      });

      const payload: JwtPayload = { userId: user.id, orgId };
      const token = fastify.jwt.sign(payload, { expiresIn: "24h" });

      const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:3000";
      const isHttps = frontendUrl.startsWith("https://");
      void reply.header(
        "Set-Cookie",
        `foxhound_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${isHttps ? "; Secure" : ""}; Max-Age=86400`,
      );
      return reply.redirect(`${frontendUrl}/sso/complete`);
    },
  );
}
