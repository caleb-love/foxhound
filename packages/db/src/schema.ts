import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  unique,
  primaryKey,
  integer,
  boolean,
  bigint,
  real,
  doublePrecision,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ──────────────────────────────────────────────────────────────────────────────
// Auth / multi-tenancy tables
// ──────────────────────────────────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan", { enum: ["free", "pro", "team", "enterprise"] })
    .notNull()
    .default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  /** Days to retain spans/traces before cleanup deletes them (default 90) */
  retentionDays: integer("retention_days").notNull().default(90),
  /** Server-side sampling rate 0.0–1.0 (default 1.0 = keep all) */
  samplingRate: real("sampling_rate").notNull().default(1.0),
  /** Whether this org has opted in to sending trace data to third-party LLM providers for evaluation.
   *  Default false — must be explicitly enabled before evaluator runs can execute. */
  llmEvaluationEnabled: boolean("llm_evaluation_enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
  }),
);

export const memberships = pgTable(
  "memberships",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member"] }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.orgId] }),
    orgIdIdx: index("memberships_org_id_idx").on(table.orgId),
  }),
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** SHA-256 hash of the full key — used for lookup */
    keyHash: text("key_hash").notNull().unique(),
    /** First 10 chars of the key, for display purposes only */
    prefix: text("prefix").notNull(),
    name: text("name").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Optional expiration timestamp — keys past this date are rejected at auth time */
    expiresAt: timestamp("expires_at"),
    /** Comma-separated permission scopes, e.g. "traces:write,scores:read".
     *  NULL means full access (legacy keys). */
    scopes: text("scopes"),
    /** Last time this key was used to authenticate a request */
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    keyHashIdx: index("api_keys_key_hash_idx").on(table.keyHash),
    orgIdIdx: index("api_keys_org_id_idx").on(table.orgId),
  }),
);

// ──────────────────────────────────────────────────────────────────────────────
// Observability tables
// ──────────────────────────────────────────────────────────────────────────────

export const traces = pgTable(
  "traces",
  {
    id: text("id").primaryKey(),
    /** Tenant isolation — every trace belongs to an org (NOT NULL enforced) */
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id),
    agentId: text("agent_id").notNull(),
    sessionId: text("session_id"),
    startTimeMs: bigint("start_time_ms", { mode: "number" }).notNull(),
    endTimeMs: bigint("end_time_ms", { mode: "number" }),
    spans: jsonb("spans").notNull().$type<unknown[]>(),
    metadata: jsonb("metadata").notNull().$type<Record<string, unknown>>(),
    parentAgentId: text("parent_agent_id"),
    correlationId: text("correlation_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    agentIdIdx: index("traces_agent_id_idx").on(table.agentId),
    sessionIdIdx: index("traces_session_id_idx").on(table.sessionId),
    orgIdIdx: index("traces_org_id_idx").on(table.orgId),
    orgCreatedAtIdx: index("traces_org_id_created_at_idx").on(table.orgId, table.createdAt),
    correlationIdIdx: index("traces_correlation_id_idx").on(table.orgId, table.correlationId),
    orgAgentStartIdx: index("traces_org_agent_start_idx").on(
      table.orgId,
      table.agentId,
      table.startTimeMs,
    ),
  }),
);

