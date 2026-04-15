import type { PromptResponse, PromptVersionResponse } from '@foxhound/api-client';
import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { PromptDetailView } from '@/components/prompts/prompt-detail-view';
import { PageErrorState } from '@/components/ui/page-state';
import { PageContainer } from '@/components/system/page';

export default async function SandboxPromptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demo = buildLocalReviewDemo();
  const prompt = demo.prompts.find((item) => item.id === id);

  if (!prompt) {
    return (
      <PageContainer>
        <PageErrorState
          title="Prompt not found"
          message="The requested sandbox prompt could not be found in the seeded catalog."
          detail="Return to sandbox prompts and choose one of the available prompt families."
        />
      </PageContainer>
    );
  }

  const promptResponse: PromptResponse = {
    id: prompt.id,
    orgId: 'sandbox-org',
    name: prompt.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const versions: PromptVersionResponse[] = [...prompt.versions].map((version) => ({
    id: `${prompt.id}-${version.version}`,
    promptId: prompt.id,
    version: version.version,
    content: version.summary,
    model: version.model,
    config: {},
    createdAt: new Date().toISOString(),
    createdBy: null,
    labels: [version.narrativeRole],
  }));

  return <PromptDetailView prompt={promptResponse} versions={versions} baseHref="/sandbox" />;
}
