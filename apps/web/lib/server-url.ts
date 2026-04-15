import { headers } from 'next/headers';

export async function getRequestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');

  if (!host) {
    throw new Error('Unable to determine request host for server-side fetches.');
  }

  const protocol = headerStore.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');

  return `${protocol}://${host}`;
}

export async function getRequestUrl(path: string) {
  const origin = await getRequestOrigin();
  return new URL(path, origin).toString();
}
