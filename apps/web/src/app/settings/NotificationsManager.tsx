"use client";

import { useState, useEffect, useCallback } from "react";
import {
  listChannels,
  createChannel,
  listRules,
  createRule,
  sendTestNotification,
  type NotificationChannel,
  type AlertRule,
  type EventType,
  type Severity,
} from "@/lib/notifications";

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  agent_failure: "Agent Failure",
  anomaly_detected: "Anomaly Detected",
  cost_spike: "Cost Spike",
  compliance_violation: "Compliance Violation",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "var(--red)",
  high: "var(--orange)",
  medium: "var(--blue)",
  low: "var(--text-muted)",
};

const EVENT_TYPES: EventType[] = [
  "agent_failure",
  "anomaly_detected",
  "cost_spike",
  "compliance_violation",
];

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

export function NotificationsManager() {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add channel form
  const [channelName, setChannelName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [addingChannel, setAddingChannel] = useState(false);
  const [addChannelError, setAddChannelError] = useState<string | null>(null);

  // Add rule form
  const [ruleEventType, setRuleEventType] = useState<EventType>("agent_failure");
  const [ruleMinSeverity, setRuleMinSeverity] = useState<Severity>("high");
  const [ruleChannelId, setRuleChannelId] = useState("");
  const [addingRule, setAddingRule] = useState(false);
  const [addRuleError, setAddRuleError] = useState<string | null>(null);

  // Test notification state: channelId -> "idle" | "sending" | "sent" | "failed"
  const [testState, setTestState] = useState<Record<string, "idle" | "sending" | "sent" | "failed">>({});

  const fetchData = useCallback(async () => {
    try {
      const [ch, ru] = await Promise.all([listChannels(), listRules()]);
      setChannels(ch);
      setRules(ru);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notification settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function handleAddChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!channelName.trim() || !webhookUrl.trim()) return;
    setAddingChannel(true);
    setAddChannelError(null);
    try {
      const ch = await createChannel({ name: channelName.trim(), webhookUrl: webhookUrl.trim() });
      setChannels((prev) => [...prev, ch]);
      setChannelName("");
      setWebhookUrl("");
      // Auto-select the new channel in the rule form
      setRuleChannelId(ch.id);
    } catch (err) {
      setAddChannelError(err instanceof Error ? err.message : "Failed to add channel");
    } finally {
      setAddingChannel(false);
    }
  }

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!ruleChannelId) return;
    setAddingRule(true);
    setAddRuleError(null);
    try {
      const rule = await createRule({
        eventType: ruleEventType,
        minSeverity: ruleMinSeverity,
        channelId: ruleChannelId,
      });
      setRules((prev) => [...prev, rule]);
    } catch (err) {
      setAddRuleError(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setAddingRule(false);
    }
  }

  async function handleTest(channelId: string) {
    setTestState((prev) => ({ ...prev, [channelId]: "sending" }));
    try {
      await sendTestNotification({ channelId });
      setTestState((prev) => ({ ...prev, [channelId]: "sent" }));
      setTimeout(() => setTestState((prev) => ({ ...prev, [channelId]: "idle" })), 3000);
    } catch {
      setTestState((prev) => ({ ...prev, [channelId]: "failed" }));
      setTimeout(() => setTestState((prev) => ({ ...prev, [channelId]: "idle" })), 4000);
    }
  }

  function channelName_forId(id: string) {
    return channels.find((c) => c.id === id)?.name ?? id;
  }

  if (loading) {
    return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>;
  }

  if (error) {
    return <div style={{ color: "var(--red)", fontSize: 13 }}>{error}</div>;
  }

  const selectStyle: React.CSSProperties = {
    padding: "9px 12px",
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
  };

  const inputStyle: React.CSSProperties = {
    ...selectStyle,
    flex: 1,
  };

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Notifications</h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
        Configure Slack channels and alert rules for agent events.
      </p>

      {/* ── Channels section ── */}
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 12 }}>
        Slack Channels
      </h3>

      {/* Add channel form */}
      <form
        onSubmit={(e) => { void handleAddChannel(e); }}
        style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            placeholder="Channel name (e.g. Production Alerts)"
            required
            style={inputStyle}
          />
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="Slack webhook URL"
            required
            style={{ ...inputStyle, flex: 2 }}
          />
          <button
            type="submit"
            disabled={addingChannel}
            style={{
              padding: "9px 16px",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: addingChannel ? "not-allowed" : "pointer",
              opacity: addingChannel ? 0.7 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {addingChannel ? "Adding…" : "Add channel"}
          </button>
        </div>
        {addChannelError && (
          <div style={{ fontSize: 12, color: "var(--red)", background: "rgba(242,95,92,0.08)", border: "1px solid rgba(242,95,92,0.2)", borderRadius: 6, padding: "8px 12px" }}>
            {addChannelError}
          </div>
        )}
      </form>

      {/* Channel list */}
      {channels.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0", textAlign: "center", background: "var(--surface-2)", borderRadius: 8, marginBottom: 24 }}>
          No channels yet. Add one above.
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 24 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                {["Name", "Kind", "Added", ""].map((h) => (
                  <th
                    key={h}
                    style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.4px", textTransform: "uppercase" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channels.map((ch, i) => {
                const ts = testState[ch.id] ?? "idle";
                return (
                  <tr key={ch.id} className="row-hover" style={{ borderBottom: i < channels.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
                      {ch.name}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--green)", background: "rgba(61,214,140,0.1)", border: "1px solid rgba(61,214,140,0.2)", borderRadius: 4, padding: "2px 8px", textTransform: "uppercase" }}>
                        {ch.kind}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(ch.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        onClick={() => { void handleTest(ch.id); }}
                        disabled={ts === "sending"}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "5px 10px",
                          borderRadius: 5,
                          border: "1px solid var(--border)",
                          cursor: ts === "sending" ? "not-allowed" : "pointer",
                          background: ts === "sent" ? "rgba(61,214,140,0.1)" : ts === "failed" ? "rgba(242,95,92,0.1)" : "var(--surface-2)",
                          color: ts === "sent" ? "var(--green)" : ts === "failed" ? "var(--red)" : "var(--text)",
                          transition: "background 0.2s, color 0.2s",
                        }}
                      >
                        {ts === "sending" ? "Sending…" : ts === "sent" ? "Sent!" : ts === "failed" ? "Failed" : "Test"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Alert Rules section ── */}
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 12 }}>
        Alert Rules
      </h3>

      {channels.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0", textAlign: "center", background: "var(--surface-2)", borderRadius: 8 }}>
          Add a channel above before creating rules.
        </div>
      ) : (
        <>
          {/* Add rule form */}
          <form
            onSubmit={(e) => { void handleAddRule(e); }}
            style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}
          >
            <select
              value={ruleEventType}
              onChange={(e) => setRuleEventType(e.target.value as EventType)}
              style={selectStyle}
            >
              {EVENT_TYPES.map((et) => (
                <option key={et} value={et}>{EVENT_TYPE_LABELS[et]}</option>
              ))}
            </select>

            <select
              value={ruleMinSeverity}
              onChange={(e) => setRuleMinSeverity(e.target.value as Severity)}
              style={selectStyle}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{SEVERITY_LABELS[s]} +</option>
              ))}
            </select>

            <select
              value={ruleChannelId}
              onChange={(e) => setRuleChannelId(e.target.value)}
              required
              style={{ ...selectStyle, flex: 1, minWidth: 160 }}
            >
              <option value="">Select channel…</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>

            <button
              type="submit"
              disabled={addingRule || !ruleChannelId}
              style={{
                padding: "9px 16px",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: addingRule || !ruleChannelId ? "not-allowed" : "pointer",
                opacity: addingRule || !ruleChannelId ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {addingRule ? "Adding…" : "Add rule"}
            </button>
          </form>

          {addRuleError && (
            <div style={{ marginBottom: 12, fontSize: 12, color: "var(--red)", background: "rgba(242,95,92,0.08)", border: "1px solid rgba(242,95,92,0.2)", borderRadius: 6, padding: "8px 12px" }}>
              {addRuleError}
            </div>
          )}

          {rules.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0", textAlign: "center", background: "var(--surface-2)", borderRadius: 8 }}>
              No rules yet. Create one above.
            </div>
          ) : (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                    {["Event", "Min Severity", "Channel", "Status"].map((h) => (
                      <th
                        key={h}
                        style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.4px", textTransform: "uppercase" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule, i) => (
                    <tr key={rule.id} className="row-hover" style={{ borderBottom: i < rules.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text)" }}>
                        {EVENT_TYPE_LABELS[rule.eventType]}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: SEVERITY_COLORS[rule.minSeverity], textTransform: "capitalize" }}>
                          {SEVERITY_LABELS[rule.minSeverity]}+
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-muted)" }}>
                        {channelName_forId(rule.channelId)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: rule.enabled ? "var(--green)" : "var(--text-muted)", background: rule.enabled ? "rgba(61,214,140,0.1)" : "rgba(100,116,139,0.1)", border: `1px solid ${rule.enabled ? "rgba(61,214,140,0.2)" : "rgba(100,116,139,0.2)"}`, borderRadius: 4, padding: "2px 8px", textTransform: "uppercase" }}>
                          {rule.enabled ? "Active" : "Disabled"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
