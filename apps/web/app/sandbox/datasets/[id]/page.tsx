import type { DatasetItemListResponse, DatasetWithCount } from '@foxhound/api-client';
import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { DatasetDetailView } from '@/components/datasets/dataset-detail-view';
import { PageErrorState } from '@/components/ui/page-state';
import { PageContainer } from '@/components/system/page';

interface SandboxDatasetDetailPageProps {
  params: Promise<{ id: string }>;
}

function buildExpectedOutput(trace: ReturnType<typeof buildLocalReviewDemo>['allTraces'][number]) {
  const metadata = trace.metadata;

  return {
    expectedAgentId: trace.agentId,
    expectedPromptName: typeof metadata.prompt_name === 'string' ? metadata.prompt_name : undefined,
    expectedPromptVersion:
      typeof metadata.prompt_version === 'number' ? metadata.prompt_version : undefined,
    expectedStory:
      typeof metadata.story_label === 'string' ? metadata.story_label : trace.id,
    expectedOutcome:
      typeof metadata.expected_outcome === 'string'
        ? metadata.expected_outcome
        : typeof metadata.narrative_role === 'string'
          ? `Preserve ${metadata.narrative_role} behavior.`
          : 'Match the seeded production behavior captured by this trace.',
  };
}

export default async function SandboxDatasetDetailPage({
  params,
}: SandboxDatasetDetailPageProps) {
  const { id } = await params;
  const demo = buildLocalReviewDemo();
  const dataset = demo.datasets.find((item) => item.id === id);

  if (!dataset) {
    return (
      <PageContainer>
        <PageErrorState
          title="Dataset not found"
          message="The requested sandbox dataset could not be found in the seeded evidence catalog."
          detail="Return to sandbox datasets and choose one of the available seeded evaluation sets."
        />
      </PageContainer>
    );
  }

  const linkedTraces = dataset.sourceTraceIds
    .map((traceId) => demo.allTraces.find((trace) => trace.id === traceId))
    .filter((trace): trace is NonNullable<typeof trace> => Boolean(trace));

  const datasetResponse: DatasetWithCount = {
    id: dataset.id,
    orgId: 'sandbox-org',
    name: dataset.name,
    description: dataset.description,
    createdAt: new Date().toISOString(),
    itemCount: dataset.itemCount,
  };

  const items: DatasetItemListResponse['data'] = linkedTraces.map((trace, index) => ({
    id: `${dataset.id}_item_${index + 1}`,
    datasetId: dataset.id,
    input: {
      traceId: trace.id,
      storyLabel:
        typeof trace.metadata.story_label === 'string' ? trace.metadata.story_label : trace.id,
      sessionId:
        typeof trace.sessionId === 'string' && trace.sessionId.length > 0
          ? trace.sessionId
          : null,
      promptName:
        typeof trace.metadata.prompt_name === 'string'
          ? trace.metadata.prompt_name
          : null,
      promptVersion:
        typeof trace.metadata.prompt_version === 'number'
          ? trace.metadata.prompt_version
          : null,
    },
    expectedOutput: buildExpectedOutput(trace),
    sourceTraceId: trace.id,
    createdAt: new Date(trace.startTimeMs).toISOString(),
  }));

  return <DatasetDetailView dataset={datasetResponse} items={items} baseHref="/sandbox" />;
}
