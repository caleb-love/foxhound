import type { TenantTheme } from "./types";

export const foxhoundMidnightTheme: TenantTheme = {
  id: "foxhound-midnight",
  name: "Foxhound Marketing Default",
  brandLabel: "Foxhound",
  colors: {
    appBg: "linear-gradient(180deg,#f8fbff 0%,#ffffff 22%,#ffffff 100%)",
    appBgAccentA: "rgba(37,99,235,0.08)",
    appBgAccentB: "rgba(147,51,234,0.08)",
    panel: "rgba(255,255,255,0.82)",
    panelAlt: "rgba(248,250,252,0.92)",
    panelStroke: "rgba(148,163,184,0.18)",
    textPrimary: "#111827",
    textSecondary: "#4b5563",
    textMuted: "#6b7280",
    accent: "#2563eb",
    accentSoft: "rgba(37,99,235,0.08)",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
  },
  radius: {
    panel: "1.5rem",
    pill: "999px",
    button: "1rem",
  },
  shadow: {
    panel: "0 20px 45px -28px rgba(15,23,42,0.28)",
    hero: "0 20px 50px -26px rgba(37,99,235,0.18)",
  },
};

export const pendoGuidesTheme: TenantTheme = {
  id: "pendo-guides",
  name: "Pendo Guides",
  brandLabel: "Guides Workspace",
  colors: {
    appBg: "linear-gradient(180deg,#f7fbff 0%,#eef5fb 100%)",
    appBgAccentA: "rgba(59,130,246,0.12)",
    appBgAccentB: "rgba(14,165,233,0.08)",
    panel: "rgba(255,255,255,0.88)",
    panelAlt: "rgba(15,23,42,0.03)",
    panelStroke: "rgba(148,163,184,0.22)",
    textPrimary: "#0f172a",
    textSecondary: "#1e293b",
    textMuted: "#64748b",
    accent: "#2563eb",
    accentSoft: "rgba(37,99,235,0.10)",
    success: "#16a34a",
    warning: "#d97706",
    danger: "#dc2626",
  },
  radius: {
    panel: "1.25rem",
    pill: "999px",
    button: "0.9rem",
  },
  shadow: {
    panel: "0 18px 40px rgba(15,23,42,0.08)",
    hero: "0 28px 56px rgba(37,99,235,0.08)",
  },
};

export const foxhoundOpsTheme: TenantTheme = {
  id: "foxhound-ops",
  name: "Foxhound Ops (Dark)",
  brandLabel: "Foxhound",
  colors: {
    appBg: "linear-gradient(180deg,#0B1120 0%,#0D1526 40%,#101A2E 100%)",
    appBgAccentA: "rgba(34,211,238,0.06)",
    appBgAccentB: "rgba(99,102,241,0.05)",
    panel: "rgba(15,23,42,0.78)",
    panelAlt: "rgba(20,30,52,0.72)",
    panelStroke: "rgba(71,85,134,0.22)",
    textPrimary: "#e2e8f0",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    accent: "#38bdf8",
    accentSoft: "rgba(56,189,248,0.10)",
    success: "#34d399",
    warning: "#fbbf24",
    danger: "#f87171",
  },
  radius: {
    panel: "1.25rem",
    pill: "999px",
    button: "0.75rem",
  },
  shadow: {
    panel: "0 20px 50px -20px rgba(0,0,0,0.5), 0 0 0 1px rgba(56,189,248,0.04)",
    hero: "0 24px 60px -24px rgba(56,189,248,0.12)",
  },
};

export const allTenantThemes: TenantTheme[] = [
  foxhoundOpsTheme,
  foxhoundMidnightTheme,
  pendoGuidesTheme,
];

export function getTenantThemeById(id: string): TenantTheme {
  return allTenantThemes.find((theme) => theme.id === id) ?? foxhoundMidnightTheme;
}
