'use client';

import { Moon, Sun } from 'lucide-react';
import { useThemeMode } from '@/components/theme/theme-mode-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export function ThemeModeToggleButton() {
  const { resolvedMode, toggleMode } = useThemeMode();
  const isDark = resolvedMode === 'dark';
  const Icon = isDark ? Sun : Moon;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleMode}
      className="rounded-full border shadow-sm backdrop-blur"
      style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-panel) 92%, transparent)' }}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

export function ThemeModeToggleMenuItem() {
  const { resolvedMode, toggleMode } = useThemeMode();
  const isDark = resolvedMode === 'dark';
  const Icon = isDark ? Sun : Moon;

  return (
    <DropdownMenuItem onClick={toggleMode}>
      <Icon className="mr-2 h-4 w-4" />
      {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    </DropdownMenuItem>
  );
}
