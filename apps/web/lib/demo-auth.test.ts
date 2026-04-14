import { describe, it, expect, vi, beforeEach } from 'vitest';

const redirectMock = vi.fn();
const getServerSessionMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('demo auth helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env['FOXHOUND_UI_DEMO_MODE'];
  });

  it('reports demo mode when env flag is true', async () => {
    process.env['FOXHOUND_UI_DEMO_MODE'] = 'true';
    const mod = await import('./demo-auth');
    expect(mod.isDashboardDemoModeEnabled()).toBe(true);
  });

  it('returns a demo session when demo mode is enabled and no real session exists', async () => {
    process.env['FOXHOUND_UI_DEMO_MODE'] = 'true';
    getServerSessionMock.mockResolvedValue(null);
    const mod = await import('./demo-auth');

    const session = await mod.getDashboardSessionOrDemo();
    expect(session.user.name).toBe('Demo Operator');
    expect(session.user.token).toBe('demo-token');
  });

  it('redirects to login when demo mode is off and no session exists', async () => {
    getServerSessionMock.mockResolvedValue(null);
    const mod = await import('./demo-auth');

    await mod.getDashboardSessionOrDemo();
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });
});
