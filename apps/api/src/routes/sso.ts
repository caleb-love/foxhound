import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID, createHash } from "crypto";
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

// ──────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────────
// SAML assertion parser (minimal — parses base64 XML response)
// ──────────────────────────────────────────────────────────────────────────────

interface SamlAssertion {
  nameId: string;
  sessionIndex?: string;
  attributes: Record<string, string>;
}

function parseSamlResponse(base64Response: string): SamlAssertion {
  const xml = Buffer.from(base64Response, "base64").toString("utf-8");

  // Extract NameID
  const nameIdMatch = xml.match(/<(?:saml2?:)?NameID[^>]*>([^<]+)<\/(?:saml2?:)?NameID>/);
  if (!nameIdMatch?.[1]) {
    throw new Error("SAML response missing NameID");
  }

  // Extract SessionIndex from AuthnStatement
  const sessionMatch = xml.match(/SessionIndex="([^"]+)"/);

  // Extract common attributes
  const attributes: Record<string, string> = {};
  const attrRegex =
    /<(?:saml2?:)?Attribute\s+Name="([^"]+)"[^>]*>\s*<(?:saml2?:)?AttributeValue[^>]*>([^<]+)<\/(?:saml2?:)?AttributeValue>/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(xml)) !== null) {
    attributes[match[1]!] = match[2]!;
  }

  return {
    nameId: nameIdMatch[1],
    sessionIndex: sessionMatch?.[1],
    attributes,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// OIDC token exchange helper
// ──────────────────────────────────────────────────────────────────────────────

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

async function exchangeOidcCode(
  config: { issuer: string; clientId: string; clientSecret: string },
  code: string,
  redirectUri: string,
): Promise<{ tokenResponse: OidcTokenResponse; userInfo: OidcUserInfo }> {
  // Discover token endpoint from OIDC well-known config
  const wellKnownUrl = `${config.issuer}/.well-known/openid-configuration`;
  const discovery = await fetch(wellKnownUrl);
  if (!discovery.ok) {
    throw new Error(`OIDC discovery failed: ${discovery.status}`);
  }
  const discoveryData = (await discovery.json()) as {
    token_endpoint: string;
    userinfo_endpoint: string;
  };

  // Exchange authorization code for tokens
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

  // Fetch user info
  const userInfoRes = await fetch(discoveryData.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
  });

  if (!userInfoRes.ok) {
    throw new Error(`OIDC userinfo failed: ${userInfoRes.status}`);
  }

  const userInfo = (await userInfoRes.json()) as OidcUserInfo;
  return { tokenResponse, userInfo };
}

// ──────────────────────────────────────────────────────────────────────────────
// Route registration
// ──────────────────────────────────────────────────────────────────────────────