export const spans = pgTable(
  "spans",
  {
    id: text("id").notNull(),
    traceId: text("trace_id")
      .notNull()
      .references(() => traces.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    parentSpanId: text("parent_span_id"),
    name: text("name").notNull(),
    kind: text("kind", {
      enum: ["tool_call", "llm_call", "agent_step", "workflow", "custom"],
    }).notNull(),
    status: text("status", { enum: ["ok", "error", "unset"] })
      .notNull()
      .default("ok"),
    startTimeMs: bigint("start_time_ms", { mode: "number" }).notNull(),
    endTimeMs: bigint("end_time_ms", { mode: "number" }),
    attributes: jsonb("attributes")
      .notNull()
      .default({})
      .$type<Record<string, string | number | boolean | null>>(),
    events: jsonb("events").notNull().default([]).$type<
      Array<{
        timeMs: number;
        name: string;
        attributes: Record<string, string | number | boolean | null>;
      }>
    >(),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.traceId, table.id] }),
    traceIdIdx: index("spans_trace_id_idx").on(table.traceId),
    orgKindIdx: index("spans_org_id_kind_idx").on(table.orgId, table.kind),
    orgStartTimeIdx: index("spans_org_id_start_time_ms_idx").on(table.orgId, table.startTimeMs),
    parentSpanIdIdx: index("spans_parent_span_id_idx").on(table.parentSpanId),
  }),
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").references(() => organizations.id, { onDelete: "set null" }),
    timestamp: timestamp("timestamp").notNull(),
    agentId: text("agent_id").notNull(),
    sessionId: text("session_id"),
    traceId: text("trace_id"),
    spanId: text("span_id"),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("audit_events_org_id_idx").on(table.orgId),
    agentIdIdx: index("audit_events_agent_id_idx").on(table.agentId),
    timestampIdx: index("audit_events_timestamp_idx").on(table.timestamp),
    eventTypeIdx: index("audit_events_event_type_idx").on(table.eventType),
  }),
);

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    /** The user who performed the action (null for system actions) */
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    /** Action performed: api_key.create, api_key.revoke, evaluator.create, evaluator.delete,
     *  billing.plan_change, org.settings_update, etc. */
    action: text("action").notNull(),
    /** The type of resource affected */
    targetType: text("target_type").notNull(),
    /** The ID of the affected resource */
    targetId: text("target_id"),
    /** Additional context about the change */
    metadata: jsonb("metadata").notNull().default({}).$type<Record<string, unknown>>(),
    /** IP address of the request */
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("admin_audit_log_org_id_idx").on(table.orgId),
    orgActionIdx: index("admin_audit_log_org_action_idx").on(table.orgId, table.action),
    createdAtIdx: index("admin_audit_log_created_at_idx").on(table.orgId, table.createdAt),
  }),
);

export const usageRecords = pgTable(
  "usage_records",
  {
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Billing period in YYYY-MM format */
    period: text("period").notNull(),
    spanCount: integer("span_count").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.orgId, table.period] }),
    orgIdIdx: index("usage_records_org_id_idx").on(table.orgId),
  }),
);

// ──────────────────────────────────────────────────────────────────────────────
// Notification tables
// ──────────────────────────────────────────────────────────────────────────────

export const notificationChannels = pgTable(
  "notification_channels",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["slack"] }).notNull(),
    name: text("name").notNull(),
    /** Provider-specific config (webhook URL, etc.) stored as jsonb */
    config: jsonb("config").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("notification_channels_org_id_idx").on(table.orgId),
  }),
);

export const alertRules = pgTable(
  "alert_rules",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    eventType: text("event_type", {
      enum: [
        "agent_failure",
        "anomaly_detected",
        "cost_spike",
        "compliance_violation",
        "cost_budget_exceeded",
        "sla_duration_breach",
        "sla_success_rate_breach",
        "behavior_regression",
      ],
    }).notNull(),
    minSeverity: text("min_severity", {
      enum: ["critical", "high", "medium", "low"],
    })
      .notNull()
      .default("high"),
    channelId: text("channel_id")
      .notNull()
      .references(() => notificationChannels.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("alert_rules_org_id_idx").on(table.orgId),
    channelIdIdx: index("alert_rules_channel_id_idx").on(table.channelId),
  }),
);

