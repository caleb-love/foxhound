'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

declare global {
  interface Window {
    pendo?: {
      initialize: (config: {
        visitor: Record<string, string | null>;
        account?: Record<string, string | null>;
        enableSPAAutoPageLoad?: boolean;
      }) => void;
      identify: (config: {
        visitor: Record<string, string | null>;
        account?: Record<string, string | null>;
      }) => void;
      pageLoad: (url?: string) => void;
      track: (event: string, properties?: Record<string, unknown>) => void;
      isReady?: () => boolean;
    };
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const PENDO_API_KEY = '7b10f88b-a508-459b-9a28-20423560e563';

export function PendoInitializer() {
  const { data: session, status } = useSession();
  const initializedRef = useRef(false);
  const [scriptReady, setScriptReady] = useState(false);
  const pathname = usePathname();

  const shouldLoadPendo =
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_ENABLE_PENDO === 'true';

  // Initialize Pendo once we have user data (or as anonymous after auth settles)
  useEffect(() => {
    if (!shouldLoadPendo || !scriptReady || initializedRef.current) return;
    // Wait until auth status is resolved (not 'loading')
    if (status === 'loading') return;

    const pendo = window.pendo;
    if (!pendo) return;

    if (status === 'authenticated' && session?.user) {
      // Initialize with real user data directly (skips the broken empty-ID init)
      const user = session.user;
      initializedRef.current = true;

      pendo.initialize({
        visitor: {
          id: user.id,
          email: user.email,
          full_name: user.name,
        },
        account: {
          id: user.orgId,
        },
        enableSPAAutoPageLoad: true,
      });

      // Enrich with additional metadata from /auth/me (non-blocking)
      enrichVisitor(user.token, user, pendo);
    } else {
      // Unauthenticated: initialize as anonymous with auto page tracking
      initializedRef.current = true;
      pendo.initialize({
        visitor: { id: 'ANONYMOUS' },
        enableSPAAutoPageLoad: true,
      });
    }
  }, [scriptReady, shouldLoadPendo, status, session]);

  // Safety net: fire pageLoad on Next.js route changes in case auto-detection misses any
  useEffect(() => {
    if (!shouldLoadPendo || !scriptReady || !initializedRef.current) return;
    // Skip the initial render (Pendo's initialize already captures the first page)
    const pendo = window.pendo;
    if (pendo?.isReady?.()) {
      pendo.pageLoad();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!shouldLoadPendo) {
    return null;
  }

  return (
    <Script
      id="pendo-install"
      strategy="afterInteractive"
      onLoad={() => setScriptReady(true)}
    >{`(function(apiKey){
(function(p,e,n,d,o){var v,w,x,y,z;o=p[d]=p[d]||{};o._q=o._q||[];
v=['initialize','identify','updateOptions','pageLoad','track'];for(w=0,x=v.length;w<x;++w)(function(m){
o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);
y=e.createElement(n);y.async=!0;y.src='https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js';
z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);})(window,document,'script','pendo');
})('${PENDO_API_KEY}');`}</Script>
  );
}

/** Fetch role/org metadata and re-identify with enriched visitor data */
async function enrichVisitor(
  token: string,
  user: { id: string; email: string; name: string; orgId: string },
  pendo: NonNullable<Window['pendo']>
) {
  try {
    const res = await fetch(`${API_URL}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;

    const data = await res.json();
    pendo.identify({
      visitor: {
        id: user.id,
        email: user.email,
        full_name: user.name,
        role: data.role ?? null,
      },
      account: {
        id: user.orgId,
        name: data.org?.name ?? null,
        slug: data.org?.slug ?? null,
      },
    });
  } catch {
    // /auth/me failed, initial identify data is still valid
  }
}
