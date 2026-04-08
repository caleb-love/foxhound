-- Migration: 0004_notifications
-- Adds notification_channels, alert_rules, and notification_log tables.

CREATE TABLE IF NOT EXISTS "notification_channels" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "config" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "notification_channels_org_id_idx"
  ON "notification_channels" ("org_id");

CREATE TABLE IF NOT EXISTS "alert_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "min_severity" text NOT NULL DEFAULT 'high',
  "channel_id" text NOT NULL REFERENCES "notification_channels"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "alert_rules_org_id_idx"
  ON "alert_rules" ("org_id");

CREATE INDEX IF NOT EXISTS "alert_rules_channel_id_idx"
  ON "alert_rules" ("channel_id");

CREATE TABLE IF NOT EXISTS "notification_log" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "rule_id" text REFERENCES "alert_rules"("id") ON DELETE SET NULL,
  "channel_id" text REFERENCES "notification_channels"("id") ON DELETE SET NULL,
  "event_type" text NOT NULL,
  "severity" text NOT NULL,
  "agent_id" text NOT NULL,
  "trace_id" text,
  "status" text NOT NULL,
  "error" text,
  "sent_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "notification_log_org_id_idx"
  ON "notification_log" ("org_id");

CREATE INDEX IF NOT EXISTS "notification_log_sent_at_idx"
  ON "notification_log" ("sent_at");
