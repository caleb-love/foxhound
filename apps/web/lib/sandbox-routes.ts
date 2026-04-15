export const SANDBOX_BASE_PATH = '/sandbox';

export const SANDBOX_PROMPT_ID_BY_NAME: Record<string, string> = {
  'support-reply': 'prompt_support_reply',
  'refund-policy-check': 'prompt_refund_policy_check',
  'escalation-triage': 'prompt_escalation_triage',
};

export function isSandboxPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname.startsWith('/sandbox');
}

export function getSandboxRootHref(): string {
  return SANDBOX_BASE_PATH;
}

export function getSandboxHref(path: string = ''): string {
  if (!path || path === '/') return SANDBOX_BASE_PATH;
  return `${SANDBOX_BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getSandboxPromptDetailHref(promptName?: string): string | null {
  if (!promptName) return null;
  const promptId = SANDBOX_PROMPT_ID_BY_NAME[promptName];
  return promptId ? getSandboxHref(`/prompts/${promptId}`) : null;
}

export function getSandboxPromptDiffHref(
  promptName?: string,
  versionA?: string | number,
  versionB?: string | number,
): string | null {
  if (!promptName || versionA === undefined || versionB === undefined || versionA === versionB) return null;
  const promptId = SANDBOX_PROMPT_ID_BY_NAME[promptName];
  return promptId
    ? getSandboxHref(`/prompts/${promptId}/diff?versionA=${encodeURIComponent(String(versionA))}&versionB=${encodeURIComponent(String(versionB))}`)
    : null;
}

export function getSandboxRunDiffHref(
  traceA: string = 'trace_support_refund_v17_baseline',
  traceB: string = 'trace_support_refund_v18_regression',
): string {
  return getSandboxHref(`/diff?a=${encodeURIComponent(traceA)}&b=${encodeURIComponent(traceB)}`);
}

export function getSandboxReplayHref(traceId: string): string {
  return getSandboxHref(`/replay/${traceId}`);
}

export function getSandboxSessionHref(sessionId: string): string {
  return getSandboxHref(`/sessions/${sessionId}`);
}
