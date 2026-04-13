import type { Trace, Span } from '@foxhound/types';

// Type definitions for demo data generation
type SpanAttributes = Record<string, string | number | boolean | null>;

interface WorkflowNode {
  name: string;
  kind: 'workflow' | 'llm_call' | 'tool_call' | 'agent_step' | 'custom';
  duration: number;
  status?: 'ok' | 'error' | 'unset';
  attrs?: SpanAttributes;
  children?: WorkflowNode[];
}

type TraceMetadata = Record<string, string | number | boolean | null>;

// Realistic agent workflow patterns
const AGENT_WORKFLOWS = [
  {
    name: "Customer Support RAG",
    agentId: "support-agent-v2",
    pattern: (_baseTime: number): WorkflowNode[] => [
      {
        name: "Handle Support Ticket",
        kind: "workflow" as const,
        duration: 45000,
        children: [
          { name: "Classify Intent", kind: "llm_call" as const, duration: 3200, attrs: { model: "gpt-4-turbo", tokens: 456, cost: 0.0234 } },
          { name: "Search Knowledge Base", kind: "tool_call" as const, duration: 1200, attrs: { tool: "vector_search", results: 8 } },
          { name: "Generate Response", kind: "llm_call" as const, duration: 5800, attrs: { model: "gpt-4", tokens: 2134, cost: 0.0876 } },
          { name: "Validate Response Quality", kind: "agent_step" as const, duration: 800, attrs: { quality_score: 0.92 } },
        ],
      },
    ],
  },
  {
    name: "Code Generation Pipeline",
    agentId: "codegen-agent",
    pattern: (_baseTime: number): WorkflowNode[] => [
      {
        name: "Generate Code",
        kind: "workflow" as const,
        duration: 120000,
        children: [
          { name: "Analyze Requirements", kind: "llm_call" as const, duration: 8900, attrs: { model: "claude-3.5-sonnet", tokens: 3456, cost: 0.1234 } },
          { name: "Plan Architecture", kind: "agent_step" as const, duration: 12000, attrs: { components: 5 } },
          { name: "Generate Implementation", kind: "llm_call" as const, duration: 45000, attrs: { model: "claude-3.5-sonnet", tokens: 12456, cost: 0.4567 } },
          { name: "Run Unit Tests", kind: "tool_call" as const, duration: 8000, attrs: { tool: "pytest", tests_passed: 23, tests_failed: 2 } },
          { name: "Fix Failing Tests", kind: "llm_call" as const, duration: 15000, attrs: { model: "gpt-4", tokens: 5678, cost: 0.1876 } },
          { name: "Validate Solution", kind: "agent_step" as const, duration: 3000, attrs: { all_tests_passed: true } },
        ],
      },
    ],
  },
  {
    name: "Research & Synthesis",
    agentId: "research-agent",
    pattern: (_baseTime: number): WorkflowNode[] => [
      {
        name: "Research Topic",
        kind: "workflow" as const,
        duration: 180000,
        children: [
          { name: "Web Search", kind: "tool_call" as const, duration: 5000, attrs: { tool: "serp_api", results: 50 } },
          { name: "Scrape Sources", kind: "tool_call" as const, duration: 25000, attrs: { tool: "web_scraper", pages: 15 } },
          { name: "Extract Key Points", kind: "llm_call" as const, duration: 35000, attrs: { model: "gpt-4-turbo", tokens: 45000, cost: 0.678 } },
          { name: "Synthesize Findings", kind: "llm_call" as const, duration: 28000, attrs: { model: "gpt-4", tokens: 8900, cost: 0.289 } },
          { name: "Generate Citations", kind: "agent_step" as const, duration: 2000, attrs: { sources_cited: 12 } },
        ],
      },
    ],
  },
  {
    name: "Data Pipeline ETL",
    agentId: "data-pipeline",
    pattern: (_baseTime: number): WorkflowNode[] => [
      {
        name: "Process Data Batch",
        kind: "workflow" as const,
        duration: 95000,
        children: [
          { name: "Fetch Records", kind: "tool_call" as const, duration: 8000, attrs: { tool: "postgres", records: 5000 } },
          { name: "Validate Schema", kind: "agent_step" as const, duration: 3000, attrs: { valid: 4987, invalid: 13 } },
          { name: "Transform with LLM", kind: "llm_call" as const, duration: 65000, attrs: { model: "gpt-3.5-turbo", tokens: 89000, cost: 0.445 } },
          { name: "Write to Warehouse", kind: "tool_call" as const, duration: 12000, attrs: { tool: "bigquery", rows_written: 4987 } },
        ],
      },
    ],
  },
  {
    name: "Multi-Agent Coordination",
    agentId: "orchestrator",
    pattern: (_baseTime: number): WorkflowNode[] => [
      {
        name: "Coordinate Multi-Agent Task",
        kind: "workflow" as const,
        duration: 145000,
        children: [
          { name: "Decompose Task", kind: "llm_call" as const, duration: 6000, attrs: { model: "gpt-4", subtasks: 3 } },
          { name: "Delegate to Research Agent", kind: "agent_step" as const, duration: 45000, attrs: { agent: "research-agent" } },
          { name: "Delegate to Analysis Agent", kind: "agent_step" as const, duration: 38000, attrs: { agent: "analysis-agent" } },
          { name: "Delegate to Writer Agent", kind: "agent_step" as const, duration: 42000, attrs: { agent: "writer-agent" } },
          { name: "Merge Results", kind: "llm_call" as const, duration: 8000, attrs: { model: "gpt-4-turbo", tokens: 5600 } },
        ],
      },
    ],
  },
  {
    name: "Error Recovery Flow",
    agentId: "resilient-agent",
    pattern: (_baseTime: number, shouldFail = false): WorkflowNode[] => [
      {
        name: "Process with Retry Logic",
        kind: "workflow" as const,
        duration: shouldFail ? 75000 : 25000,
        status: shouldFail ? "error" : "ok",
        children: shouldFail
          ? [
              { name: "Initial Attempt", kind: "llm_call" as const, duration: 5000, status: "error", attrs: { model: "gpt-4", error: "Rate limit exceeded" } },
              { name: "Retry Attempt 1", kind: "llm_call" as const, duration: 5000, status: "error", attrs: { model: "gpt-4", error: "Rate limit exceeded" } },
              { name: "Fallback to Cheaper Model", kind: "llm_call" as const, duration: 8000, status: "error", attrs: { model: "gpt-3.5-turbo", error: "Timeout" } },
              { name: "Circuit Breaker Triggered", kind: "agent_step" as const, duration: 500, status: "error", attrs: { reason: "Max retries exceeded" } },
            ]
          : [
              { name: "Execute Task", kind: "llm_call" as const, duration: 5000, attrs: { model: "gpt-4", tokens: 1234 } },
              { name: "Validate Output", kind: "agent_step" as const, duration: 800, attrs: { valid: true } },
            ],
      },
    ],
  },
  {
    name: "RAG with Reranking",
    agentId: "advanced-rag",
    pattern: (_baseTime: number): WorkflowNode[] => [
      {
        name: "Advanced RAG Query",
        kind: "workflow" as const,
        duration: 38000,
        children: [
          { name: "Generate Query Embedding", kind: "llm_call" as const, duration: 800, attrs: { model: "text-embedding-3-large", tokens: 45 } },
          { name: "Vector Search", kind: "tool_call" as const, duration: 2200, attrs: { tool: "pinecone", results: 20 } },
          { name: "Rerank Results", kind: "llm_call" as const, duration: 5000, attrs: { model: "cohere-rerank", top_k: 5 } },
          { name: "Generate Answer", kind: "llm_call" as const, duration: 8500, attrs: { model: "gpt-4", tokens: 3456, cost: 0.1234 } },
        ],
      },
    ],
  },
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSpanId(): string {
  return `span-${Math.random().toString(36).substring(2, 11)}`;
}

function generateTraceId(index: number): string {
  return `trace-${String(index).padStart(6, "0")}-${Math.random().toString(36).substring(2, 7)}`;
}

function buildSpans(
  traceId: string,
  pattern: WorkflowNode[],
  baseTime: number,
  parentId: string | null = null,
  depth: number = 0
): Span[] {
  const spans: Span[] = [];
  let currentTime = baseTime;

  for (const node of pattern) {
    const spanId = generateSpanId();
    const startTime = currentTime;
    const endTime = currentTime + node.duration;
    const status = node.status || "ok";

    spans.push({
      spanId: spanId,
      traceId,
      parentSpanId: parentId || undefined,
      name: node.name,
      kind: node.kind,
      startTimeMs: startTime,
      endTimeMs: endTime,
      status: status as 'ok' | 'error' | 'unset',
      attributes: node.attrs || {},
      events: [],
    });

    if (node.children) {
      const childSpans = buildSpans(traceId, node.children, startTime + 100, spanId, depth + 1);
      spans.push(...childSpans);
    }

    currentTime = endTime + 50; // Small gap between spans
  }

  return spans;
}

export function generateDemoTraces(count: number = 100): Trace[] {
  const traces: Trace[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const workflow = randomChoice(AGENT_WORKFLOWS);
    const baseTime = now - Math.random() * 7 * 24 * 60 * 60 * 1000; // Random time in last 7 days
    const shouldFail = Math.random() < 0.15; // 15% failure rate

    const pattern = workflow.pattern(baseTime, shouldFail);
    const traceId = generateTraceId(i);
    const spans = buildSpans(traceId, pattern, baseTime);

    const firstSpan = spans[0];
    const lastSpan = spans[spans.length - 1];
    
    const metadata: TraceMetadata = {
      workflow: workflow.name,
      environment: ['production', 'staging', 'development'][Math.floor(Math.random() * 3)] as string,
      user_id: `user_${Math.floor(Math.random() * 100)}`,
    };

    traces.push({
      id: traceId,
      agentId: workflow.agentId,
      sessionId: Math.random() > 0.7 ? `session_${Math.floor(Math.random() * 3) + 1}` : undefined,
      startTimeMs: firstSpan ? firstSpan.startTimeMs : baseTime,
      endTimeMs: lastSpan ? lastSpan.endTimeMs : baseTime + 10000,
      spans: spans,
      metadata: metadata,
    });
  }

  // Sort by most recent first
  return traces.sort((a, b) => Number(b.startTimeMs) - Number(a.startTimeMs));
}

// Generate 100 traces for demo
export const DEMO_TRACES = generateDemoTraces(100);