export function ssoRoutes(fastify: FastifyInstance): void {
  const baseUrl = process.env["APP_BASE_URL"] ?? "http://localhost:3001";

  // ────────────────────────────────────────────
  // SSO Config Management (JWT-authenticated, admin/owner only)
  // ────────────────────────────────────────────

  /**
   * GET /v1/sso/config
   * Get the current SSO config for the authenticated user's org.
   */
  fastify.get("/v1/sso/config", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const config = await getSsoConfigByOrg(request.orgId);
    if (!config) {
      return reply.code(200).send({ configured: false });
    }
    // Redact secrets from response
    const safeConfig = { ...config.config };
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

  /**
   * PUT /v1/sso/config
   * Create or update SSO config for the org.
   */
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

    return reply.code(200).send({
      id: config.id,
      provider: config.provider,
      enforceSso: config.enforceSso,
      updatedAt: config.updatedAt,
    });
  });

  /**
   * DELETE /v1/sso/config
   * Remove SSO config for the org.
   */
  fastify.delete(
    "/v1/sso/config",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const deleted = await deleteSsoConfig(request.orgId);
      if (!deleted) {
        return reply.code(404).send({ error: "Not Found", message: "No SSO config found" });
      }
      return reply.code(200).send({ deleted: true });
    },
  );

  /**
   * PATCH /v1/sso/enforce
   * Toggle SSO enforcement for the org.
   */
  fastify.patch(
    "/v1/sso/enforce",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
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

      return reply.code(200).send({
        enforceSso: config.enforceSso,
        updatedAt: config.updatedAt,
      });
    },
  );

  // ────────────────────────────────────────────
  // SSO Login Initiation
  // ────────────────────────────────────────────

  /**
   * GET /v1/sso/login/:orgSlug
   * Initiate SSO login. Redirects to IdP.
   */
  fastify.get(
    "/v1/sso/login/:orgSlug",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { orgSlug } = request.params as { orgSlug: string };

      // Look up org by slug to find SSO config
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

        // Build SAML AuthnRequest redirect URL
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
        const config = ssoConfig.config as {
          issuer: string;
          clientId: string;
        };

        // Discover authorization endpoint
        const wellKnownUrl = `${config.issuer}/.well-known/openid-configuration`;
        const discovery = await fetch(wellKnownUrl);
        if (!discovery.ok) {
          return reply.code(502).send({ error: "Bad Gateway", message: "OIDC discovery failed" });
        }
        const { authorization_endpoint } = (await discovery.json()) as {
          authorization_endpoint: string;
        };

        const state = createHash("sha256")
          .update(`${org.id}:${randomUUID()}`)
          .digest("hex")
          .slice(0, 32);

        // Store state → orgId mapping in a signed cookie or query param
        const statePayload = Buffer.from(
          JSON.stringify({ orgId: org.id, nonce: state }),
        ).toString("base64");

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

  // ────────────────────────────────────────────
  // SAML Callback
  // ────────────────────────────────────────────

  /**
   * POST /v1/sso/callback/saml
   * Handles SAML assertion from IdP. JIT provisions user, creates session, returns JWT.
   */
  fastify.post(
    "/v1/sso/callback/saml",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const result = SamlCallbackSchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const { SAMLResponse, RelayState } = result.data;

      // Decode RelayState to get orgId
      let orgId: string;
      try {
        const relayData = JSON.parse(
          Buffer.from(RelayState ?? "", "base64").toString("utf-8"),
        ) as { orgId: string };
        orgId = relayData.orgId;
      } catch {
        return reply.code(400).send({ error: "Bad Request", message: "Invalid RelayState" });
      }

      // Verify SSO config exists for this org
      const ssoConfig = await getSsoConfigByOrg(orgId);
      if (!ssoConfig || ssoConfig.provider !== "saml") {
        return reply
          .code(400)
          .send({ error: "Bad Request", message: "SAML not configured for this org" });
      }

      // Parse SAML assertion
      let assertion: SamlAssertion;
      try {
        assertion = parseSamlResponse(SAMLResponse);
      } catch (err) {
        return reply.code(400).send({
          error: "Bad Request",
          message: `Invalid SAML response: ${(err as Error).message}`,
        });
      }

      // Extract user info from assertion
      const email =
        assertion.attributes["email"] ??
        assertion.attributes[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
        ] ??
        assertion.nameId;
      const name =
        assertion.attributes["displayName"] ??
        assertion.attributes["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] ??
        assertion.attributes["firstName"] ??
        email.split("@")[0] ??
        "SSO User";

      // JIT provision or find existing user
      const { user } = await jitProvisionUser({
        userId: `usr_${randomUUID().replace(/-/g, "")}`,
        email,
        name,
        orgId,
      });

      // Create SSO session
      const sessionId = `sso_${randomUUID().replace(/-/g, "")}`;
      await deleteSsoSessionsByUser(user.id, orgId);
      await createSsoSession({
        id: sessionId,
        userId: user.id,
        orgId,
        idpSessionId: assertion.sessionIndex,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      // Issue JWT
      const payload: JwtPayload = { userId: user.id, orgId };
      const token = fastify.jwt.sign(payload, { expiresIn: "24h" });

      // Redirect to frontend with token (frontend will store it)
      const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:3000";
      return reply.redirect(`${frontendUrl}/sso/complete?token=${token}`);
    },
  );

  // ────────────────────────────────────────────
  // OIDC Callback
  // ────────────────────────────────────────────

  /**
   * GET /v1/sso/callback/oidc
   * Handles OIDC authorization code callback. Exchanges code, JIT provisions, returns JWT.
   */
  fastify.get(
    "/v1/sso/callback/oidc",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const result = OidcCallbackSchema.safeParse(request.query);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const { code, state } = result.data;

      // Decode state to get orgId
      let orgId: string;
      try {
        const stateData = JSON.parse(Buffer.from(state, "base64").toString("utf-8")) as {
          orgId: string;
        };
        orgId = stateData.orgId;
      } catch {
        return reply.code(400).send({ error: "Bad Request", message: "Invalid state parameter" });
      }

      // Verify SSO config
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

      // Exchange code for tokens and get user info
      let userInfo: OidcUserInfo;
      try {
        const redirectUri = `${baseUrl}/v1/sso/callback/oidc`;
        const result = await exchangeOidcCode(config, code, redirectUri);
        userInfo = result.userInfo;
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

      // JIT provision or find existing user
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

      // Create SSO session
      const sessionId = `sso_${randomUUID().replace(/-/g, "")}`;
      await deleteSsoSessionsByUser(user.id, orgId);
      await createSsoSession({
        id: sessionId,
        userId: user.id,
        orgId,
        idpSessionId: userInfo.sub,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Issue JWT
      const payload: JwtPayload = { userId: user.id, orgId };
      const token = fastify.jwt.sign(payload, { expiresIn: "24h" });

      const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:3000";
      return reply.redirect(`${frontendUrl}/sso/complete?token=${token}`);
    },
  );
}
