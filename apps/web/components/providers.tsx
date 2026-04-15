'use client';

import { SessionProvider } from 'next-auth/react';
import { PendoInitializer } from '@/components/pendo-initializer';
import { ThemeModeProvider } from '@/components/theme/theme-mode-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeModeProvider>
        <PendoInitializer />
        {children}
      </ThemeModeProvider>
    </SessionProvider>
  );
}
