'use client';

import type { TenantTheme } from '@/lib/theme/types';
import { cn } from '@/lib/utils';

export function ThemePreviewCard({
  theme,
  active,
  onSelect,
}: {
  theme: TenantTheme;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn('w-full rounded-3xl border p-4 text-left transition-all', active ? 'scale-[1.01]' : 'hover:-translate-y-0.5')}
      style={{
        borderColor: active ? theme.colors.accent : theme.colors.panelStroke,
        background: theme.colors.panel,
        boxShadow: theme.shadow.panel,
      }}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold" style={{ color: theme.colors.textPrimary }}>{theme.name}</div>
            <div className="text-sm" style={{ color: theme.colors.textMuted }}>{theme.brandLabel}</div>
          </div>
          {active ? (
            <div className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: theme.colors.accentSoft, color: theme.colors.accent }}>
              Active
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[theme.colors.accent, theme.colors.success, theme.colors.warning, theme.colors.danger, theme.colors.panelAlt].map((color) => (
            <div key={color} className="h-10 rounded-2xl border" style={{ background: color, borderColor: theme.colors.panelStroke }} />
          ))}
        </div>
      </div>
    </button>
  );
}
