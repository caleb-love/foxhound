'use client';

import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSegmentStore } from '@/lib/stores/segment-store';
import { upsertSegmentInUrl } from '@/lib/segment-url';

export function useSegmentAwareHref(href: string) {
  const currentSegmentName = useSegmentStore((state) => state.currentSegmentName);
  return upsertSegmentInUrl(href, currentSegmentName);
}

export function SegmentAwareLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  useSearchParams();
  const nextHref = useSegmentAwareHref(href);
  return (
    <a href={nextHref} className={className}>
      {children}
    </a>
  );
}
