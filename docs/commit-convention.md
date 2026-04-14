# Foxhound Commit Convention

Derived from the 21 canonical commits on `main`. Every commit in this repository must follow this standard.

## Format

```
<type>: <concise summary> — <scope/context phrase>

<optional body paragraph describing the "what" and "why">
<optional bullet list of key changes>
```

## Rules

### Subject Line

1. **Type prefix** — one of: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`, `style`
2. **Colon + space** after type — `feat: ` not `feat:` or `feat :`
3. **Lowercase** after the colon — `feat: add X` not `feat: Add X`
4. **No trailing period**
5. **Max 72 characters** for the subject line
6. **Em dash separator** (`—`) between the summary and scope/context when both are present
7. **No ticket/issue prefixes in subject** — use `feat:` not `feat(FOX-99):`
8. **Summary is noun-phrase or imperative** — describes the deliverable, not the process

### Body (when present)

9. **Blank line** between subject and body
10. **Opening sentence** — a brief "what this is" overview (optional, for large changes)
11. **Bullet list** — each line starts with `- ` and describes a discrete deliverable
12. **Bullets are noun-phrase style** — describe what was added/changed, not imperative commands
13. **No "why" justification unless non-obvious** — the type + summary carry intent
14. **Wrap at 80 characters**

### Scope

15. **Parenthetical scope is NOT used** — scoping goes in the em-dash phrase or body bullets
    - Correct: `feat: agent intelligence — cost budgets, SLA monitoring, and regression detection`
    - Wrong: `feat(api): add budget endpoints`

## Examples

### Large feature (multi-component)

```
feat: agent intelligence — cost budgets, SLA monitoring, and regression detection

Implement agent-native intelligence layer:
- Cost budget CRUD endpoints with real-time Redis counters
- SLA monitoring with fan-out scheduler and per-agent checks
- Behavior regression detection with auto-baseline and structural drift
- Cost-monitor and cost-reconciler background workers
- Model pricing cache with longest-prefix match
- Agent config management and in-memory caching
- SDK and API client extensions for budgets, SLAs, and regressions
- MCP tools for budget, SLA, regression, and baseline inspection
- Integration tests for all new endpoints
```

### Medium feature

```
feat: open-source pivot — remove paid gating, add waitlist

Reposition Foxhound as open-source, self-hosted:
- Remove paid feature gating and billing dependencies
- Add web3forms waitlist signup integration
- Update READMEs for self-hosted open-source positioning
- Add rate limiting to SSO auth endpoints
```

### Small feature (no body needed)

```
feat: Foxhound brand refresh — new logo, wordmark, and favicon
```

```
feat: SSO — SAML 2.0 and OIDC for Okta and Azure AD
```

### Refactor

```
refactor: unify SDK naming and streamline README

- Rename fox_sdk to foxhound, FoxClient to FoxhoundClient
- Simplify README from 478 to 132 lines with focused content
```

### Docs

```
docs: agent intelligence design spec and implementation plan
```

### Chore

```
chore: resolve dependency vulnerabilities and upgrade drizzle-orm

- Resolve 20 Dependabot vulnerability alerts
- Upgrade drizzle-orm from 0.30.10 to 0.45.2
- Fix lint and typecheck issues from dependency upgrades
```

### Security / hardening

```
feat: security hardening, rate limiting, and test coverage

Harden the platform and establish test baseline:
- HttpOnly cookies, CSP headers, and redirect validation
- Rate limiting, audit event org scoping, and billing status cache
- Report-usage auth hardening with expanded test coverage
- TypeScript SDK test suite (client + tracer)
- Frontend test suite for web app
- UI refinements from design review
```

## Anti-Patterns (rejected by hooks)

| Pattern | Problem |
|---------|---------|
| `feat(FOX-99): add X` | No ticket scopes — use em-dash phrasing |
| `feat: Add X` | Capitalize after colon |
| `feat: add X.` | Trailing period |
| `Updated the thing` | Missing type prefix |
| `feat : add X` | Space before colon |
| `wip` / `temp` / `fixup` | No work-in-progress commits on main |
| `feat: add X and Y and Z and W and more things here` | Over 72 chars — move detail to body |

## Enforcement

This convention is enforced at three layers:

1. **Git `commit-msg` hook** — validates format on every `git commit`
2. **Git `pre-push` hook** — validates all commits being pushed to origin
3. **Claude Code `PreToolUse` hook** — blocks Claude from running `git commit` with non-conforming messages
