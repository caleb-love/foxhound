'use client';

import { SandboxHero, SandboxPage, SandboxPill } from '@/components/sandbox/theme';
import { SdkSimulation } from '@/components/sandbox/sdk-simulation';
import { QualityGateDemo } from '@/components/sandbox/quality-gate-demo';

export default function SandboxSettingsPage() {
  return (
    <SandboxPage>
      <SandboxHero
        eyebrow="Settings"
        title="Workspace settings"
        description="Configure workspace preferences and integrations. Use the light/dark toggle in the top bar to switch appearance modes."
      >
        <SandboxPill>Use the sun/moon toggle in the top bar to switch themes</SandboxPill>
      </SandboxHero>

      <div className="grid gap-4 xl:grid-cols-2">
        <SdkSimulation />
        <QualityGateDemo />
      </div>
    </SandboxPage>
  );
}
