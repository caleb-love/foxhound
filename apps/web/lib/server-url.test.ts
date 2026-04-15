import { beforeEach, describe, expect, it, vi } from 'vitest';

const headersMock = vi.fn();

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

describe('server URL helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    headersMock.mockReset();
  });

  it('prefers forwarded host and protocol when present', async () => {
    headersMock.mockResolvedValue({
      get(key: string) {
        if (key === 'x-forwarded-host') return 'sandbox.foxhound.dev';
        if (key === 'x-forwarded-proto') return 'https';
        if (key === 'host') return 'localhost:3001';
        return null;
      },
    });

    const { getRequestOrigin, getRequestUrl } = await import('./server-url');

    await expect(getRequestOrigin()).resolves.toBe('https://sandbox.foxhound.dev');
    await expect(getRequestUrl('/api/sandbox/traces')).resolves.toBe('https://sandbox.foxhound.dev/api/sandbox/traces');
  });

  it('falls back to local http when host is localhost', async () => {
    headersMock.mockResolvedValue({
      get(key: string) {
        if (key === 'host') return 'localhost:3001';
        return null;
      },
    });

    const { getRequestOrigin } = await import('./server-url');

    await expect(getRequestOrigin()).resolves.toBe('http://localhost:3001');
  });

  it('throws when no host headers are available', async () => {
    headersMock.mockResolvedValue({
      get() {
        return null;
      },
    });

    const { getRequestOrigin } = await import('./server-url');

    await expect(getRequestOrigin()).rejects.toThrow('Unable to determine request host');
  });
});
