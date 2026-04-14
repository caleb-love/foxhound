import { buildLocalReviewDemo } from '@foxhound/demo-domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DemoPromptsPage() {
  const demo = buildLocalReviewDemo();
  const prompts = [...demo.prompts].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Prompts</h1>
        <p className="text-sm text-muted-foreground">
          Demo prompt catalog powered by the shared demo-domain package. Use these records to trace how prompt changes connect to regressions, datasets, and recovery experiments.
        </p>
      </div>

      <div className="grid gap-4">
        {prompts.map((prompt) => (
          <Card key={prompt.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>{prompt.name}</CardTitle>
                  <CardDescription>{prompt.purpose}</CardDescription>
                </div>
                <a
                  href={`/demo/prompts/${prompt.id}`}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  View prompt
                </a>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {prompt.versions.length} version{prompt.versions.length === 1 ? '' : 's'} available
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
