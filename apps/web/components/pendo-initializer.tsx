'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

declare global {
  interface Window {
    pendo?: {
      initialize: (config: { visitor: { id: string } }) => void;
      identify: (config: {
        visitor: {
          id: string;
          email: string;
          full_name: string;
          role: string | null;
        };
        account: {
          id: string;
          name: string | null;
          slug: string | null;
        };
      }) => void;
    };
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function PendoInitializer() {
  const { data: session, status } = useSession();
  const initializedRef = useRef(false);
  const identifiedRef = useRef(false);

  // Anonymous initialization on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (typeof window !== 'undefined' && window.pendo) {
      window.pendo.initialize({
        visitor: { id: '' },
      });
    }
  }, []);

  // Identify with real user data after authentication
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user || identifiedRef.current) return;
    identifiedRef.current = true;

    async function identifyUser() {
      const user = session!.user;

      let role: string | null = null;
      let orgName: string | null = null;
      let orgSlug: string | null = null;

      // Fetch additional metadata from /auth/me
      try {
        const res = await fetch(`${API_URL}/v1/auth/me`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          role = data.role ?? null;
          orgName = data.org?.name ?? null;
          orgSlug = data.org?.slug ?? null;
        }
      } catch {
        // Continue with session data if /auth/me fails
      }

      if (typeof window !== 'undefined' && window.pendo) {
        window.pendo.identify({
          visitor: {
            id: user.id,
            email: user.email,
            full_name: user.name,
            role: role,
          },
          account: {
            id: user.orgId,
            name: orgName,
            slug: orgSlug,
          },
        });
      }
    }

    identifyUser();
  }, [status, session]);

  return null;
}
