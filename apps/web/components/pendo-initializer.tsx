'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
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
const PENDO_API_KEY = '7b10f88b-a508-459b-9a28-20423560e563';

export function PendoInitializer() {
  const { data: session, status } = useSession();
  const initializedRef = useRef(false);
  const identifiedRef = useRef(false);
  const [scriptReady, setScriptReady] = useState(false);
  const shouldLoadPendo = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ENABLE_PENDO === 'true';

  // Anonymous initialization after script load
  useEffect(() => {
    if (!shouldLoadPendo || !scriptReady || initializedRef.current) return;
    initializedRef.current = true;

    if (typeof window !== 'undefined' && window.pendo) {
      window.pendo.initialize({
        visitor: { id: '' },
      });
    }
  }, [scriptReady, shouldLoadPendo]);

  // Identify with real user data after authentication
  useEffect(() => {
    if (!shouldLoadPendo || !scriptReady || status !== 'authenticated' || !session?.user || identifiedRef.current) return;
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
  }, [scriptReady, shouldLoadPendo, status, session]);

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
v=['initialize','identify','updateOptions','pageLoad','track','trackAgent'];for(w=0,x=v.length;w<x;++w)(function(m){
o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);
y=e.createElement(n);y.async=!0;y.src='https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js';
z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);})(window,document,'script','pendo');
})('${PENDO_API_KEY}');`}</Script>
  );
}
