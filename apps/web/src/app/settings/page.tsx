"use client";

import { useAuth } from "@/components/AuthProvider";
import { ApiKeyManager } from "./ApiKeyManager";

export default function SettingsPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: "32px 24px", color: "var(--text-muted)", fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 24px", maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 32 }}>Settings</h1>

      {/* Organization */}
      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "20px 24px",
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Organization</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <span
              style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", width: 80 }}
            >
              Name
            </span>
            <span style={{ fontSize: 13, color: "var(--text)" }}>{user?.orgName ?? "—"}</span>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <span
              style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", width: 80 }}
            >
              Slug
            </span>
            <span
              style={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
              }}
            >
              {user?.orgSlug ?? "—"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <span
              style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", width: 80 }}
            >
              User
            </span>
            <span style={{ fontSize: 13, color: "var(--text)" }}>{user?.email ?? "—"}</span>
          </div>
        </div>
      </section>

      {/* API Keys */}
      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "20px 24px",
        }}
      >
        <ApiKeyManager />
      </section>
    </div>
  );
}
