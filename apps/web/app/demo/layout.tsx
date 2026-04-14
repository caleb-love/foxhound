import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { TenantThemeProvider } from '@/components/theme/tenant-theme-provider';

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <TenantThemeProvider>
      <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,var(--tenant-app-bg-accent-a),transparent_26%),radial-gradient(circle_at_top_right,var(--tenant-app-bg-accent-b),transparent_20%),var(--tenant-app-bg)] text-[var(--tenant-text-primary)] transition-colors duration-300">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="relative flex h-18 items-center justify-between border-b px-6 backdrop-blur-xl" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-panel) 85%, transparent)' }}>
            <div className="flex items-center gap-4">
              <div className="rounded-full border px-3 py-1 text-sm font-medium shadow-sm" style={{ borderColor: 'color-mix(in srgb, var(--tenant-warning) 35%, transparent)', background: 'color-mix(in srgb, var(--tenant-warning) 12%, transparent)', color: 'var(--tenant-text-primary)' }}>
                Demo Mode
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--tenant-text-primary)' }}>Shared narrative demo tenant</p>
                <p className="text-xs" style={{ color: 'var(--tenant-text-muted)' }}>Whitelabel-friendly shell · reusable data-driven surfaces</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              {['Overview', 'Investigate', 'Improve', 'Govern'].map((item) => (
                <div key={item} className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)', color: 'var(--tenant-text-secondary)' }}>
                  {item}
                </div>
              ))}
            </div>
          </header>
          <main className="flex-1 overflow-y-auto px-6 py-6">
            {children}
          </main>
        </div>
      </div>
    </TenantThemeProvider>
  );
}
