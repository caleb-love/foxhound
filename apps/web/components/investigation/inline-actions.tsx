'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface InlineActionProps {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function InlineAction({ href, children, variant = 'secondary', disabled = false, className, onClick }: InlineActionProps) {
  const base = 'inline-flex items-center gap-1 rounded-[var(--tenant-radius-control-tight)] border px-2 py-1 text-xs font-medium leading-none transition-all duration-150 whitespace-nowrap';

  const variants = {
    primary: {
      borderColor: 'var(--tenant-accent)',
      background: 'color-mix(in srgb, var(--tenant-accent) 14%, var(--card))',
      color: 'var(--tenant-accent-strong, var(--tenant-accent))',
    },
    secondary: {
      borderColor: 'var(--tenant-panel-stroke)',
      background: 'color-mix(in srgb, var(--card) 88%, var(--background))',
      color: 'var(--tenant-text-primary)',
    },
    ghost: {
      borderColor: 'transparent',
      background: 'transparent',
      color: 'var(--tenant-text-secondary)',
    },
  };

  if (disabled) {
    return (
      <span
        className={cn(base, 'pointer-events-none opacity-40', className)}
        style={variants[variant]}
      >
        {children}
      </span>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(base, 'cursor-pointer hover:brightness-110', className)}
        style={variants[variant]}
      >
        {children}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className={cn(base, 'hover:brightness-110', className)}
      style={variants[variant]}
    >
      {children}
    </Link>
  );
}

export function InlineActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  );
}

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function CopyButton({ text, label = 'Copy', className }: CopyButtonProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[var(--tenant-radius-control-tight)] border px-2.5 py-1 text-xs font-medium transition-colors',
        className,
      )}
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        background: 'color-mix(in srgb, var(--card) 88%, var(--background))',
        color: 'var(--tenant-text-muted)',
      }}
    >
      <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
        <path d="M3.5 10.5h-1a1.5 1.5 0 01-1.5-1.5v-6a1.5 1.5 0 011.5-1.5h6a1.5 1.5 0 011.5 1.5v1" />
      </svg>
      {label}
    </button>
  );
}
