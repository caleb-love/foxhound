# Foxhound Dashboard: Quick Start Implementation Guide

**Goal:** Get the foundation running in 1-2 days so you can start iterating.

---

## Day 1 Morning: Bootstrap Next.js App

### 1. Create the Next.js app

```bash
cd apps
pnpm create next-app@latest web \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"

cd web
```

### 2. Install core dependencies

```bash
pnpm add \
  @tanstack/react-query \
  zustand \
  next-auth \
  recharts \
  date-fns \
  lucide-react \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-select \
  @radix-ui/react-tabs \
  cmdk \
  sonner

pnpm add -D \
  @types/node \
  prettier \
  prettier-plugin-tailwindcss
```

### 3. Initialize shadcn/ui

```bash
pnpm dlx shadcn@latest init -d

# Add essential components
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add table
pnpm dlx shadcn@latest add dialog
pnpm dlx shadcn@latest add dropdown-menu
pnpm dlx shadcn@latest add input
pnpm dlx shadcn@latest add label
pnpm dlx shadcn@latest add tabs
pnpm dlx shadcn@latest add badge
pnpm dlx shadcn@latest add command
```

### 4. Set up Turbo workspace

**Update root `turbo.json`:**
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {}
  }
}
```

**Update root `package.json`:**
```json
{
  "scripts": {
    "dev": "turbo run dev --filter=web",
    "dev:api": "turbo run dev --filter=api",
    "dev:all": "turbo run dev --filter=web --filter=api"
  }
}
```

---

## Day 1 Afternoon: API Client & Auth

### 5. Create API client wrapper

**Create `apps/web/lib/api-client.ts`:**
```typescript
import { createClient } from '@foxhound-ai/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const apiClient = createClient({
  baseURL: API_URL,
  // Auth token will be injected via middleware
});

