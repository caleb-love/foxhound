import { describe, it, expect, vi, beforeEach } from 'vitest';

const redirectMock = vi.fn();
const isDemoModeEnabledMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

vi.mock('@/lib/sandbox-auth', () => ({
  isDashboardSandboxModeEnabled: () => isDemoModeEnabledMock(),
}));

describe('app/page', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('redirects to the sandbox landing page when sandbox mode is enabled', async () => {
    isDemoModeEnabledMock.mockReturnValue(true);
    const mod = await import('./page');
    await mod.default();
    expect(redirectMock).toHaveBeenCalledWith('/sandbox');
  });

  it('redirects to login when sandbox mode is disabled', async () => {
    isDemoModeEnabledMock.mockReturnValue(false);
    const mod = await import('./page');
    await mod.default();
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });
});
