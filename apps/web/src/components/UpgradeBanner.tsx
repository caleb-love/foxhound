"use client";

interface Props {
  feature: string;
  description?: string;
}

export function UpgradeBanner({ feature, description }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "10px 16px",
        background: "rgba(107, 122, 255, 0.06)",
        border: "1px solid rgba(107, 122, 255, 0.2)",
        borderRadius: 8,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: "var(--accent)",
            background: "rgba(107, 122, 255, 0.15)",
            border: "1px solid rgba(107, 122, 255, 0.3)",
            borderRadius: 4,
            padding: "2px 6px",
            flexShrink: 0,
          }}
        >
          Pro
        </span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {description ?? `${feature} is a Pro feature.`}
        </span>
      </div>
      <a
        href="/pricing"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--accent)",
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Upgrade to unlock →
      </a>
    </div>
  );
}
