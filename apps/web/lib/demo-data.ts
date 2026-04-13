/**
 * Demo data generator for testing the Foxhound dashboard
 */

import type { Trace, Span } from "@foxhound/types";

const AGENT_IDS = [
  "customer-support-agent",
  "code-review-agent",
  "data-analysis-agent",
  "content-generator",
  "bug-triage-agent",
];

const TOOL_NAMES = [
  "web_search",
  "database_query",
  "send_email",
  "create_ticket",
  "analyze_logs",
  "generate_report",
  "fetch_user_data",
];

const LLM_PROMPTS = [
  "Analyze customer sentiment",
  "Generate response",
  "Classify issue type",
  "Extract key information",
  "Summarize conversation",
  "Plan next steps",
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateSpan(
  traceId: string,
  index: number,
  baseTime: number,
  parentSpanId?: string,
): Span {
  const kind = randomChoice(["llm_call", "tool_call", "agent_step"] as const);
  const startTimeMs = baseTime + index * randomInt(100, 500);
  const duration = kind === "llm_call" ? randomInt(800, 3000) : randomInt(100, 800);
  const status = Math.random() > 0.9 ? "error" : "ok"; // 10% error rate

  let name = "";
  let attributes: Record<string, string | number | boolean | null> = {};

  if (kind === "llm_call") {
    name = randomChoice(LLM_PROMPTS);
    attributes = {
      model: randomChoice(["claude-3-5-sonnet", "gpt-4o", "claude-3-haiku"]),
      input_tokens: randomInt(200, 1500),
      output_tokens: randomInt(50, 500),
      temperature: 0.7,
    };
  } else if (kind === "tool_call") {
    name = randomChoice(TOOL_NAMES);
    attributes = {
      tool: name,
      result_status: status,
    };
  } else {
    name = `Step ${index + 1}`;
    attributes = {
      step_type: randomChoice(["planning", "execution", "validation"]),
    };
  }

  return {
    traceId,
    spanId: `span_${index}`,
    parentSpanId,
    name,
    kind,
    startTimeMs,
    endTimeMs: startTimeMs + duration,
    status,
    attributes,
    events: [],
  };
}

export function generateDemoTrace(index: number): Trace {
  const traceId = `trace_demo_${index}`;
  const agentId = randomChoice(AGENT_IDS);
  const sessionId = Math.random() > 0.7 ? `session_${randomInt(1, 3)}` : undefined;
  const spanCount = randomInt(3, 12);
  const baseTime = Date.now() - randomInt(60000, 3600000); // Last hour

  const spans: Span[] = [];
  for (let i = 0; i < spanCount; i++) {
    spans.push(generateSpan(traceId, i, baseTime));
  }

  const startTimeMs = Math.min(...spans.map((s) => s.startTimeMs));
  const endTimeMs = Math.max(...spans.map((s) => s.endTimeMs || s.startTimeMs));

  return {
    id: traceId,
    agentId,
    sessionId,
    startTimeMs,
    endTimeMs,
    spans,
    metadata: {
      environment: randomChoice(["production", "staging", "development"]),
      user_id: `user_${randomInt(1, 100)}`,
      request_id: `req_${Math.random().toString(36).slice(2)}`,
    },
  };
}

export function generateDemoTraces(count: number): Trace[] {
  return Array.from({ length: count }, (_, i) => generateDemoTrace(i));
}
