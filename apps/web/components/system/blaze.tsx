/**
 * Blaze mark — Foxhound's signature visual atom.
 *
 * A small node + 2px segment that appears at every section orientation
 * surface (page eyebrows, verdict bars, RAG indicators). Read as a "trail
 * marker" — small, technical, unmistakably this product. This is the shape
 * the app should be recognisable by with all logos and copy removed.
 *
 * Three variants:
 *  - default:  brand cobalt, used for primary orientation
 *  - severity: takes a color (driven by verdict severity)
 *  - spark:    warm copper, reserved for ACTION moments
 */

import { cn } from '@/lib/utils';

export type BlazeTone = 'brand' | 'spark' | 'severity';

export interface BlazeProps {
  /** Tone of the blaze. Defaults to brand cobalt. */
  tone?: BlazeTone;
  /** Override color (only honored when tone === 'severity'). */
  color?: string;
  /** Width of the trailing segment in px. Default 24. */
  segment?: number;
  className?: string;
}

export function Blaze({ tone = 'brand', color, segment = 24, className }: BlazeProps) {
  const resolvedColor =
    tone === 'spark'
      ? 'var(--tenant-spark)'
      : tone === 'severity' && color
        ? color
        : 'var(--tenant-brand)';

  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center gap-1.5', className)}
    >
      <span
        className="h-1.5 w-1.5 rounded-[1px] rotate-45"
        style={{ background: resolvedColor }}
      />
      <span
        className="block h-[2px]"
        style={{ background: resolvedColor, width: `${segment}px` }}
      />
    </span>
  );
}
