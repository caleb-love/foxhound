--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "traces" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL,
  "session_id" text,
  "start_time_ms" text NOT NULL,
  "end_time_ms" text,
  "spans" jsonb NOT NULL,
  "metadata" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traces_agent_id_idx" ON "traces" ("agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traces_session_id_idx" ON "traces" ("session_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" text PRIMARY KEY NOT NULL,
  "timestamp" timestamp NOT NULL,
  "agent_id" text NOT NULL,
  "session_id" text,
  "trace_id" text,
  "span_id" text,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_agent_id_idx" ON "audit_events" ("agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_timestamp_idx" ON "audit_events" ("timestamp");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_event_type_idx" ON "audit_events" ("event_type");
