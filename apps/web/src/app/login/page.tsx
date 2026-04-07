"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/lib/auth";

function safeRedirectPath(raw: string | null): string {
  if (!raw) return "/traces";
  // Only allow relative paths starting with / to prevent open redirect
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/traces";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = safeRedirectPath(searchParams.get("from"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push(from);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - 48px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Brand mark */}
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            background: "var(--accent)",
            color: "#fff",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "1px",
          }}
        >
          FOX
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)", letterSpacing: "0.5px" }}>
          AI Agent Observability
        </span>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "32px 28px",
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Sign in</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
          Sign in to your Foxhound account
        </p>

        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                padding: "9px 12px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                padding: "9px 12px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                fontSize: 13,
                color: "var(--red)",
                background: "rgba(255,80,80,0.08)",
                border: "1px solid rgba(255,80,80,0.2)",
                borderRadius: 6,
                padding: "8px 12px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              padding: "10px 16px",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
          Don&apos;t have an account?{" "}
          <a href="/signup" style={{ color: "var(--accent)" }}>
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
