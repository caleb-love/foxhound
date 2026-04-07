"use client";

import { useState, useEffect, useCallback } from "react";
import { listApiKeys, createApiKey, revokeApiKey, type ApiKey } from "@/lib/apikeys";

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Revealed key (shown once after creation)
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const data = await listApiKeys();
      setKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchKeys();
  }, [fetchKeys]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createApiKey(newKeyName.trim());
      setRevealedKey(result.key);
      setNewKeyName("");
      void fetchKeys();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this API key? This action cannot be undone.")) return;
    try {
      await revokeApiKey(id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke key");
    }
  }

  function copyKey() {
    if (!revealedKey) return;
    void navigator.clipboard.writeText(revealedKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>API Keys</h2>

      {/* Create form */}
      <form
        onSubmit={(e) => {
          void handleCreate(e);
        }}
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name (e.g. production)"
          required
          style={{
            flex: 1,
            padding: "9px 12px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text)",
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={creating}
          style={{
            padding: "9px 16px",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: creating ? "not-allowed" : "pointer",
            opacity: creating ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {creating ? "Creating…" : "Create key"}
        </button>
      </form>

      {createError && (
        <div
          style={{
            marginBottom: 16,
            fontSize: 13,
            color: "var(--red)",
            background: "rgba(255,80,80,0.08)",
            border: "1px solid rgba(255,80,80,0.2)",
            borderRadius: 6,
            padding: "8px 12px",
          }}
        >
          {createError}
        </div>
      )}

      {/* Revealed key modal */}
      {revealedKey && (
        <div
          style={{
            marginBottom: 20,
            background: "rgba(107,122,255,0.08)",
            border: "1px solid rgba(107,122,255,0.3)",
            borderRadius: 8,
            padding: "16px 20px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--accent)",
              marginBottom: 8,
            }}
          >
            New API key — copy it now, it won&apos;t be shown again
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code
              style={{
                flex: 1,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "8px 10px",
                wordBreak: "break-all",
                color: "var(--text)",
              }}
            >
              {revealedKey}
            </code>
            <button
              onClick={copyKey}
              style={{
                padding: "8px 12px",
                background: copied ? "var(--green)" : "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                color: copied ? "#fff" : "var(--text)",
                whiteSpace: "nowrap",
                transition: "background 0.2s",
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setRevealedKey(null)}
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Key list */}
      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
      ) : error ? (
        <div style={{ color: "var(--red)", fontSize: 13 }}>{error}</div>
      ) : keys.length === 0 ? (
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: 13,
            padding: "24px 0",
            textAlign: "center",
          }}
        >
          No API keys yet. Create one above.
        </div>
      ) : (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "var(--surface-2)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {["Name", "Prefix", "Created", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      letterSpacing: "0.4px",
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((key, i) => (
                <tr
                  key={key.id}
                  style={{
                    borderBottom: i < keys.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text)" }}>
                    {key.name}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    {key.prefix}…
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    {new Date(key.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button
                      onClick={() => {
                        void handleRevoke(key.id);
                      }}
                      style={{
                        fontSize: 12,
                        color: "var(--red)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        fontWeight: 600,
                      }}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
