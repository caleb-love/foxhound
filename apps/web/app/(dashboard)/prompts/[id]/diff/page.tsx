import { getAuthenticatedClient } from '@/lib/api-client';
import { PromptDiffView } from '@/components/prompts/prompt-diff-view';
import { PageErrorState } from '@/components/ui/page-state';
import { getDashboardSessionOrDemo, isDashboardDemoModeEnabled } from '@/lib/demo-auth';

interface PromptDiffPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    versionA?: string;
    versionB?: string;
  }>;
}

export default async function PromptDiffPage({ params, searchParams }: PromptDiffPageProps) {
  const session = await getDashboardSessionOrDemo();

  const [{ id }, { versionA, versionB }] = await Promise.all([params, searchParams]);
  const client = getAuthenticatedClient(session.user.token);

  try {
    const parsedVersionA = versionA ? Number(versionA) : undefined;
    const parsedVersionB = versionB ? Number(versionB) : undefined;

    if (isDashboardDemoModeEnabled()) {
      return (
        <PromptDiffView
          promptName="demo-prompt"
          versions={[
            { id: 'pmv_1', promptId: id, version: 3, content: 'Demo prompt v3', model: 'gpt-4o', config: { temperature: 0.2 }, createdAt: new Date().toISOString(), createdBy: null, labels: ['production'] },
            { id: 'pmv_2', promptId: id, version: 2, content: 'Demo prompt v2', model: 'gpt-4o-mini', config: { temperature: 0.1 }, createdAt: new Date().toISOString(), createdBy: null, labels: [] },
          ]}
          initialDiff={parsedVersionA && parsedVersionB ? {
            promptId: id,
            promptName: 'demo-prompt',
            versionA: parsedVersionA,
            versionB: parsedVersionB,
            hasChanges: true,
            changes: [{ field: 'content', before: 'Demo prompt v2', after: 'Demo prompt v3' }],
          } : null}
          initialVersionA={parsedVersionA}
          initialVersionB={parsedVersionB}
        />
      );
    }

    const [prompt, versions] = await Promise.all([
      client.getPrompt(id),
      client.listPromptVersions(id),
    ]);

    const shouldLoadDiff = Number.isInteger(parsedVersionA) && Number.isInteger(parsedVersionB);

    const diff = shouldLoadDiff
      ? await client.diffPromptVersions(id, {
          versionA: parsedVersionA as number,
          versionB: parsedVersionB as number,
        })
      : null;

    return (
      <PromptDiffView
        promptName={prompt.name}
        versions={versions.data}
        initialDiff={diff}
        initialVersionA={parsedVersionA}
        initialVersionB={parsedVersionB}
      />
    );
  } catch (error) {
    console.error('Error loading prompt diff page:', error);

    return (
      <PageErrorState
        title="Unable to load prompt comparison"
        message="We couldn't load this prompt or its versions right now."
        detail="Try refreshing the page or navigating back to the prompts list."
      />
    );
  }
}
