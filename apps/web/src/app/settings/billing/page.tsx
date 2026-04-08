"use client";

export default function BillingPage() {
  return (
    <div style={{ padding: "32px 24px", maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Billing & Plan</h1>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "24px",
        }}
      >
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
          Foxhound is self-hosted and open-source. All features are available at no cost.
          Paid plans with additional support and managed hosting are coming soon.
        </p>
      </div>
    </div>
  );
}
