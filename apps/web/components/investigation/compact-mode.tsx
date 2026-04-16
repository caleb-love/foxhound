'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type DensityMode = 'comfortable' | 'compact';

interface CompactModeContextValue {
  mode: DensityMode;
  toggle: () => void;
  isCompact: boolean;
}

const CompactModeContext = createContext<CompactModeContextValue>({
  mode: 'comfortable',
  toggle: () => {},
  isCompact: false,
});

const STORAGE_KEY = 'foxhound-density-mode';

/**
 * Applies compact-mode CSS class to the document element.
 * The class `density-compact` reduces spacing, text sizes, and padding
 * via CSS custom properties. This is purely visual with zero layout changes.
 */
function applyDensityClass(mode: DensityMode) {
  if (typeof document === 'undefined') return;
  if (mode === 'compact') {
    document.documentElement.classList.add('density-compact');
  } else {
    document.documentElement.classList.remove('density-compact');
  }
}

function readStoredMode(): DensityMode {
  if (typeof window === 'undefined') return 'comfortable';
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'compact' ? 'compact' : 'comfortable';
}

export function CompactModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DensityMode>(readStoredMode);

  // Apply the class on mount and when mode changes
  useEffect(() => {
    applyDensityClass(mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'comfortable' ? 'compact' : 'comfortable';
      localStorage.setItem(STORAGE_KEY, next);
      applyDensityClass(next);
      return next;
    });
  }, []);

  return (
    <CompactModeContext.Provider value={{ mode, toggle, isCompact: mode === 'compact' }}>
      {children}
    </CompactModeContext.Provider>
  );
}

export function useCompactMode() {
  return useContext(CompactModeContext);
}

/**
 * A small toggle button for the app shell header.
 * Shows the current density mode and toggles on click.
 */
export function CompactModeToggle() {
  const { mode, toggle } = useCompactMode();

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:border-[color:color-mix(in_srgb,var(--tenant-accent)_24%,var(--tenant-panel-stroke))]"
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        background: 'var(--card)',
        color: 'var(--tenant-text-muted)',
      }}
      title={`Switch to ${mode === 'comfortable' ? 'compact' : 'comfortable'} density`}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        {mode === 'comfortable' ? (
          /* Comfortable icon: wider lines */
          <>
            <line x1="2" y1="4" x2="14" y2="4" />
            <line x1="2" y1="8" x2="14" y2="8" />
            <line x1="2" y1="12" x2="14" y2="12" />
          </>
        ) : (
          /* Compact icon: tighter lines */
          <>
            <line x1="2" y1="3" x2="14" y2="3" />
            <line x1="2" y1="6" x2="14" y2="6" />
            <line x1="2" y1="9" x2="14" y2="9" />
            <line x1="2" y1="12" x2="14" y2="12" />
          </>
        )}
      </svg>
      <span>{mode === 'comfortable' ? 'Comfortable' : 'Compact'}</span>
    </button>
  );
}
