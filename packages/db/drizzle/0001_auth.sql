--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memberships" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "memberships_pk" PRIMARY KEY("user_id", "org_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_org_id_idx" ON "memberships" ("org_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "key_hash" text NOT NULL,
  "prefix" text NOT NULL,
  "name" text NOT NULL,
  "created_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys" ("key_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_org_id_idx" ON "api_keys" ("org_id");
--> statement-breakpoint
-- Add org_id column to traces for tenant isolation
ALTER TABLE "traces" ADD COLUMN IF NOT EXISTS "org_id" text REFERENCES "organizations"("id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traces_org_id_idx" ON "traces" ("org_id");
--> statement-breakpoint
-- Create default org and backfill existing traces
DO $$
DECLARE
  default_org_id TEXT := 'org_default';
BEGIN
  -- Insert default org only if it doesn't exist
  INSERT INTO "organizations" ("id", "name", "slug", "created_at", "updated_at")
  VALUES (default_org_id, 'Default Organization', 'default', now(), now())
  ON CONFLICT ("id") DO NOTHING;

  -- Backfill all traces that have no org_id
  UPDATE "traces" SET "org_id" = default_org_id WHERE "org_id" IS NULL;
END $$;
