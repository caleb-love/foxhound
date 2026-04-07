"use client";

import { useAuth } from "@/components/AuthProvider";

export function NavClient() {
  const { user, loading, logout } = useAuth();

  if (loading) return null;

  if (!user) return null;

  return (
    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        {user.orgName}
      </span>
      <a href="/settings" className="nav-link">
        Settings
      </a>
      <a href="/settings/billing" className="nav-link">
        Billing
      </a>
      <button
        onClick={logout}
        className="nav-link"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          fontFamily: "inherit",
        }}
      >
        Logout
      </button>
    </div>
  );
}
