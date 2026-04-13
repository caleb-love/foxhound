-- H1.6: [SECURITY] Add expiry, scopes, and lastUsedAt to API keys
-- Leaked keys currently live forever with full access. This migration adds:
--   expires_at  — optional expiration timestamp (keys past this date are rejected)
--   scopes      — optional comma-separated permission scopes (NULL = full access for legacy keys)
--   last_used_at — tracks last authentication time for key hygiene/rotation policies

ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "expires_at" timestamp,
  ADD COLUMN IF NOT EXISTS "scopes" text,
  ADD COLUMN IF NOT EXISTS "last_used_at" timestamp;
