interface DemoModeBannerProps {
  userName: string;
}

export function DemoModeBanner({ userName }: DemoModeBannerProps) {
  return (
    <div className="relative z-10 border-b px-6 py-3 text-sm backdrop-blur" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-warning) 12%, white)', color: 'var(--tenant-text-primary)' }}>
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4">
        <div>
          <span className="font-semibold">Demo mode enabled.</span>{' '}
          Dashboard auth is bypassed for local preview only, and pages may show seeded example data.
        </div>
        <div className="rounded-full border px-3 py-1 text-xs font-medium shadow-sm" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)', color: 'var(--tenant-text-secondary)' }}>
          Signed in as {userName}
        </div>
      </div>
    </div>
  );
}
