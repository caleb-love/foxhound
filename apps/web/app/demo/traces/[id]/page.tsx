import { notFound } from 'next/navigation';
import type { Trace } from '@foxhound/types';
import { TraceDetailView } from '@/components/traces/trace-detail-view';

export default async function DemoTraceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const response = await fetch(`http://localhost:3001/api/demo/traces/${id}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    notFound();
  }

  const trace: Trace = await response.json();

  return <TraceDetailView trace={trace} baseHref="/demo" />;
}
