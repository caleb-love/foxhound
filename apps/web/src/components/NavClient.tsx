"use client";

import { useAuth } from "@/components/AuthProvider";

export function NavClient() {
  const { user, loading, logout } = useAuth();

  if (loading) return null;

  if (!user) return null;

  return (
    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{user.orgName}</span>
      <a href="/settings" style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Settings
      </a>
      <button
        onClick={logout}
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        Logout
      </button>
    </div>
  );
}
