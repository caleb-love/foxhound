# Foxhound — Domain Context

Ubiquitous language for the Foxhound observability platform. Every skill, ADR, plan, test name, and issue title should use these terms exactly. If a concept is missing, that's a signal to either reconsider the language or run `/grill-with-docs` to extend the glossary.

For operating principles, security invariants, and workflow rules see [`CLAUDE.md`](CLAUDE.md).

## Glossary

### Tenancy

- **Organization (org)** — top-level tenant. The cardinal multi-tenancy boundary. Every persistent row carries `org_id`. Cross-org reads are forbidden outside explicit, documented internal/admin paths.
- **User** — a human identity. Joined to one or more orgs via memberships.
- **Membership** — `(user, org, role)` tuple; the only way a user gets org-scoped permissions.
- **API key** — server-side credential issued to an org; the SDK and CLI authenticate with it. Keys are revocable, scoped to their issuing org, and never shared across orgs.
- **SSO config** — per-org SAML/OIDC connection. Backburner until paid launch (see memory).

### Telemetry — the observability core

- **Trace** — one end-to-end execution of an agent (or agent step) within an org. Has a `trace_id`, a start/end window, a status, and aggregate cost/latency. Traces are the primary indexable unit.
- **Span** — a child unit of work inside a trace (LLM call, tool call, sub-agent invocation, retrieval, parser). Carries its own duration, cost, tokens, model id, input/output, and an optional parent span id. Hierarchical.
- **Run** — a single invocation of a tracked workload (e.g. one experiment trial, one evaluator pass over a dataset item, one CI quality-gate job). Distinct from "trace" — a run can produce many traces.
- **Annotation** — human-supplied label on a trace, span, or score. Lives in annotation queues for review workflows.

### Evaluation

- **Evaluator** — a function (LLM-as-judge, heuristic, code-based) that produces a score for a trace, span, run, or dataset item.
- **Evaluator run** — one execution of an evaluator over a target. Produces zero or more scores.
- **Score** — numeric/categorical/boolean output from an evaluator. Carries the evaluator id, target id, value, metadata.
- **Dataset** — a versioned collection of dataset items used as test fixtures for evaluators and experiments.
- **Dataset item** — one input/expected-output pair belonging to a dataset.
- **Experiment** — a named comparison run that ties an agent config (often a specific prompt version + model) to a dataset and an evaluator set.
- **Experiment run** — one execution of an experiment, producing scores per dataset item.

### Prompts

- **Prompt** — a named, org-owned prompt artifact. Identity is `(org, name)`.
- **Prompt version** — immutable revision of a prompt. Tracked for diffing, rollback, and experiment pinning.
- **Prompt label** — a moving pointer (e.g. `production`, `staging`) from a prompt to a specific version. The SDK resolves labels at runtime.

### Cost, budgets, SLAs, regressions

- **Pricing row** — model/provider unit price; the input to cost computation per token usage.
- **Model pricing override** — org-scoped override on top of `pricing_rows`.
- **Usage record** — billable usage event (tokens, runs, traces) emitted for metering and Stripe.
- **Budget** — org-scoped spend or usage ceiling tied to an agent config or time window.
- **SLA** — org-scoped latency/error threshold tied to an agent config.
- **Behavior baseline** — per-agent statistical baseline (cost, latency, score distributions) used to detect regressions.
- **Regression** — a statistically significant divergence from a behavior baseline.

### Agent configuration

- **Agent config** — org-owned record describing a tracked agent: identifier, prompt label binding, model, budget/SLA bindings.

### Notifications

- **Notification channel** — org-scoped destination (Slack webhook, email).
- **Alert rule** — org-scoped rule fired by budgets, SLAs, regressions, or worker conditions.
- **Notification log** — append-only history of fired notifications.

### Audit

- **Audit event** — org-scoped record of a sensitive action (key creation, member role change, SSO change).
- **Admin audit log** — internal/admin-only append log; out of the per-org audit stream.

### Surfaces

- **API** — Fastify REST surface in `apps/api`. The canonical mutation and read surface.
- **Worker** — BullMQ jobs in `apps/worker`. Handles evaluator runs, experiment runs, cost rollups, SLA evaluation, regression detection, notifications.
- **Web** — Next.js dashboard in `apps/web`. Operator UI.
- **SDK** — `packages/sdk-py` (primary) and `packages/sdk` (TypeScript). User-facing instrumentation.
- **CLI** — `packages/cli`. The `foxhound` command.
- **MCP server** — `packages/mcp-server`. Debugging tools exposed to MCP clients.
- **API client** — `packages/api-client`. Typed wrapper used by web, CLI, MCP, and integrations.

## Hard invariants

These are non-negotiable and override any suggestion to the contrary:

1. **Tenant scope on every query.** Every `SELECT`/`UPDATE`/`DELETE` filters by `org_id`. Joins preserve scope on both sides. Background jobs carry org context explicitly.
2. **Python SDK is primary.** In docs, examples, and onboarding, Python appears before TypeScript.
3. **Prompt versions are immutable.** Labels move; versions don't. Diff and rollback rely on this.
4. **Usage records are append-only.** They feed metering and Stripe; never mutate or delete.
5. **API keys are never shared across orgs.** Key issuance, revocation, and rotation are always single-org operations.
6. **Audit events are append-only.** No update/delete paths in product code.

## Terms to avoid

- "Account" — use **organization** for the tenant or **user** for the human; "account" is ambiguous.
- "Project" — Foxhound's tenancy unit is the org, not the project.
- "Workspace" — same; use org.
- "Tenant" in code identifiers — use `org` / `org_id`. "Tenant" is fine in prose.
- "Customer" in code — use **organization**.
- "Telemetry" as a count — telemetry is a mass noun; count traces, spans, runs, scores.

## Glossary maintenance

- When `/grill-with-docs` resolves new domain language, add it here and link the producing ADR if one was written.
- When an ADR contradicts a glossary entry, update the glossary in the same change.
- When a term is deprecated, leave a one-line tombstone pointing at the replacement.
