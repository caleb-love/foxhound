import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const traces = pgTable(
  "traces",
  {
    id: text("id").primaryKey(),
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
  }),
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
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
    agentIdIdx: index("audit_events_agent_id_idx").on(table.agentId),
    timestampIdx: index("audit_events_timestamp_idx").on(table.timestamp),
    eventTypeIdx: index("audit_events_event_type_idx").on(table.eventType),
  }),
);
