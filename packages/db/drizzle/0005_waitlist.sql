CREATE TABLE IF NOT EXISTS "waitlist_signups" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "waitlist_signups_email_idx" ON "waitlist_signups" ("email");
