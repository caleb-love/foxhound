-- H1.5: Admin audit logging for sensitive operations
-- Tracks API key create/revoke, billing changes, evaluator create/delete, org settings changes.

CREATE TABLE IF NOT EXISTS "admin_audit_log" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
  "actor_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "ip_address" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "admin_audit_log_org_id_idx"
  ON "admin_audit_log" ("org_id");
CREATE INDEX IF NOT EXISTS "admin_audit_log_org_action_idx"
  ON "admin_audit_log" ("org_id", "action");
CREATE INDEX IF NOT EXISTS "admin_audit_log_created_at_idx"
  ON "admin_audit_log" ("org_id", "created_at");
