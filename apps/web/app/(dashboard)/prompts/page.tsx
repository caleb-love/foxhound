import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-client';
import { PromptListView } from '@/components/prompts/prompt-list-view';
import { PageErrorState } from '@/components/ui/page-state';

interface PromptsPageProps {
  searchParams?: Promise<{
    focus?: string;
    version?: string;
    baseline?: string;
    comparison?: string;
  }>;
}

export default async function PromptsPage({ searchParams }: PromptsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const client = getAuthenticatedClient(session.user.token);
  const resolvedSearchParams = searchParams ? await searchParams : {};

  let promptsData: Awaited<ReturnType<typeof client.listPrompts>>['data'] = [];
  let errorMessage: string | null = null;

  try {
    const prompts = await client.listPrompts();
    promptsData = prompts.data;
  } catch (error) {
    console.error('Error loading prompts page:', error);
    errorMessage = "We couldn't load prompts right now.";
  }

  if (errorMessage) {
    return (
      <PageErrorState
        title="Unable to load prompts"
        message={errorMessage}
        detail="Try refreshing the page or checking API connectivity."
      />
    );
  }

  const focusedPromptName = resolvedSearchParams.focus;
  const focusedPrompt = focusedPromptName
    ? promptsData.find((prompt) => prompt.name.toLowerCase() === focusedPromptName.toLowerCase())
    : null;

  if (
    focusedPrompt &&
    ((resolvedSearchParams.version && Number.isFinite(Number(resolvedSearchParams.version))) ||
      (resolvedSearchParams.baseline && resolvedSearchParams.comparison))
  ) {
    const query = new URLSearchParams();
    if (resolvedSearchParams.version) {
      query.set('versionA', resolvedSearchParams.version);
      query.set('versionB', resolvedSearchParams.version);
    }
    if (resolvedSearchParams.baseline) query.set('versionA', resolvedSearchParams.baseline);
    if (resolvedSearchParams.comparison) query.set('versionB', resolvedSearchParams.comparison);
    redirect(`/prompts/${focusedPrompt.id}/diff?${query.toString()}`);
  }

  if (focusedPrompt) {
    redirect(`/prompts/${focusedPrompt.id}`);
  }

  return <PromptListView prompts={promptsData} focusedPromptName={focusedPromptName} />;
}
