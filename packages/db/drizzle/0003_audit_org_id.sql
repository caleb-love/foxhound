--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN IF NOT EXISTS "org_id" text REFERENCES "organizations"("id") ON DELETE SET NULL;
--> statement-breakpoint
UPDATE "audit_events" ae
SET "org_id" = t."org_id"
FROM "traces" t
WHERE ae."trace_id" = t."id"
  AND ae."org_id" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_org_id_idx" ON "audit_events" ("org_id");
