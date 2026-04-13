-- Phase 4: Agent Intelligence tables
-- Per-agent cost budgets, SLA configs, behavior baselines, and model pricing overrides.

CREATE TABLE IF NOT EXISTS "agent_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "agent_id" text NOT NULL,
  "cost_budget_usd" numeric(12, 6),
  "cost_alert_threshold_pct" integer DEFAULT 80,
  "budget_period" text DEFAULT 'monthly',
  "max_duration_ms" bigint,
  "min_success_rate" numeric(5, 4),
  "evaluation_window_ms" bigint DEFAULT 86400000,
  "min_sample_size" integer DEFAULT 10,
  "last_cost_status" jsonb,
  "last_sla_status" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "agent_configs_org_agent_unique" UNIQUE("org_id", "agent_id")
);

CREATE INDEX IF NOT EXISTS "agent_configs_org_id_idx" ON "agent_configs" ("org_id");

CREATE TABLE IF NOT EXISTS "behavior_baselines" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "agent_id" text NOT NULL,
  "agent_version" text NOT NULL,
  "sample_size" integer NOT NULL,
  "span_structure" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "baselines_org_agent_version_unique" UNIQUE("org_id", "agent_id", "agent_version")
);

CREATE INDEX IF NOT EXISTS "baselines_org_agent_created_idx" ON "behavior_baselines" ("org_id", "agent_id", "created_at");

CREATE TABLE IF NOT EXISTS "model_pricing_overrides" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "model_pattern" text NOT NULL,
  "input_cost_per_token" numeric(18, 12) NOT NULL,
  "output_cost_per_token" numeric(18, 12) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "pricing_overrides_unique" UNIQUE("org_id", "provider", "model_pattern")
);

CREATE INDEX IF NOT EXISTS "pricing_overrides_org_id_idx" ON "model_pricing_overrides" ("org_id");
