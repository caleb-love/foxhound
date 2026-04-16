import type { CSSProperties } from 'react';
import type { TenantTheme } from './types';

export function themeToCssVars(theme: TenantTheme): CSSProperties {
  return {
    ['--tenant-app-bg' as string]: theme.colors.appBg,
    ['--tenant-app-bg-accent-a' as string]: theme.colors.appBgAccentA,
    ['--tenant-app-bg-accent-b' as string]: theme.colors.appBgAccentB,
    ['--tenant-panel' as string]: theme.colors.panel,
    ['--tenant-panel-alt' as string]: theme.colors.panelAlt,
    ['--tenant-panel-stroke' as string]: theme.colors.panelStroke,
    ['--tenant-text-primary' as string]: theme.colors.textPrimary,
    ['--tenant-text-secondary' as string]: theme.colors.textSecondary,
    ['--tenant-text-muted' as string]: theme.colors.textMuted,
    ['--tenant-accent' as string]: theme.colors.accent,
    ['--tenant-accent-soft' as string]: theme.colors.accentSoft,
    ['--tenant-success' as string]: theme.colors.success,
    ['--tenant-warning' as string]: theme.colors.warning,
    ['--tenant-danger' as string]: theme.colors.danger,
    ['--tenant-radius-panel' as string]: theme.radius.panel,
    ['--tenant-radius-pill' as string]: theme.radius.pill,
    ['--tenant-radius-button' as string]: theme.radius.button,
    ['--tenant-shadow-panel' as string]: theme.shadow.panel,
    ['--tenant-shadow-hero' as string]: theme.shadow.hero,
    ['--tenant-panel-strong' as string]: theme.colors.panelAlt,
    ['--tenant-radius-control-tight' as string]: `calc(${theme.radius.button} - 0.25rem)`,
  };
}
