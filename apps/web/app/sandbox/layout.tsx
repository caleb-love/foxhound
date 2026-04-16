import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { GuidedTour } from '@/components/sandbox/guided-tour';

export default function SandboxLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell mode="sandbox">
      {children}
      <GuidedTour />
    </AppShell>
  );
}
