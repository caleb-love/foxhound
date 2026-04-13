import { TraceTimeline } from '@/components/traces/trace-timeline';
import { SessionReplay } from '@/components/replay/session-replay';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { notFound } from 'next/navigation';
import type { Trace } from '@foxhound/types';

export default async function DemoTraceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // Fetch from our demo API endpoint
  const response = await fetch(`http://localhost:3001/api/demo/traces/${params.id}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    notFound();
  }

  const trace: Trace = await response.json();

  const duration = trace.endTimeMs
    ? ((trace.endTimeMs - trace.startTimeMs) / 1000).toFixed(2)
    : 'In progress';
  const hasError = trace.spans.some((s) => s.status === 'error');

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Trace</h1>
            <Badge variant={hasError ? 'destructive' : 'default'}>
              {hasError ? 'Error' : 'Success'}
            </Badge>
          </div>
          <p className="font-mono text-sm text-gray-500">{trace.id}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{duration}s</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Spans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trace.spans.length}</div>
            <p className="text-xs text-gray-500 mt-1">
              {trace.spans.filter((s) => s.kind === 'llm_call').length} LLM calls
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="truncate font-mono text-lg">{trace.agentId}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="replay">Session Replay</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Execution Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <TraceTimeline spans={trace.spans} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="replay" className="mt-0">
          <Card className="h-[calc(100vh-24rem)] overflow-hidden">
            <SessionReplay trace={trace} />
          </Card>
        </TabsContent>
        <TabsContent value="metadata">
          <Card>
            <CardHeader>
              <CardTitle>Trace Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-gray-100 p-4 overflow-auto text-sm">
                {JSON.stringify(trace.metadata, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
