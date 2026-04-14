'use client';

import { SegmentAwareLink } from '@/components/layout/segment-aware-link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SessionReplay } from './session-replay';
import type { Trace } from '@foxhound/types';
import { getDemoPromptDetailHref, getDemoPromptDiffHref } from '@/lib/demo-routes';

interface ReplayDetailViewProps {
  trace: Trace;
  baseHref?: string;
}

function getPromptMetadata(trace: Trace): { promptName?: string; promptVersion?: string | number } {
  const promptName = typeof trace.metadata?.prompt_name === 'string'
    ? trace.metadata.prompt_name
    : typeof trace.metadata?.promptName === 'string'
      ? trace.metadata.promptName
      : undefined;

  const promptVersion =
    typeof trace.metadata?.prompt_version === 'string' || typeof trace.metadata?.prompt_version === 'number'
      ? trace.metadata.prompt_version
      : typeof trace.metadata?.promptVersion === 'string' || typeof trace.metadata?.promptVersion === 'number'
        ? trace.metadata.promptVersion
        : undefined;

  return { promptName, promptVersion };
}

export function ReplayDetailView({ trace, baseHref = '' }: ReplayDetailViewProps) {
  const hasError = trace.spans.some((span) => span.status === 'error');
  const { promptName, promptVersion } = getPromptMetadata(trace);
  const promptHistoryHref = baseHref === '/demo'
    ? getDemoPromptDetailHref(promptName)
    : promptName
      ? `${baseHref}/prompts?focus=${encodeURIComponent(promptName)}`
      : null;
  const promptDiffHref = baseHref === '/demo'
    ? getDemoPromptDiffHref(promptName, Number(promptVersion) - 1, promptVersion)
    : promptName && promptVersion
      ? `${baseHref}/prompts?focus=${encodeURIComponent(promptName)}&version=${encodeURIComponent(String(promptVersion))}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold">Session Replay</h1>
            <Badge variant={hasError ? 'destructive' : 'default'}>
              {hasError ? 'Error path' : 'Healthy path'}
            </Badge>
            <Badge variant="outline">{trace.agentId}</Badge>
          </div>
          <div className="font-mono text-sm text-muted-foreground">{trace.id}</div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Step through execution in order to see how agent state evolved, where attributes changed,
            and what happened immediately before a failure or unexpected behavior shift.
          </p>
        </div>

        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Replay context</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <div className="font-medium">Prompt context</div>
              <p className="text-muted-foreground">
                {promptName
                  ? `${promptName}${promptVersion ? ` · version ${promptVersion}` : ''}`
                  : 'Prompt metadata is not attached to this trace yet.'}
              </p>
            </div>
            <div>
              <div className="font-medium">Best next step</div>
              <p className="text-muted-foreground">
                Use replay to identify the exact transition point, then jump to Run Diff or prompt history to validate what changed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <SegmentAwareLink href={`${baseHref}/traces/${trace.id}`} className="rounded-lg border px-3 py-2 font-medium transition-colors hover:bg-muted/40">
                Open trace detail
              </SegmentAwareLink>
              <SegmentAwareLink href={`${baseHref}/traces/${trace.id}`} className="rounded-lg border px-3 py-2 font-medium transition-colors hover:bg-muted/40">
                Inspect trace context
              </SegmentAwareLink>
              <SegmentAwareLink
                href={promptHistoryHref ?? '#'}
                className={`rounded-lg border px-3 py-2 font-medium transition-colors ${promptHistoryHref ? 'hover:bg-muted/40' : 'pointer-events-none opacity-60'}`}
              >
                Review prompts
              </SegmentAwareLink>
              <SegmentAwareLink
                href={promptDiffHref ?? '#'}
                className={`rounded-lg border px-3 py-2 font-medium transition-colors ${promptDiffHref ? 'hover:bg-muted/40' : 'pointer-events-none opacity-60'}`}
              >
                Compare prompt versions
              </SegmentAwareLink>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Replay timeline</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[720px]">
            <SessionReplay trace={trace} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
