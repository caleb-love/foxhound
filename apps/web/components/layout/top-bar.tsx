'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Settings } from 'lucide-react';
import { OperatorCommandPalette } from './operator-command-palette';

interface TopBarProps {
  user: {
    name: string;
    email: string;
  };
}

export function TopBar({ user }: TopBarProps) {
  return (
    <header className="relative z-10 flex h-16 items-center justify-between border-b px-6 backdrop-blur-xl" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'color-mix(in srgb, var(--tenant-panel) 82%, transparent)' }}>
      <div className="flex-1">
        <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium shadow-sm" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)', color: 'var(--tenant-text-muted)' }}>
          Operator Console · live workspace
        </div>
      </div>
      <div className="flex items-center gap-3">
        <OperatorCommandPalette />
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" className="flex items-center gap-2 rounded-full border px-2.5 shadow-sm backdrop-blur" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)' }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'var(--tenant-accent-soft)', color: 'var(--tenant-accent)' }}>
                <User className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">{user.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{user.name}</span>
                <span className="text-xs" style={{ color: 'var(--tenant-text-muted)' }}>{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: '/login' })}
              style={{ color: 'var(--tenant-danger)' }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
