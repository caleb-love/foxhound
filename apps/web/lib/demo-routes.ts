export const DEMO_PROMPT_ID_BY_NAME: Record<string, string> = {
  'support-reply': 'prompt_support_reply',
  'refund-policy-check': 'prompt_refund_policy_check',
  'escalation-triage': 'prompt_escalation_triage',
};

export function getDemoPromptDetailHref(promptName?: string): string | null {
  if (!promptName) return null;
  const promptId = DEMO_PROMPT_ID_BY_NAME[promptName];
  return promptId ? `/demo/prompts/${promptId}` : null;
}

export function getDemoPromptDiffHref(promptName?: string, versionA?: string | number, versionB?: string | number): string | null {
  if (!promptName || versionA === undefined || versionB === undefined || versionA === versionB) return null;
  const promptId = DEMO_PROMPT_ID_BY_NAME[promptName];
  return promptId ? `/demo/prompts/${promptId}/diff?versionA=${encodeURIComponent(String(versionA))}&versionB=${encodeURIComponent(String(versionB))}` : null;
}

export function getDemoReplayHref(traceId: string): string {
  return `/demo/replay/${traceId}`;
}

export function getDemoSessionHref(sessionId: string): string {
  return `/demo/sessions/${sessionId}`;
}
