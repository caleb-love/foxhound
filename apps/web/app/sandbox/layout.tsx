import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';

export default function SandboxLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell mode="sandbox">
      {children}
    </AppShell>
  );
}
