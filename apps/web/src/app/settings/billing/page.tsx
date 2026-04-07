"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { usePlan } from "@/hooks/usePlan";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

const PLAN_COLORS: Record<string, string> = {
  free: "var(--text-muted)",
  pro: "var(--accent)",
  enterprise: "var(--purple)",
};

function fmtNumber(n: number): string {
  if (n < 0) return "Unlimited";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function isStripeUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "checkout.stripe.com" || hostname === "billing.stripe.com";
  } catch {
    return false;
  }
}

export default function BillingPage() {
  const { loading: authLoading } = useAuth();
  const { plan, spansUsed, spansLimit, loading: planLoading } = usePlan();
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("checkout") === "success") {
        setCheckoutSuccess(true);
      }
    }
  }, []);

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      if (!res.ok) throw new Error("Portal session failed");
      const { url } = (await res.json()) as { url: string };
      if (!isStripeUrl(url)) throw new Error("Invalid redirect URL");
      window.location.href = url;
    } catch {
      alert("Could not open billing portal. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleUpgrade() {
    setCheckoutLoading(true);
    try {
      const origin = window.location.origin;
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "pro_monthly",
          successUrl: `${origin}/settings/billing?checkout=success`,
          cancelUrl: `${origin}/settings/billing`,
        }),
      });
      if (!res.ok) throw new Error("Checkout failed");
      const { url } = (await res.json()) as { url: string };
      if (!isStripeUrl(url)) throw new Error("Invalid redirect URL");
      window.location.href = url;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (authLoading || planLoading) {
    return (
      <div style={{ padding: "32px 24px", color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
    );
  }

  const usagePct = spansLimit > 0 ? Math.min(100, Math.round((spansUsed / spansLimit) * 100)) : 0;
  const usageColor =
    usagePct >= 90 ? "var(--red)" : usagePct >= 70 ? "var(--orange)" : "var(--accent)";

  return (
    <div style={{ padding: "32px 24px", maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 32 }}>Billing & Plan</h1>

      {checkoutSuccess && (
        <div
          style={{
            marginBottom: 24,
            background: "rgba(61, 214, 140, 0.1)",
            border: "1px solid rgba(61, 214, 140, 0.3)",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 13,
            color: "var(--green)",
          }}
        >
          Subscription activated — welcome to Pro!
        </div>
      )}

      {/* Current plan */}
      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "20px 24px",
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Current plan</h2>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                background: `color-mix(in srgb, ${PLAN_COLORS[plan] ?? "var(--text-muted)"} 15%, transparent)`,
                border: `1px solid color-mix(in srgb, ${PLAN_COLORS[plan] ?? "var(--text-muted)"} 40%, transparent)`,
                color: PLAN_COLORS[plan] ?? "var(--text-muted)",
              }}
            >
              {PLAN_LABELS[plan] ?? plan}
            </span>
            {plan === "free" && (
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Upgrade to unlock replay, run diff &amp; more
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {plan !== "free" && (
              <button
                onClick={() => {
                  void handleManageSubscription();
                }}
                disabled={portalLoading}
                style={{
                  padding: "8px 14px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                  cursor: portalLoading ? "not-allowed" : "pointer",
                  opacity: portalLoading ? 0.6 : 1,
                }}
              >
                {portalLoading ? "Opening…" : "Manage subscription"}
              </button>
            )}
            {plan === "free" && (
              <button
                onClick={() => {
                  void handleUpgrade();
                }}
                disabled={checkoutLoading}
                style={{
                  padding: "8px 14px",
                  background: checkoutLoading ? "rgba(107,122,255,0.5)" : "var(--accent)",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  cursor: checkoutLoading ? "not-allowed" : "pointer",
                }}
              >
                {checkoutLoading ? "Redirecting…" : "Upgrade to Pro"}
              </button>
            )}
            <a
              href="/pricing"
              style={{
                padding: "8px 14px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-muted)",
                textDecoration: "none",
              }}
            >
              View plans
            </a>
          </div>
        </div>
      </section>

      {/* Usage */}
      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "20px 24px",
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Usage this month</h2>

        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Spans ingested</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              {fmtNumber(spansUsed)}
              {spansLimit > 0 && (
                <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                  {" "}
                  / {fmtNumber(spansLimit)}
                </span>
              )}
            </span>
          </div>

          {spansLimit > 0 && (
            <div
              style={{
                height: 6,
                background: "var(--surface-2)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${usagePct}%`,
                  height: "100%",
                  background: usageColor,
                  borderRadius: 3,
                  transition: "width 0.3s",
                }}
              />
            </div>
          )}

          {usagePct >= 90 && (
            <p
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "var(--orange)",
              }}
            >
              You&apos;ve used {usagePct}% of your monthly span limit.{" "}
              {plan === "free" ? (
                <a href="/pricing" style={{ color: "var(--accent)" }}>
                  Upgrade to Pro
                </a>
              ) : (
                "Consider upgrading to Enterprise for unlimited spans."
              )}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
