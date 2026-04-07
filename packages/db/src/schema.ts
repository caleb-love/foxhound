import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  unique,
  primaryKey,
  integer,
} from "drizzle-orm/pg-core";

// ──────────────────────────────────────────────────────────────────────────────
// Auth / multi-tenancy tables
// ──────────────────────────────────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan", { enum: ["free", "pro", "enterprise"] })
    .notNull()
    .default("free"),
  stripeCustomerId: text("stripe_customer_id"),
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
    /** Tenant isolation — every trace belongs to an org */
    orgId: text("org_id").references(() => organizations.id),
    agentId: text("agent_id").notNull(),
    sessionId: text("session_id"),
    startTimeMs: text("start_time_ms").notNull(),
    endTimeMs: text("end_time_ms"),
    spans: jsonb("spans").notNull().$type<unknown[]>(),
    metadata: jsonb("metadata").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    agentIdIdx: index("traces_agent_id_idx").on(table.agentId),
    sessionIdIdx: index("traces_session_id_idx").on(table.sessionId),
    orgIdIdx: index("traces_org_id_idx").on(table.orgId),
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
