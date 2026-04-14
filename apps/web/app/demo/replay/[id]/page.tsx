import { notFound } from 'next/navigation';
import type { Trace } from '@foxhound/types';
import { ReplayDetailView } from '@/components/replay/replay-detail-view';

export default async function DemoReplayDetailPage({
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
  return <ReplayDetailView trace={trace} baseHref="/demo" />;
}
