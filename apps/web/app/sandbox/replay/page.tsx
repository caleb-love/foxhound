import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { SandboxHero, SandboxPage, SandboxPill } from '@/components/sandbox/theme';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSandboxPromptDetailHref, getSandboxReplayHref } from '@/lib/sandbox-routes';

export default function SandboxReplayIndexPage() {
  const demo = buildLocalReviewDemo();
  const replayTargets = demo.curatedTraces.filter((item) => demo.replayTargetTraceIds.includes(item.id));

  return (
    <SandboxPage>
      <SandboxHero
        eyebrow="Investigate · Session Replay"
        title="Replay critical investigation runs"
        description="Step through the seeded sandbox traces in week-long execution order to identify the exact transition points before regressions, hallucinations, escalation misses, and infrastructure failures."
      >
        <SandboxPill>{replayTargets.length} replay targets</SandboxPill>
        <SandboxPill>{demo.curatedTraces.filter((item) => item.status === 'error').length} failing hero traces</SandboxPill>
      </SandboxHero>

      <div className="grid gap-4 xl:grid-cols-2">
        {replayTargets.map((item) => {
          const promptName = typeof item.trace.metadata?.prompt_name === 'string' ? item.trace.metadata.prompt_name : undefined;
          return (
            <Card key={item.id} className="backdrop-blur-xl" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)', color: 'var(--tenant-text-primary)', boxShadow: 'var(--tenant-shadow-panel)' }}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{item.id}</CardTitle>
                    <CardDescription style={{ color: 'var(--tenant-text-secondary)' }}>{item.scenarioId} · replay priority {item.replayPriority}</CardDescription>
                  </div>
                  <a href={getSandboxReplayHref(item.id)} className="rounded-xl border px-3 py-2 text-sm font-medium transition-colors" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)', color: 'var(--tenant-accent)' }}>
                    Open replay
                  </a>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm" style={{ color: 'var(--tenant-text-secondary)' }}>
                <p>Agent: <span className="font-medium" style={{ color: 'var(--tenant-text-primary)' }}>{item.trace.agentId}</span></p>
                <p>Session: <span className="font-mono" style={{ color: 'var(--tenant-text-primary)' }}>{item.trace.sessionId}</span></p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a href={`/sandbox/traces/${item.id}`} className="rounded-lg border px-3 py-2 font-medium transition-colors" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)', color: 'var(--tenant-text-primary)' }}>Trace detail</a>
                  {promptName ? (
                    <a href={getSandboxPromptDetailHref(promptName) ?? '/sandbox/prompts'} className="rounded-lg border px-3 py-2 font-medium transition-colors" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)', color: 'var(--tenant-text-primary)' }}>Prompt context</a>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </SandboxPage>
  );
}
