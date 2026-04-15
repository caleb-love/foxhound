import type { PromptResponse, PromptVersionResponse } from '@foxhound/api-client';
import { getAuthenticatedClient } from '@/lib/api-client';
import { PromptDetailView } from '@/components/prompts/prompt-detail-view';
import { PageErrorState } from '@/components/ui/page-state';
import { getDashboardSessionOrSandbox, isDashboardSandboxModeEnabled } from '@/lib/sandbox-auth';

interface PromptDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PromptDetailPage({ params }: PromptDetailPageProps) {
  const session = await getDashboardSessionOrSandbox();

  const { id } = await params;
  const client = getAuthenticatedClient(session.user.token);

  let prompt: PromptResponse = { id, orgId: 'demo-org', name: 'demo-prompt', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  let versions: PromptVersionResponse[] = [
    { id: 'pmv_1', promptId: id, version: 2, content: 'Demo prompt v2', model: 'gpt-4o-mini', config: {}, createdAt: new Date().toISOString(), createdBy: null, labels: ['production'] },
    { id: 'pmv_2', promptId: id, version: 1, content: 'Demo prompt v1', model: 'gpt-4o-mini', config: {}, createdAt: new Date().toISOString(), createdBy: null, labels: [] },
  ];
  let errorMessage: string | null = null;

  try {
    if (!isDashboardSandboxModeEnabled()) {
      const [loadedPrompt, loadedVersions] = await Promise.all([
        client.getPrompt(id),
        client.listPromptVersions(id),
      ]);

      prompt = loadedPrompt;
      versions = loadedVersions.data;
    }
  } catch (error) {
    console.error('Error loading prompt detail page:', error);
    errorMessage = "We couldn't load this prompt right now.";
  }

  if (errorMessage) {
    return (
      <PageErrorState
        title="Unable to load prompt"
        message={errorMessage}
        detail="Try refreshing the page or navigating back to the prompts list."
      />
    );
  }

  return <PromptDetailView prompt={prompt} versions={versions} />;
}
