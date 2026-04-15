import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import type { PromptResponse } from '@foxhound/api-client';
import { PromptListView } from '@/components/prompts/prompt-list-view';

export default function SandboxPromptsPage() {
  const demo = buildLocalReviewDemo();
  const prompts: PromptResponse[] = [...demo.prompts]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((prompt) => ({
      id: prompt.id,
      orgId: 'sandbox-org',
      name: prompt.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

  return <PromptListView prompts={prompts} baseHref="/sandbox" />;
}
