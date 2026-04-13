-- H1.4: [SECURITY] Per-org LLM evaluation consent gate
-- Customer trace payloads are sent to third-party LLM providers (OpenAI, Anthropic)
-- during evaluator runs. Orgs must explicitly opt in before this can happen.

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "llm_evaluation_enabled" boolean NOT NULL DEFAULT false;
