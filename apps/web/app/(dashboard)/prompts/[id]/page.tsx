import type { PromptResponse, PromptVersionResponse } from '@foxhound/api-client';
import { getAuthenticatedClient } from '@/lib/api-client';
import { PromptDetailView } from '@/components/prompts/prompt-detail-view';
import { CreatePromptVersionDialog } from '@/components/prompts/prompt-actions';
import { SetPromptLabelDialog } from '@/components/prompts/prompt-label-actions';
import { PageErrorState } from '@/components/ui/page-state';
import { getDashboardSessionOrSandbox, isDashboardSandboxModeEnabled } from '@/lib/sandbox-auth';

interface PromptDetailPageProps {
  params: Promise<{ id: string }>;
}

async function createPromptVersionAction(promptId: string, formData: FormData) {
  'use server';

  const session = await getDashboardSessionOrSandbox();
  const content = String(formData.get('content') ?? '').trim();
  const model = String(formData.get('model') ?? '').trim();
  const configRaw = String(formData.get('config') ?? '').trim();

  if (!content) {
    return { ok: false, error: 'Prompt content is required.' };
  }

  let config: Record<string, unknown> | undefined;
  if (configRaw) {
    try {
      config = JSON.parse(configRaw) as Record<string, unknown>;
    } catch {
      return { ok: false, error: 'Prompt config must be valid JSON.' };
    }
  }

  try {
    const client = getAuthenticatedClient(session.user.token);
    await client.createPromptVersion(promptId, {
      content,
      model: model || undefined,
      config,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to create prompt version right now.' };
  }
}

async function setPromptLabelAction(promptId: string, formData: FormData) {
  'use server';

  const session = await getDashboardSessionOrSandbox();
  const label = String(formData.get('label') ?? '').trim();
  const versionNumberRaw = String(formData.get('versionNumber') ?? '').trim();
  const versionNumber = Number(versionNumberRaw);

  if (!label || Number.isNaN(versionNumber)) {
    return { ok: false, error: 'Label and version are required.' };
  }

  try {
    const client = getAuthenticatedClient(session.user.token);
    await client.setPromptLabel(promptId, { label, versionNumber });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to set prompt label right now.' };
  }
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

  return (
    <>
      {!isDashboardSandboxModeEnabled() ? (
        <div className="flex flex-wrap justify-end gap-2">
          <CreatePromptVersionDialog createPromptVersionAction={createPromptVersionAction.bind(null, id)} />
          <SetPromptLabelDialog
            availableVersions={versions.map((version) => version.version).sort((a, b) => b - a)}
            setPromptLabelAction={setPromptLabelAction.bind(null, id)}
          />
        </div>
      ) : null}
      <PromptDetailView prompt={prompt} versions={versions} />
    </>
  );
}
