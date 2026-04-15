'use client';

import { SessionProvider } from 'next-auth/react';
import { PendoInitializer } from '@/components/pendo-initializer';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PendoInitializer />
      {children}
    </SessionProvider>
  );
}
