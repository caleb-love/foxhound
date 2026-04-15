import type { PromptVersionDiffResponse, PromptVersionResponse } from '@foxhound/api-client';
import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { PromptDiffView } from '@/components/prompts/prompt-diff-view';
import { PageErrorState, PageWarningState } from '@/components/ui/page-state';
import { PageContainer } from '@/components/system/page';

interface SandboxPromptDiffPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ versionA?: string; versionB?: string }>;
}

export default async function SandboxPromptDiffPage({ params, searchParams }: SandboxPromptDiffPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const demo = buildLocalReviewDemo();
  const prompt = demo.prompts.find((item) => item.id === id);

  if (!prompt) {
    return (
      <PageContainer>
        <PageErrorState
          title="Prompt not found"
          message="The requested sandbox prompt family could not be found."
          detail="Return to sandbox prompts and choose a prompt before comparing versions."
        />
      </PageContainer>
    );
  }

  const versionA = Number(resolvedSearchParams.versionA);
  const versionB = Number(resolvedSearchParams.versionB);
  const baseline = prompt.versions.find((item) => item.version === versionA);
  const comparison = prompt.versions.find((item) => item.version === versionB);

  if (!baseline || !comparison) {
    return (
      <PageContainer>
        <PageWarningState
          title="Choose two versions"
          message="Select two prompt versions from the prompt detail page to inspect changes in the demo story."
        />
      </PageContainer>
    );
  }

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

  const changes: PromptVersionDiffResponse['changes'] = [];
  if (baseline.model !== comparison.model) {
    changes.push({ field: 'model', before: baseline.model, after: comparison.model });
  }
  if (baseline.summary !== comparison.summary) {
    changes.push({ field: 'content', before: baseline.summary, after: comparison.summary });
  }
  if (baseline.narrativeRole !== comparison.narrativeRole) {
    changes.push({ field: 'config', before: { narrativeRole: baseline.narrativeRole }, after: { narrativeRole: comparison.narrativeRole } });
  }

  const initialDiff: PromptVersionDiffResponse = {
    promptId: prompt.id,
    promptName: prompt.name,
    versionA: baseline.version,
    versionB: comparison.version,
    hasChanges: changes.length > 0,
    changes,
  };

  return (
    <PromptDiffView
      promptName={prompt.name}
      versions={versions}
      initialDiff={initialDiff}
      initialVersionA={baseline.version}
      initialVersionB={comparison.version}
      baseHref="/sandbox"
    />
  );
}
