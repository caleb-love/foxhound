'use client';

import { DemoHero, DemoPage, DemoPill } from '@/components/demo/demo-theme';
import { ThemePreviewCard } from '@/components/theme/theme-preview-card';
import { useTenantTheme } from '@/components/theme/tenant-theme-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DemoSettingsPage() {
  const { theme, themes, setThemeById } = useTenantTheme();

  return (
    <DemoPage>
      <DemoHero
        eyebrow="Settings · Tenant Theme"
        title="Theme control center"
        description="Preview and switch tenant visual presets from one place. This is the architectural seam for future whitelabeling so each company can make the platform feel like their own product without editing every page."
      >
        <DemoPill>Active theme: {theme.name}</DemoPill>
        <DemoPill>Brand label: {theme.brandLabel}</DemoPill>
      </DemoHero>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="backdrop-blur-xl" style={{ color: 'var(--tenant-text-primary)', borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)', boxShadow: 'var(--tenant-shadow-panel)' }}>
          <CardHeader>
            <CardTitle>Theme presets</CardTitle>
            <CardDescription style={{ color: 'var(--tenant-text-muted)' }}>
              Switch between reusable presets to preview how the shell, panels, and dashboard primitives respond to tenant branding.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {themes.map((preset) => (
              <ThemePreviewCard
                key={preset.id}
                theme={preset}
                active={preset.id === theme.id}
                onSelect={() => setThemeById(preset.id)}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl" style={{ color: 'var(--tenant-text-primary)', borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)', boxShadow: 'var(--tenant-shadow-panel)' }}>
          <CardHeader>
            <CardTitle>Theme token preview</CardTitle>
            <CardDescription style={{ color: 'var(--tenant-text-muted)' }}>
              These semantic values are what reusable dashboard primitives consume.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Accent', 'var(--tenant-accent)'],
                ['Accent soft', 'var(--tenant-accent-soft)'],
                ['Panel', 'var(--tenant-panel)'],
                ['Panel alt', 'var(--tenant-panel-alt)'],
                ['Success', 'var(--tenant-success)'],
                ['Warning', 'var(--tenant-warning)'],
                ['Danger', 'var(--tenant-danger)'],
                ['Text muted', 'var(--tenant-text-muted)'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border p-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
                  <div className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--tenant-text-muted)' }}>{label}</div>
                  <div className="mt-2 rounded-xl border p-3" style={{ borderColor: 'var(--tenant-panel-stroke)', background: value }} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DemoPage>
  );
}
