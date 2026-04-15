import type { PromptVersionDiffResponse, PromptVersionResponse } from '@foxhound/api-client';
import { getAuthenticatedClient } from '@/lib/api-client';
import { PromptDiffView } from '@/components/prompts/prompt-diff-view';
import { PageErrorState } from '@/components/ui/page-state';
import { getDashboardSessionOrSandbox, isDashboardSandboxModeEnabled } from '@/lib/sandbox-auth';

interface PromptDiffPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    versionA?: string;
    versionB?: string;
  }>;
}

export default async function PromptDiffPage({ params, searchParams }: PromptDiffPageProps) {
  const session = await getDashboardSessionOrSandbox();

  const [{ id }, { versionA, versionB }] = await Promise.all([params, searchParams]);
  const client = getAuthenticatedClient(session.user.token);
  const parsedVersionA = versionA ? Number(versionA) : undefined;
  const parsedVersionB = versionB ? Number(versionB) : undefined;

  let promptName = 'demo-prompt';
  let versions: PromptVersionResponse[] = [
    { id: 'pmv_1', promptId: id, version: 3, content: 'Demo prompt v3', model: 'gpt-4o', config: { temperature: 0.2 }, createdAt: new Date().toISOString(), createdBy: null, labels: ['production'] },
    { id: 'pmv_2', promptId: id, version: 2, content: 'Demo prompt v2', model: 'gpt-4o-mini', config: { temperature: 0.1 }, createdAt: new Date().toISOString(), createdBy: null, labels: [] },
  ];
  let initialDiff: PromptVersionDiffResponse | null = parsedVersionA && parsedVersionB ? {
    promptId: id,
    promptName: 'demo-prompt',
    versionA: parsedVersionA,
    versionB: parsedVersionB,
    hasChanges: true,
    changes: [{ field: 'content', before: 'Demo prompt v2', after: 'Demo prompt v3' }],
  } : null;
  let errorMessage: string | null = null;

  try {
    if (!isDashboardSandboxModeEnabled()) {
      const [prompt, promptVersions] = await Promise.all([
        client.getPrompt(id),
        client.listPromptVersions(id),
      ]);

      promptName = prompt.name;
      versions = promptVersions.data;

      const shouldLoadDiff = Number.isInteger(parsedVersionA) && Number.isInteger(parsedVersionB);
      initialDiff = shouldLoadDiff
        ? await client.diffPromptVersions(id, {
            versionA: parsedVersionA as number,
            versionB: parsedVersionB as number,
          })
        : null;
    }
  } catch (error) {
    console.error('Error loading prompt diff page:', error);
    errorMessage = "We couldn't load this prompt or its versions right now.";
  }

  if (errorMessage) {
    return (
      <PageErrorState
        title="Unable to load prompt comparison"
        message={errorMessage}
        detail="Try refreshing the page or navigating back to the prompts list."
      />
    );
  }

  return (
    <PromptDiffView
      promptName={promptName}
      versions={versions}
      initialDiff={initialDiff}
      initialVersionA={parsedVersionA}
      initialVersionB={parsedVersionB}
    />
  );
}
