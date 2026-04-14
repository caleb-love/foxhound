import { notFound } from 'next/navigation';
import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function DemoPromptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demo = buildLocalReviewDemo();
  const prompt = demo.prompts.find((item) => item.id === id);

  if (!prompt) {
    notFound();
  }

  const sortedVersions = [...prompt.versions].sort((a, b) => b.version - a.version);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{prompt.name}</h1>
        <p className="text-sm text-muted-foreground">
          {prompt.purpose}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prompt overview</CardTitle>
          <CardDescription>Shared demo-domain prompt record.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prompt ID</div>
            <div className="mt-1 font-mono text-sm">{prompt.id}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Latest version</div>
            <div className="mt-1 text-sm">v{sortedVersions[0]?.version}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total versions</div>
            <div className="mt-1 text-sm">{sortedVersions.length}</div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {sortedVersions.map((version, index) => {
          const compareTarget = sortedVersions[index + 1] ?? null;
          const compareHref = compareTarget
            ? `/demo/prompts/${prompt.id}/diff?versionA=${compareTarget.version}&versionB=${version.version}`
            : null;

          return (
            <Card key={`${prompt.id}-${version.version}`}>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle>Version {version.version}</CardTitle>
                    <CardDescription>{version.model}</CardDescription>
                  </div>
                  <Badge variant="secondary">{version.narrativeRole}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                  {version.summary}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Narrative role: {version.narrativeRole}</span>
                  {compareHref ? (
                    <a href={compareHref} className="font-medium text-primary underline-offset-4 hover:underline">
                      Compare against v{compareTarget?.version}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Oldest available version</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