export const notificationLog = pgTable(
  "notification_log",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ruleId: text("rule_id").references(() => alertRules.id, { onDelete: "set null" }),
    channelId: text("channel_id").references(() => notificationChannels.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type").notNull(),
    severity: text("severity").notNull(),
    agentId: text("agent_id").notNull(),
    traceId: text("trace_id"),
    status: text("status", { enum: ["sent", "failed"] }).notNull(),
    error: text("error"),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("notification_log_org_id_idx").on(table.orgId),
    sentAtIdx: index("notification_log_sent_at_idx").on(table.sentAt),
  }),
);

// ──────────────────────────────────────────────────────────────────────────────
// SSO tables
// ──────────────────────────────────────────────────────────────────────────────

export const ssoConfigs = pgTable(
  "sso_configs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .unique(),
    provider: text("provider", { enum: ["saml", "oidc"] }).notNull(),
    /** Provider-specific config: SAML metadata XML/URL, OIDC client ID/secret/issuer */
    config: jsonb("config").notNull().$type<Record<string, unknown>>(),
    /** When true, all org members must authenticate via SSO */
    enforceSso: boolean("enforce_sso").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("sso_configs_org_id_idx").on(table.orgId),
  }),
);

// ──────────────────────────────────────────────────────────────────────────────
// Waitlist table
// ──────────────────────────────────────────────────────────────────────────────

export const waitlistSignups = pgTable(
  "waitlist_signups",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("waitlist_signups_email_idx").on(table.email),
  }),
);

export const ssoSessions = pgTable(
  "sso_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Session ID from the IdP (SAML SessionIndex or OIDC session ID) */
    idpSessionId: text("idp_session_id"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("sso_sessions_user_id_idx").on(table.userId),
    orgIdIdx: index("sso_sessions_org_id_idx").on(table.orgId),
    expiresAtIdx: index("sso_sessions_expires_at_idx").on(table.expiresAt),
  }),
);

// ──────────────────────────────────────────────────────────────────────────────
// Agent Intelligence tables (Phase 4)
// ──────────────────────────────────────────────────────────────────────────────

export const agentConfigs = pgTable(
  "agent_configs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),

    // Cost budget fields (nullable = not configured)
    costBudgetUsd: numeric("cost_budget_usd", { precision: 12, scale: 6 }),
    costAlertThresholdPct: integer("cost_alert_threshold_pct").default(80),
    budgetPeriod: text("budget_period", { enum: ["daily", "weekly", "monthly"] }).default(
      "monthly",
    ),

    // SLA fields (nullable = not configured)
    maxDurationMs: bigint("max_duration_ms", { mode: "number" }),
    minSuccessRate: numeric("min_success_rate", { precision: 5, scale: 4 }),
    evaluationWindowMs: bigint("evaluation_window_ms", { mode: "number" }).default(86400000),
    minSampleSize: integer("min_sample_size").default(10),

    // Cached status from last worker run
    lastCostStatus: jsonb("last_cost_status").$type<Record<string, unknown> | null>(),
    lastSlaStatus: jsonb("last_sla_status").$type<Record<string, unknown> | null>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgAgentUnique: unique("agent_configs_org_agent_unique").on(table.orgId, table.agentId),
    orgIdIdx: index("agent_configs_org_id_idx").on(table.orgId),
  }),
);

export const behaviorBaselines = pgTable(
  "behavior_baselines",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    agentVersion: text("agent_version").notNull(),
    sampleSize: integer("sample_size").notNull(),
    spanStructure: jsonb("span_structure").notNull().$type<Record<string, number>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgAgentVersionUnique: unique("baselines_org_agent_version_unique").on(
      table.orgId,
      table.agentId,
      table.agentVersion,
    ),
    orgAgentCreatedIdx: index("baselines_org_agent_created_idx").on(
      table.orgId,
      table.agentId,
      table.createdAt,
    ),
  }),
);

