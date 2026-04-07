--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "plan" text NOT NULL DEFAULT 'free';
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_records" (
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "period" text NOT NULL,
  "span_count" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "usage_records_pk" PRIMARY KEY("org_id", "period")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_records_org_id_idx" ON "usage_records" ("org_id");
