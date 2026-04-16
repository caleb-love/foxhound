'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';
import { PendoInitializer } from '@/components/pendo-initializer';
import { ThemeModeProvider } from '@/components/theme/theme-mode-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeModeProvider>
        <PendoInitializer />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            },
          }}
        />
        {children}
      </ThemeModeProvider>
    </SessionProvider>
  );
}
