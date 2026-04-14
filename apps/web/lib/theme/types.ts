export interface TenantTheme {
  id: string;
  name: string;
  brandLabel: string;
  colors: {
    appBg: string;
    appBgAccentA: string;
    appBgAccentB: string;
    panel: string;
    panelAlt: string;
    panelStroke: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    accentSoft: string;
    success: string;
    warning: string;
    danger: string;
  };
  radius: {
    panel: string;
    pill: string;
    button: string;
  };
  shadow: {
    panel: string;
    hero: string;
  };
}
