'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Play, Copy, Check } from 'lucide-react';

const EXAMPLE_PAYLOAD = `{
  "id": "trace_sdk_demo_001",
  "agentId": "returns-copilot",
  "sessionId": "sess_demo_001",
  "startTimeMs": ${Date.now() - 3200},
  "endTimeMs": ${Date.now()},
  "spans": [
    {
      "traceId": "trace_sdk_demo_001",
      "spanId": "span_001",
      "name": "process-return-request",
      "kind": "agent_step",
      "startTimeMs": ${Date.now() - 3200},
      "endTimeMs": ${Date.now() - 2100},
      "status": "ok",
      "attributes": { "customer_tier": "premium" },
      "events": []
    },
    {
      "traceId": "trace_sdk_demo_001",
      "spanId": "span_002",
      "parentSpanId": "span_001",
      "name": "gpt-4o",
      "kind": "llm_call",
      "startTimeMs": ${Date.now() - 2100},
      "endTimeMs": ${Date.now() - 800},
      "status": "ok",
      "attributes": {
        "model": "gpt-4o",
        "token_count_input": 1240,
        "token_count_output": 380,
        "cost_usd": 0.0089
      },
      "events": []
    },
    {
      "traceId": "trace_sdk_demo_001",
      "spanId": "span_003",
      "parentSpanId": "span_001",
      "name": "lookup-return-policy",
      "kind": "tool_call",
      "startTimeMs": ${Date.now() - 800},
      "endTimeMs": ${Date.now()},
      "status": "ok",
      "attributes": { "policy_id": "rp_standard_v3" },
      "events": []
    }
  ],
  "metadata": {
    "agent_version": "v2.1",
    "prompt_name": "support-reply",
    "prompt_version": 19
  }
}`;

const PYTHON_SNIPPET = `from foxhound import Foxhound

fox = Foxhound(
    api_key="fh_sk_...",
    endpoint="https://api.foxhound.dev"
)

with fox.trace("returns-copilot") as trace:
    with trace.span("process-return", kind="agent_step"):
        result = agent.run(customer_request)
        trace.span("gpt-4o", kind="llm_call", 
                    attributes={"model": "gpt-4o"})`;

const TYPESCRIPT_SNIPPET = `import { FoxhoundClient } from '@foxhound-ai/sdk';

const fox = new FoxhoundClient({
  apiKey: 'fh_sk_...',
  endpoint: 'https://api.foxhound.dev',
});

const tracer = fox.createTracer('returns-copilot');
const trace = tracer.startTrace({ sessionId: 'sess_001' });
trace.startSpan('process-return', { kind: 'agent_step' });
// ... agent logic ...
trace.endSpan();
await tracer.flush();`;

export function SdkSimulation() {
  const [payload, setPayload] = useState(EXAMPLE_PAYLOAD);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'payload' | 'python' | 'typescript'>('payload');
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const handleSimulate = useCallback(() => {
    setStatus('sending');

    // Simulate the API call timing
    setTimeout(() => {
      try {
        JSON.parse(payload);
        setStatus('success');
        toast.success('Trace accepted (202)', {
          description: 'In production, this trace would appear in the trace list within seconds.',
          action: {
            label: 'View traces',
            onClick: () => router.push('/sandbox/traces'),
          },
        });
      } catch {
        setStatus('error');
        toast.error('Invalid JSON payload', {
          description: 'Check the payload syntax and try again.',
        });
      }
    }, 600);
  }, [payload, router]);

  const handleCopy = useCallback(async () => {
    const text = activeTab === 'python' ? PYTHON_SNIPPET : activeTab === 'typescript' ? TYPESCRIPT_SNIPPET : payload;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }, [activeTab, payload]);

  return (
    <Card className="backdrop-blur-xl" style={{ color: 'var(--tenant-text-primary)', borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel)', boxShadow: 'var(--tenant-shadow-panel)' }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>SDK simulation</CardTitle>
            <CardDescription className="text-tenant-text-muted">
              Preview the trace ingestion flow. In production, the SDK sends structured traces to the API and they appear in the dashboard within seconds.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            style={
              status === 'success'
                ? { background: 'color-mix(in srgb, var(--tenant-success) 12%, transparent)', color: 'var(--tenant-success)', borderColor: 'color-mix(in srgb, var(--tenant-success) 30%, transparent)' }
                : status === 'error'
                  ? { background: 'color-mix(in srgb, var(--tenant-danger) 12%, transparent)', color: 'var(--tenant-danger)', borderColor: 'color-mix(in srgb, var(--tenant-danger) 30%, transparent)' }
                  : undefined
            }
          >
            {status === 'idle' ? 'Ready' : status === 'sending' ? 'Sending...' : status === 'success' ? '202 Accepted' : '400 Error'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--tenant-panel-stroke)', background: 'var(--tenant-panel-alt)' }}>
          {(['payload', 'python', 'typescript'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors"
              style={activeTab === tab
                ? { background: 'var(--card)', color: 'var(--tenant-text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { color: 'var(--tenant-text-muted)' }
              }
            >
              {tab === 'payload' ? 'JSON Payload' : tab === 'python' ? 'Python SDK' : 'TypeScript SDK'}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'payload' ? (
          <Textarea
            value={payload}
            onChange={(e) => { setPayload(e.target.value); setStatus('idle'); }}
            className="h-64 font-mono text-xs"
            style={{ background: 'var(--tenant-panel-alt)', color: 'var(--tenant-text-secondary)', borderColor: 'var(--tenant-panel-stroke)' }}
          />
        ) : (
          <pre
            className="h-64 overflow-auto rounded-lg border p-4 font-mono text-xs"
            style={{ background: 'var(--tenant-panel-alt)', color: 'var(--tenant-text-secondary)', borderColor: 'var(--tenant-panel-stroke)' }}
          >
            {activeTab === 'python' ? PYTHON_SNIPPET : TYPESCRIPT_SNIPPET}
          </pre>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {activeTab === 'payload' ? (
            <Button onClick={handleSimulate} disabled={status === 'sending'} size="sm" className="gap-2">
              <Play className="h-3.5 w-3.5" />
              {status === 'sending' ? 'Sending...' : 'Simulate ingestion'}
            </Button>
          ) : null}
          <Button onClick={handleCopy} variant="outline" size="sm" className="gap-2">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        <p className="text-xs text-tenant-text-muted">
          POST /v1/traces with an API key header. The API returns 202 immediately and persists asynchronously. Error traces bypass server-side sampling.
        </p>
      </CardContent>
    </Card>
  );
}