// Server-side client (with auth from session)
export function getAuthenticatedClient(token: string) {
  return createClient({
    baseURL: API_URL,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
```

### 6. Set up NextAuth

**Create `apps/web/lib/auth.ts`:**
```typescript
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        const data = await res.json();

        if (res.ok && data.token) {
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            token: data.token,
            orgId: data.user.orgId,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.token = user.token;
        token.orgId = user.orgId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.token = token.token as string;
      session.user.orgId = token.orgId as string;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
};
```

**Create `apps/web/app/api/auth/[...nextauth]/route.ts`:**
```typescript
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### 7. Create login page

**Create `apps/web/app/(auth)/login/page.tsx`:**
```typescript
'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password');
      setLoading(false);
    } else {
      router.push('/traces');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Foxhound</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Day 2 Morning: Dashboard Layout & Trace List

### 8. Create dashboard layout

**Create `apps/web/app/(dashboard)/layout.tsx`:**
```typescript
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={session.user} />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 9. Create sidebar component

**Create `apps/web/components/layout/sidebar.tsx`:**
```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Activity, Flask, Database, Settings, BarChart3, AlertTriangle } from 'lucide-react';

const navItems = [
  { href: '/traces', label: 'Traces', icon: Activity },
  { href: '/experiments', label: 'Experiments', icon: Flask },
  { href: '/datasets', label: 'Datasets', icon: Database },
  { href: '/budgets', label: 'Budgets', icon: BarChart3 },
  { href: '/slas', label: 'SLAs', icon: AlertTriangle },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r bg-white">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold text-indigo-600">Foxhound</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

### 10. Create trace list page

**Create `apps/web/app/(dashboard)/traces/page.tsx`:**
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';
import { TraceTable } from '@/components/traces/trace-table';

export default async function TracesPage() {
  const session = await getServerSession(authOptions);
  const client = getAuthenticatedClient(session!.user.token);

  // Fetch traces server-side for initial render
  const traces = await client.get('/v1/traces', {
    params: { limit: 50 },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Traces</h1>
      </div>
      <TraceTable initialData={traces.data} />
    </div>
  );
}
```

### 11. Create trace table component

**Create `apps/web/components/traces/trace-table.tsx`:**
```typescript
'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface Trace {
  id: string;
  agentId: string;
  sessionId?: string;
  startTimeMs: number;
  endTimeMs?: number;
  spans: any[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function TraceTable({ initialData }: { initialData: Trace[] }) {
  const [traces] = useState(initialData);

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Session</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Spans</TableHead>
            <TableHead>Started</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {traces.map((trace) => {
            const duration = trace.endTimeMs
              ? ((trace.endTimeMs - trace.startTimeMs) / 1000).toFixed(2)
              : '-';
            const hasError = trace.spans.some((s: any) => s.status === 'error');

            return (
              <TableRow key={trace.id}>
                <TableCell>
                  <Badge variant={hasError ? 'destructive' : 'default'}>
                    {hasError ? 'Error' : 'Success'}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{trace.agentId}</TableCell>
                <TableCell>
                  {trace.sessionId ? (
                    <Link
                      href={`/sessions/${trace.sessionId}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {trace.sessionId.slice(0, 8)}
                    </Link>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>{duration}s</TableCell>
                <TableCell>{trace.spans.length}</TableCell>
                <TableCell className="text-gray-500">
                  {formatDistanceToNow(new Date(trace.createdAt), { addSuffix: true })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

## Day 2 Afternoon: Trace Detail View

### 12. Create trace detail page

**Create `apps/web/app/(dashboard)/traces/[id]/page.tsx`:**
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';
import { TraceTimeline } from '@/components/traces/trace-timeline';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function TraceDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const client = getAuthenticatedClient(session!.user.token);

  const trace = await client.get(`/v1/traces/${params.id}`);
  const duration = trace.endTimeMs
    ? ((trace.endTimeMs - trace.startTimeMs) / 1000).toFixed(2)
    : 'In progress';
  const hasError = trace.spans.some((s: any) => s.status === 'error');

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Trace</h1>
            <Badge variant={hasError ? 'destructive' : 'default'}>
              {hasError ? 'Error' : 'Success'}
            </Badge>
          </div>
          <p className="font-mono text-sm text-gray-500">{trace.id}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{duration}s</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Spans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trace.spans.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="truncate font-mono text-lg">{trace.agentId}</div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <TraceTimeline spans={trace.spans} />
        </CardContent>
      </Card>
    </div>
  );
}
```

### 13. Create timeline component (simple version)

**Create `apps/web/components/traces/trace-timeline.tsx`:**
```typescript
'use client';

import { Badge } from '@/components/ui/badge';

interface Span {
  id: string;
  name: string;
  kind: string;
  status: string;
  startTimeMs: number;
  endTimeMs?: number;
}

export function TraceTimeline({ spans }: { spans: Span[] }) {
  const sortedSpans = [...spans].sort((a, b) => a.startTimeMs - b.startTimeMs);
  const minTime = sortedSpans[0]?.startTimeMs || 0;
  const maxTime = sortedSpans[sortedSpans.length - 1]?.endTimeMs || minTime;
  const totalDuration = maxTime - minTime || 1;

  return (
    <div className="space-y-2">
      {sortedSpans.map((span) => {
        const duration = span.endTimeMs ? span.endTimeMs - span.startTimeMs : 0;
        const offset = ((span.startTimeMs - minTime) / totalDuration) * 100;
        const width = (duration / totalDuration) * 100;

        const kindColors: Record<string, string> = {
          llm_call: 'bg-blue-500',
          tool_call: 'bg-green-500',
          agent_step: 'bg-purple-500',
          workflow: 'bg-indigo-500',
          custom: 'bg-gray-500',
        };

        return (
          <div key={span.id} className="flex items-center gap-3">
            <div className="w-48 truncate text-sm font-medium">{span.name}</div>
            <div className="flex-1">
              <div className="relative h-8">
                <div
                  className={`absolute h-full rounded ${
                    kindColors[span.kind] || 'bg-gray-400'
                  } ${span.status === 'error' ? 'ring-2 ring-red-500' : ''}`}
                  style={{
                    left: `${offset}%`,
                    width: `${Math.max(width, 2)}%`,
                  }}
                />
              </div>
            </div>
            <Badge variant="outline" className="w-20 justify-center text-xs">
              {(duration / 1000).toFixed(2)}s
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
```

---

## Testing Your Setup

### Run the dev server:

```bash
# Terminal 1: API server
cd apps/api
pnpm dev

# Terminal 2: Web dashboard
cd apps/web
pnpm dev
```

### Test the flow:
1. Navigate to `http://localhost:3001`
2. Should redirect to `/login`
3. Create a test user via API or existing signup endpoint
4. Log in with credentials
5. Should see `/traces` page
6. Click a trace → see detail view

---

## Environment Variables

**Create `apps/web/.env.local`:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-here
NEXTAUTH_URL=http://localhost:3001
```

---

## Next Steps After Day 2

Once you have the foundation working:

### Week 1 Priority
- [ ] Add filters to trace list (status, agent, date range)
- [ ] Add search functionality
- [ ] Create signup page
- [ ] Add API key management in settings

### Week 2 Priority
- [ ] Polish trace timeline (click to expand span details)
- [ ] Add metadata/scores tabs to trace detail
- [ ] Implement Session Replay viewer

### Week 3 Priority
- [ ] Build Run Diff comparison view
- [ ] Add experiments list + detail

---

## Common Issues & Solutions

### Issue: "Module not found: Can't resolve '@foxhound-ai/api-client'"
**Solution:** Build the api-client package first:
```bash
cd packages/api-client
pnpm build
```

### Issue: NextAuth login not working
**Solution:** Make sure API server is running on port 3000 and accepts credentials

### Issue: TypeScript errors in session types
**Solution:** Create `apps/web/types/next-auth.d.ts`:
```typescript
import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    token: string;
    orgId: string;
  }

  interface Session {
    user: User & {
      email: string;
      name: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    token: string;
    orgId: string;
  }
}
```

---

## Success Criteria for Day 1-2

- ✅ Next.js app runs without errors
- ✅ Can log in with test credentials
- ✅ Trace list page shows data from API
- ✅ Clicking a trace shows detail view
- ✅ Sidebar navigation works
- ✅ UI looks clean (not broken)

**Once you hit these checkpoints, you're ready to iterate fast on the full plan!**
