'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useThemeMode, type ThemeMode } from '@/components/theme/theme-mode-provider';
import { cn } from '@/lib/utils';

const themeModeOptions: Array<{
  mode: ThemeMode;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    mode: 'light',
    label: 'Light',
    description: 'Bright operator workspace with the original Foxhound surface treatment.',
    icon: Sun,
  },
  {
    mode: 'dark',
    label: 'Dark',
    description: 'Low-glare workspace for long investigative sessions and contrast-heavy review.',
    icon: Moon,
  },
  {
    mode: 'system',
    label: 'System',
    description: 'Follow the device preference automatically and keep the UI aligned with the OS.',
    icon: Monitor,
  },
];

export function ThemeModeSettings() {
  const { mode, resolvedMode, setMode } = useThemeMode();

  return (
    <div className="grid gap-3">
      {themeModeOptions.map((option) => {
        const Icon = option.icon;
        const isActive = mode === option.mode;

        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => setMode(option.mode)}
            className={cn('grid gap-2 rounded-2xl border p-4 text-left transition-colors')}
            style={isActive
              ? {
                  borderColor: 'color-mix(in srgb, var(--tenant-accent) 48%, transparent)',
                  background: 'color-mix(in srgb, var(--tenant-accent) 16%, var(--card))',
                }
              : {
                  borderColor: 'var(--tenant-panel-stroke)',
                  background: 'color-mix(in srgb, var(--card) 88%, var(--background))',
                }}
            aria-pressed={isActive}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: isActive ? 'color-mix(in srgb, var(--tenant-accent) 45%, transparent)' : 'var(--tenant-panel-stroke)',
                    background: isActive ? 'color-mix(in srgb, var(--tenant-accent) 18%, var(--card))' : 'var(--card)',
                    color: isActive ? 'var(--tenant-accent)' : 'var(--tenant-text-secondary)',
                  }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium text-tenant-text-primary">{option.label}</div>
                  <div className="text-sm text-tenant-text-muted">{option.description}</div>
                </div>
              </div>
              <div
                className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{
                  borderColor: isActive ? 'color-mix(in srgb, var(--tenant-accent) 35%, transparent)' : 'var(--tenant-panel-stroke)',
                  background: isActive ? 'color-mix(in srgb, var(--tenant-accent) 18%, var(--card))' : 'var(--card)',
                  color: isActive ? 'var(--tenant-accent)' : 'var(--tenant-text-muted)',
                }}
              >
                {isActive ? 'Active' : 'Available'}
              </div>
            </div>
            {option.mode === 'system' ? (
              <div className="text-xs text-tenant-text-muted">
                Current resolved mode: <span style={{ color: 'var(--tenant-text-primary)' }}>{resolvedMode}</span>
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
