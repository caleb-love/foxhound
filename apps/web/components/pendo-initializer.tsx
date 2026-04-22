'use client';

import Script from 'next/script';
import { useEffect, useRef } from 'react';
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
      trackAgent?: (event: string, properties?: Record<string, unknown>) => void;
      isReady?: () => boolean;
    };
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Pendo EU tenant — Foxhound production app.
// Matches the canonical install snippet from the Pendo dashboard.
const PENDO_PUBLIC_APP_ID = 'c19ea3f7-8d49-4e50-a68a-2dcafc75c195';
const PENDO_CDN_HOST = 'cdn.eu.pendo.io';

export function PendoInitializer() {
  const { data: session, status } = useSession();
  const identifiedRef = useRef(false);
  const pathname = usePathname();

  // Pendo is opt-in via an explicit env flag. Off by default everywhere
  // (including prod) unless NEXT_PUBLIC_ENABLE_PENDO=true is set. This keeps
  // dev clean by default but lets us validate the install flow locally.
  const shouldLoadPendo = process.env.NEXT_PUBLIC_ENABLE_PENDO === 'true';

  // Upgrade anonymous → authenticated visitor once the session resolves.
  // initialize() already fired inline with ANONYMOUS defaults as part of
  // the loader snippet, so this is an identify(), not a second initialize().
  useEffect(() => {
    if (!shouldLoadPendo) return;
    if (status !== 'authenticated' || !session?.user) return;
    if (identifiedRef.current) return;

    const pendo = window.pendo;
    if (!pendo) return;

    identifiedRef.current = true;
    const user = session.user;

    pendo.identify({
      visitor: {
        id: user.id,
        email: user.email,
        full_name: user.name,
      },
      account: {
        id: user.orgId,
      },
    });

    // Enrich with role/org metadata from /auth/me (non-blocking).
    enrichVisitor(user.token, user, pendo);
  }, [shouldLoadPendo, status, session]);

  // Safety net: fire pageLoad on Next.js route changes in case SPA
  // auto-detection misses any. Pendo's initialize() already captured the
  // first page, so this only runs on subsequent navigations.
  useEffect(() => {
    if (!shouldLoadPendo) return;
    const pendo = window.pendo;
    if (pendo?.isReady?.()) {
      pendo.pageLoad();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!shouldLoadPendo) {
    return null;
  }

  // Canonical Pendo install snippet — loader + initialize() in one block.
  // initialize() is called inline (not from a React effect) so it fires
  // synchronously when the script parses. That guarantees validateInstall()
  // passes and eliminates React-timing-related init failures.
  //
  // Strategy "afterInteractive" keeps this out of the hydration path, which
  // is the original Novus regression we fixed.
  return (
    <Script
      id="pendo-install"
      strategy="afterInteractive"
    >{`(function(publicAppId){
(function(p,e,n,d,o){var v,w,x,y,z;o=p[d]=p[d]||{};o._q=o._q||[];
v=['initialize','identify','updateOptions','pageLoad','track','trackAgent'];for(w=0,x=v.length;w<x;++w)(function(m){
o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);
y=e.createElement(n);y.async=!0;y.src='https://${PENDO_CDN_HOST}/agent/static/'+publicAppId+'/pendo.js';
z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);})(window,document,'script','pendo');

pendo.initialize({
  visitor: { id: 'ANONYMOUS' },
  enableSPAAutoPageLoad: true
});
})('${PENDO_PUBLIC_APP_ID}');`}</Script>
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
