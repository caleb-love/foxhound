'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  /** Initial width of left pane as percentage (0-100). Default: 60 */
  defaultSplit?: number;
  /** Minimum width of either pane in px. Default: 280 */
  minPaneWidth?: number;
  className?: string;
}

export function SplitPane({
  left,
  right,
  defaultSplit = 60,
  minPaneWidth = 280,
  className,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPct, setSplitPct] = useState(defaultSplit);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const startPct = splitPct;
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.getBoundingClientRect().width;
      const minPct = (minPaneWidth / containerWidth) * 100;
      const maxPct = 100 - minPct;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const dPct = (dx / containerWidth) * 100;
        const next = Math.max(minPct, Math.min(maxPct, startPct + dPct));
        setSplitPct(next);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [splitPct, minPaneWidth],
  );

  return (
    <div
      ref={containerRef}
      className={cn('flex overflow-hidden rounded-[var(--tenant-radius-panel)] border', className)}
      style={{
        borderColor: 'var(--tenant-panel-stroke)',
        background: 'var(--card)',
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      {/* Left pane */}
      <div className="min-w-0 overflow-auto" style={{ width: `${splitPct}%` }}>
        {left}
      </div>

      {/* Divider */}
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={handleMouseDown}
        className={cn(
          'relative z-10 w-[5px] shrink-0 cursor-col-resize transition-colors',
          isDragging ? 'bg-[color:var(--tenant-accent)]' : 'hover:bg-[color:color-mix(in_srgb,var(--tenant-accent)_32%,var(--tenant-panel-stroke))]',
        )}
        style={{
          background: isDragging ? undefined : 'var(--tenant-panel-stroke)',
        }}
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* Right pane */}
      <div className="min-w-0 flex-1 overflow-auto">
        {right}
      </div>
    </div>
  );
}