export const modelPricingOverrides = pgTable(
  "model_pricing_overrides",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    modelPattern: text("model_pattern").notNull(),
    inputCostPerToken: numeric("input_cost_per_token", { precision: 18, scale: 12 }).notNull(),
    outputCostPerToken: numeric("output_cost_per_token", { precision: 18, scale: 12 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgProviderModelUnique: unique("pricing_overrides_unique").on(
      table.orgId,
      table.provider,
      table.modelPattern,
    ),
    orgIdIdx: index("pricing_overrides_org_id_idx").on(table.orgId),
  }),
);

// ──────────────────────────────────────────────────────────────────────────────
// Evaluation tables (Phase 2)
// ──────────────────────────────────────────────────────────────────────────────

export const scores = pgTable(
  "scores",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    traceId: text("trace_id")
      .notNull()
      .references(() => traces.id, { onDelete: "cascade" }),
    /** Optional span-level scoring — references spans(trace_id, id) logically */
    spanId: text("span_id"),
    /** Score name, e.g. "helpfulness", "correctness", "toxicity" */
    name: text("name").notNull(),
    /** Numeric score 0.0–1.0 (nullable for categorical-only scores) */
    value: doublePrecision("value"),
    /** Categorical label, e.g. "correct", "incorrect", "partial" */
    label: text("label"),
    /** How the score was produced */
    source: text("source", {
      enum: ["manual", "llm_judge", "sdk", "user_feedback"],
    }).notNull(),
    comment: text("comment"),
    /** NULL for system/SDK scores */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgNameCreatedIdx: index("scores_org_name_created_idx").on(
      table.orgId,
      table.name,
      table.createdAt,
    ),
    traceIdIdx: index("scores_trace_id_idx").on(table.traceId),
    orgSourceIdx: index("scores_org_source_idx").on(table.orgId, table.source),
  }),
);

export const evaluators = pgTable(
  "evaluators",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Mustache-style template: "Rate the {{output}} for helpfulness on a scale of 0-1" */
    promptTemplate: text("prompt_template").notNull(),
    /** LLM model to use, e.g. "gpt-4o", "claude-sonnet-4-20250514" */
    model: text("model").notNull(),
    scoringType: text("scoring_type", { enum: ["numeric", "categorical"] }).notNull(),
    /** For categorical scoring: the valid labels */
    labels: text("labels")
      .array()
      .default(sql`'{}'::text[]`),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("evaluators_org_id_idx").on(table.orgId),
    orgNameIdx: index("evaluators_org_name_idx").on(table.orgId, table.name),
  }),
);

export const evaluatorRuns = pgTable(
  "evaluator_runs",
  {
    id: text("id").primaryKey(),
    evaluatorId: text("evaluator_id")
      .notNull()
      .references(() => evaluators.id, { onDelete: "cascade" }),
    traceId: text("trace_id")
      .notNull()
      .references(() => traces.id, { onDelete: "cascade" }),
    /** The resulting score, set on completion */
    scoreId: text("score_id").references(() => scores.id, { onDelete: "set null" }),
    status: text("status", {
      enum: ["pending", "running", "completed", "failed"],
    })
      .notNull()
      .default("pending"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    evaluatorStatusIdx: index("evaluator_runs_evaluator_status_idx").on(
      table.evaluatorId,
      table.status,
    ),
    traceIdIdx: index("evaluator_runs_trace_id_idx").on(table.traceId),
  }),
);

export const annotationQueues = pgTable(
  "annotation_queues",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** Score configurations: [{name: "helpfulness", type: "numeric"}, ...] */
    scoreConfigs: jsonb("score_configs")
      .notNull()
      .default([])
      .$type<Array<{ name: string; type: "numeric" | "categorical"; labels?: string[] }>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("annotation_queues_org_id_idx").on(table.orgId),
  }),
);

