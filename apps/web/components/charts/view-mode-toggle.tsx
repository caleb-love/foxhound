'use client';

import { Button } from '@/components/ui/button';

export interface ViewModeOption {
  value: string;
  label: string;
}

export function ViewModeToggle({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ViewModeOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-tenant-text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={value === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
