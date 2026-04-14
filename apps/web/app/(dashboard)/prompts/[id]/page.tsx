import { getAuthenticatedClient } from '@/lib/api-client';
import { PromptDetailView } from '@/components/prompts/prompt-detail-view';
import { PageErrorState } from '@/components/ui/page-state';
import { getDashboardSessionOrDemo, isDashboardDemoModeEnabled } from '@/lib/demo-auth';

interface PromptDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PromptDetailPage({ params }: PromptDetailPageProps) {
  const session = await getDashboardSessionOrDemo();

  const { id } = await params;
  const client = getAuthenticatedClient(session.user.token);

  try {
    if (isDashboardDemoModeEnabled()) {
      return (
        <PromptDetailView
          prompt={{ id, orgId: 'demo-org', name: 'demo-prompt', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }}
          versions={[
            { id: 'pmv_1', promptId: id, version: 2, content: 'Demo prompt v2', model: 'gpt-4o-mini', config: {}, createdAt: new Date().toISOString(), createdBy: null, labels: ['production'] },
            { id: 'pmv_2', promptId: id, version: 1, content: 'Demo prompt v1', model: 'gpt-4o-mini', config: {}, createdAt: new Date().toISOString(), createdBy: null, labels: [] },
          ]}
        />
      );
    }

    const [prompt, versions] = await Promise.all([
      client.getPrompt(id),
      client.listPromptVersions(id),
    ]);

    return <PromptDetailView prompt={prompt} versions={versions.data} />;
  } catch (error) {
    console.error('Error loading prompt detail page:', error);

    return (
      <PageErrorState
        title="Unable to load prompt"
        message="We couldn't load this prompt right now."
        detail="Try refreshing the page or navigating back to the prompts list."
      />
    );
  }
}
