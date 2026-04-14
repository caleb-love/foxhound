import { notFound } from 'next/navigation';
import type { Trace } from '@foxhound/types';
import { RunDiffView } from '@/components/diff/run-diff-view';

interface DiffPageProps {
  searchParams: Promise<{
    a?: string;
    b?: string;
  }>;
}

async function getTrace(id: string): Promise<Trace | null> {
  try {
    const response = await fetch(`http://localhost:3001/api/demo/traces/${id}`, {
      cache: 'no-store',
    });
    
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export default async function DiffPage({ searchParams }: DiffPageProps) {
  const { a, b } = await searchParams;

  if (!a || !b) {
    notFound();
  }
  
  const [traceA, traceB] = await Promise.all([
    getTrace(a),
    getTrace(b),
  ]);
  
  if (!traceA || !traceB) {
    notFound();
  }
  
  return <RunDiffView traceA={traceA} traceB={traceB} backHref="/demo/traces" />;
}
