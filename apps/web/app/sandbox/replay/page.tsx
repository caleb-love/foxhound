import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import type { Trace } from '@foxhound/types';
import { ReplayIndexView } from '@/components/replay/replay-index-view';

export default function SandboxReplayIndexPage() {
  const demo = buildLocalReviewDemo();

  return (
    <ReplayIndexView
      traces={demo.allTraces as unknown as Trace[]}
      baseHref="/sandbox"
      eyebrow="Investigate"
      title="Session Replay"
      description="Browse the full seeded sandbox replay corpus, isolate failure paths and behavior shifts, and jump into trace detail, prompt context, and comparison workflows from one shared replay workbench."
    />
  );
}
