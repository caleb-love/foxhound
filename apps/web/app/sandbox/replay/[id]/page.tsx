import type { Trace } from '@foxhound/types';
import { ReplayDetailView } from '@/components/replay/replay-detail-view';
import { PageErrorState } from '@/components/ui/page-state';
import { PageContainer } from '@/components/system/page';

export default async function SandboxReplayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const response = await fetch(`http://localhost:3001/api/sandbox/traces/${id}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    return (
      <PageContainer>
        <PageErrorState
          title="Replay trace not found"
          message="The requested sandbox replay target could not be loaded."
          detail="Return to the sandbox replay index and open one of the seeded traces."
        />
      </PageContainer>
    );
  }

  const trace: Trace = await response.json();
  return <ReplayDetailView trace={trace} baseHref="/sandbox" />;
}
