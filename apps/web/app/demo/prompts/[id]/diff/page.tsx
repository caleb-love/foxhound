import { notFound } from 'next/navigation';
import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageWarningState } from '@/components/ui/page-state';

interface DemoPromptDiffPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ versionA?: string; versionB?: string }>;
}

export default async function DemoPromptDiffPage({ params, searchParams }: DemoPromptDiffPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const demo = buildLocalReviewDemo();
  const prompt = demo.prompts.find((item) => item.id === id);

  if (!prompt) {
    notFound();
  }

  const versionA = Number(resolvedSearchParams.versionA);
  const versionB = Number(resolvedSearchParams.versionB);
  const baseline = prompt.versions.find((item) => item.version === versionA);
  const comparison = prompt.versions.find((item) => item.version === versionB);

  if (!baseline || !comparison) {
    return (
      <PageWarningState
        title="Choose two versions"
        message="Select two prompt versions from the prompt detail page to inspect changes in the demo story."
      />
    );
  }

  const changedFields: Array<{ field: string; before: string; after: string }> = [];
  if (baseline.model !== comparison.model) {
    changedFields.push({ field: 'model', before: baseline.model, after: comparison.model });
  }
  if (baseline.summary !== comparison.summary) {
    changedFields.push({ field: 'summary', before: baseline.summary, after: comparison.summary });
  }
  if (baseline.narrativeRole !== comparison.narrativeRole) {
    changedFields.push({ field: 'narrative role', before: baseline.narrativeRole, after: comparison.narrativeRole });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Prompt Comparison</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare prompt versions for <span className="font-medium text-foreground">{prompt.name}</span>.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">v{baseline.version}</Badge>
        <span>→</span>
        <Badge>v{comparison.version}</Badge>
        <span>{changedFields.length} changed field(s)</span>
      </div>

      {changedFields.length === 0 ? (
        <PageWarningState
          title="No differences found"
          message={`Versions ${baseline.version} and ${comparison.version} are identical in the current demo fixture.`}
        />
      ) : (
        <div className="space-y-4">
          {changedFields.map((change) => (
            <Card key={change.field}>
              <CardHeader>
                <CardTitle className="capitalize">{change.field}</CardTitle>
                <CardDescription>
                  Difference between version {baseline.version} and version {comparison.version}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Before</div>
                    <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs whitespace-pre-wrap">{change.before}</pre>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">After</div>
                    <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs whitespace-pre-wrap">{change.after}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
