import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { SandboxHero, SandboxPage, SandboxPill } from '@/components/sandbox/theme';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageErrorState } from '@/components/ui/page-state';
import { getSandboxPromptDetailHref, getSandboxReplayHref } from '@/lib/sandbox-routes';

export default async function SandboxSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demo = buildLocalReviewDemo();
  const traces = demo.allTraces.filter((trace) => trace.sessionId === id);

  if (traces.length === 0) {
    return (
      <SandboxPage>
        <PageErrorState
          title="Session not found"
          message="The requested sandbox session could not be found in the seeded workspace."
          detail="Return to sandbox traces or replay and open one of the available sessions from there."
        />
      </SandboxPage>
    );
  }

  const primaryTrace = traces[0]!;
  const promptName = typeof primaryTrace.metadata?.prompt_name === 'string' ? primaryTrace.metadata.prompt_name : undefined;

  return (
    <SandboxPage>
      <SandboxHero
        eyebrow="Investigate · Session"
        title={`Session ${id}`}
        description="Review all traces attached to this sandbox session and jump into replay, trace detail, and prompt investigation from one place."
      >
        <SandboxPill>{traces.length} trace{traces.length === 1 ? '' : 's'}</SandboxPill>
        <SandboxPill>{primaryTrace.agentId}</SandboxPill>
      </SandboxHero>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="backdrop-blur-xl" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)', color: 'var(--tenant-text-primary)', boxShadow: 'var(--tenant-shadow-panel)' }}>
          <CardHeader>
            <CardTitle>Session traces</CardTitle>
            <CardDescription style={{ color: 'var(--tenant-text-secondary)' }}>All traces linked to this session in the seeded sandbox workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {traces.map((trace) => (
              <div key={trace.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{trace.id}</div>
                    <div className="text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>{trace.agentId} · {trace.spans.length} spans</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <a href={`/sandbox/traces/${trace.id}`} className="rounded-lg border px-3 py-2 font-medium transition-colors" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)', color: 'var(--tenant-text-primary)' }}>Trace</a>
                    <a href={getSandboxReplayHref(trace.id)} className="rounded-lg border px-3 py-2 font-medium transition-colors" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)', color: 'var(--tenant-text-primary)' }}>Replay</a>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)', color: 'var(--tenant-text-primary)', boxShadow: 'var(--tenant-shadow-panel)' }}>
          <CardHeader>
            <CardTitle>Investigation shortcuts</CardTitle>
            <CardDescription style={{ color: 'var(--tenant-text-secondary)' }}>Useful follow-up paths for this session cluster.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>
            <a href={`/sandbox/traces/${primaryTrace.id}`} className="block rounded-2xl border p-4 transition-colors" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
              <div className="font-medium" style={{ color: 'var(--tenant-text-primary)' }}>Open primary trace</div>
              <div className="mt-1">Start with the most representative trace for this session.</div>
            </a>
            <a href={getSandboxReplayHref(primaryTrace.id)} className="block rounded-2xl border p-4 transition-colors" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
              <div className="font-medium" style={{ color: 'var(--tenant-text-primary)' }}>Open replay</div>
              <div className="mt-1">Step through the trace state changes in execution order.</div>
            </a>
            {promptName ? (
              <a href={getSandboxPromptDetailHref(promptName) ?? '/sandbox/prompts'} className="block rounded-2xl border p-4 transition-colors" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
                <div className="font-medium" style={{ color: 'var(--tenant-text-primary)' }}>Inspect prompt family</div>
                <div className="mt-1">Review prompt history associated with this session.</div>
              </a>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </SandboxPage>
  );
}