export const annotationQueueItems = pgTable(
  "annotation_queue_items",
  {
    id: text("id").primaryKey(),
    queueId: text("queue_id")
      .notNull()
      .references(() => annotationQueues.id, { onDelete: "cascade" }),
    traceId: text("trace_id")
      .notNull()
      .references(() => traces.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "completed", "skipped"] })
      .notNull()
      .default("pending"),
    assignedTo: text("assigned_to").references(() => users.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    queueStatusIdx: index("annotation_queue_items_queue_status_idx").on(
      table.queueId,
      table.status,
    ),
    traceIdIdx: index("annotation_queue_items_trace_id_idx").on(table.traceId),
  }),
);

// ──────────────────────────────────────────────────────────────────────────────
// Dataset & Experiment tables (Phase 3)
// ──────────────────────────────────────────────────────────────────────────────

export const datasets = pgTable(
  "datasets",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("datasets_org_id_idx").on(table.orgId),
    orgNameIdx: index("datasets_org_name_idx").on(table.orgId, table.name),
  }),
);

export const datasetItems = pgTable(
  "dataset_items",
  {
    id: text("id").primaryKey(),
    datasetId: text("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    input: jsonb("input").notNull().$type<Record<string, unknown>>(),
    expectedOutput: jsonb("expected_output").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    sourceTraceId: text("source_trace_id").references(() => traces.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    datasetIdIdx: index("dataset_items_dataset_id_idx").on(table.datasetId),
    sourceTraceIdIdx: index("dataset_items_source_trace_id_idx").on(table.sourceTraceId),
  }),
);

export const experiments = pgTable(
  "experiments",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    datasetId: text("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    config: jsonb("config").notNull().default({}).$type<Record<string, unknown>>(),
    status: text("status", {
      enum: ["pending", "running", "completed", "failed"],
    })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    orgIdIdx: index("experiments_org_id_idx").on(table.orgId),
    datasetIdIdx: index("experiments_dataset_id_idx").on(table.datasetId),
    orgStatusIdx: index("experiments_org_status_idx").on(table.orgId, table.status),
  }),
);

// ──────────────────────────────────────────────────────────────────────────────
// Prompt Management tables (Phase 6)
// ──────────────────────────────────────────────────────────────────────────────

export const prompts = pgTable(
  "prompts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdIdx: index("prompts_org_id_idx").on(table.orgId),
    orgNameUnique: unique("prompts_org_name_unique").on(table.orgId, table.name),
  }),
);

export const promptVersions = pgTable(
  "prompt_versions",
  {
    id: text("id").primaryKey(),
    promptId: text("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    model: text("model"),
    config: jsonb("config").notNull().default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => ({
    promptVersionUnique: unique("prompt_versions_prompt_version_unique").on(
      table.promptId,
      table.version,
    ),
    promptIdIdx: index("prompt_versions_prompt_id_idx").on(table.promptId),
  }),
);

export const promptLabels = pgTable(
  "prompt_labels",
  {
    id: text("id").primaryKey(),
    promptVersionId: text("prompt_version_id")
      .notNull()
      .references(() => promptVersions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    versionLabelUnique: unique("prompt_labels_version_label_unique").on(
      table.promptVersionId,
      table.label,
    ),
    promptVersionIdIdx: index("prompt_labels_prompt_version_id_idx").on(table.promptVersionId),
    labelIdx: index("prompt_labels_label_idx").on(table.label),
  }),
);

export const experimentRuns = pgTable(
  "experiment_runs",
  {
    id: text("id").primaryKey(),
    experimentId: text("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    datasetItemId: text("dataset_item_id")
      .notNull()
      .references(() => datasetItems.id, { onDelete: "cascade" }),
    output: jsonb("output").$type<Record<string, unknown>>(),
    latencyMs: integer("latency_ms"),
    tokenCount: integer("token_count"),
    cost: doublePrecision("cost"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    experimentIdIdx: index("experiment_runs_experiment_id_idx").on(table.experimentId),
    datasetItemIdIdx: index("experiment_runs_dataset_item_id_idx").on(table.datasetItemId),
  }),
);
