import { describe, it, expect, vi, beforeEach } from 'vitest';

const redirectMock = vi.fn();
const isDemoModeEnabledMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

vi.mock('@/lib/demo-auth', () => ({
  isDashboardDemoModeEnabled: () => isDemoModeEnabledMock(),
}));

describe('app/page', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('goes to the real dashboard root when demo mode is enabled', async () => {
    isDemoModeEnabledMock.mockReturnValue(true);
    const mod = await import('./page');
    await mod.default();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redirects to login when demo mode is disabled', async () => {
    isDemoModeEnabledMock.mockReturnValue(false);
    const mod = await import('./page');
    await mod.default();
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });
});
