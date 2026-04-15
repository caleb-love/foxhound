'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeModeContextValue {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const THEME_MODE_STORAGE_KEY = 'foxhound-theme-mode';
const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function getSystemResolvedMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getPreferredMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
  if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
    return storedMode;
  }

  return 'light';
}

function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemResolvedMode() : mode;
}

function applyThemeMode(mode: 'light' | 'dark') {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
  root.dataset.themeMode = mode;
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>('light');
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const nextMode = getPreferredMode();
    const nextResolvedMode = resolveThemeMode(nextMode);
    setModeState(nextMode);
    setResolvedMode(nextResolvedMode);
    applyThemeMode(nextResolvedMode);
    setHasHydrated(true);
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    const nextResolvedMode = resolveThemeMode(nextMode);
    setModeState(nextMode);
    setResolvedMode(nextResolvedMode);
    applyThemeMode(nextResolvedMode);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_MODE_STORAGE_KEY, nextMode);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(resolvedMode === 'dark' ? 'light' : 'dark');
  }, [resolvedMode, setMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      const storedMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
      if (storedMode === 'light' || storedMode === 'dark') {
        return;
      }

      const nextResolvedMode: 'light' | 'dark' = event.matches ? 'dark' : 'light';
      setModeState('system');
      setResolvedMode(nextResolvedMode);
      applyThemeMode(nextResolvedMode);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const value = useMemo(
    () => ({ mode, resolvedMode, setMode, toggleMode }),
    [mode, resolvedMode, setMode, toggleMode],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <div
        data-theme-mode={hasHydrated ? mode : undefined}
        data-resolved-theme-mode={hasHydrated ? resolvedMode : undefined}
        className="contents"
      >
        {children}
      </div>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeModeProvider');
  }

  return context;
}
