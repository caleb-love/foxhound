'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { allTenantThemes, foxhoundMidnightTheme, getTenantThemeById } from '@/lib/theme/presets';
import { themeToCssVars } from '@/lib/theme/theme-to-css-vars';
import type { TenantTheme } from '@/lib/theme/types';

interface TenantThemeContextValue {
  theme: TenantTheme;
  themes: TenantTheme[];
  setThemeById: (id: string) => void;
}

const TenantThemeContext = createContext<TenantThemeContextValue | null>(null);

export function TenantThemeProvider({ children, initialThemeId = foxhoundMidnightTheme.id }: { children: ReactNode; initialThemeId?: string }) {
  const [themeId, setThemeId] = useState(initialThemeId);
  const theme = useMemo(() => getTenantThemeById(themeId), [themeId]);
  const value = useMemo(() => ({ theme, themes: allTenantThemes, setThemeById: setThemeId }), [theme]);

  return (
    <TenantThemeContext.Provider value={value}>
      <div style={themeToCssVars(theme)} data-tenant-theme={theme.id}>
        {children}
      </div>
    </TenantThemeContext.Provider>
  );
}

export function useTenantTheme() {
  const context = useContext(TenantThemeContext);
  if (!context) {
    throw new Error('useTenantTheme must be used within TenantThemeProvider');
  }
  return context;
}
