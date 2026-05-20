'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
        return;
      }

      router.replace('/traces');
    } catch {
      setError('Unable to sign in right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: 'var(--tenant-app-bg)' }}
    >
      <div className="w-full max-w-[420px] space-y-6">
        <div className="space-y-2">
          <span
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: 'var(--tenant-text-muted)' }}
          >
            <span aria-hidden className="inline-block h-[2px] w-6" style={{ background: 'var(--tenant-accent)' }} />
            <span style={{ color: 'var(--tenant-accent)' }}>Foxhound</span>
            <span aria-hidden style={{ opacity: 0.5 }}>·</span>
            <span>Agent Ops Console</span>
          </span>
          <h1
            className="text-[34px] font-semibold leading-[1.05] tracking-tight text-tenant-text-primary"
            style={{ fontFamily: 'var(--font-heading), Outfit, ui-sans-serif, system-ui' }}
          >
            Welcome back
          </h1>
          <p className="max-w-[44ch] text-[14px] leading-[1.55] text-tenant-text-secondary">
            Sign in to operate, investigate, and improve agents in production.
          </p>
        </div>

        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use the email and password tied to your Foxhound workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              {error && (
                <div
                  className="rounded-md border px-3 py-2"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--tenant-danger) 35%, transparent)',
                    background: 'color-mix(in srgb, var(--tenant-danger) 8%, transparent)',
                  }}
                >
                  <p className="text-[13px] font-medium" style={{ color: 'var(--tenant-danger)' }}>
                    {error}
                  </p>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>
            <p className="mt-4 text-center text-[12px] text-tenant-text-muted">
              Demo build: any seeded test account works.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
