-- Phase 1: SSO (SAML/OIDC) tables
-- Enables enterprise single sign-on with per-org provider config and session tracking.

CREATE TABLE IF NOT EXISTS "sso_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "config" jsonb NOT NULL,
  "enforce_sso" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "sso_configs_org_id_unique" UNIQUE("org_id")
);

CREATE INDEX IF NOT EXISTS "sso_configs_org_id_idx" ON "sso_configs" ("org_id");

CREATE TABLE IF NOT EXISTS "sso_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "idp_session_id" text,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "sso_sessions_user_id_idx" ON "sso_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "sso_sessions_org_id_idx" ON "sso_sessions" ("org_id");
CREATE INDEX IF NOT EXISTS "sso_sessions_expires_at_idx" ON "sso_sessions" ("expires_at");
